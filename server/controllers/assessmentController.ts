import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import QuizHistory from '../models/QuizHistory';
import PracticeExam from '../models/PracticeExam';
import Attempt from '../models/PracticeExamAttempt';

/** Read-only summaries: no answer keys, grading calls, or confidence updates. */
export async function listAssessments(req: Request, res: Response, next: NextFunction) {
  const user = (req.session as any)?.passport?.user;
  if (!user) return res.status(401).json({ error: 'Sign in to view assessments' });
  const owner = String(typeof user === 'object' ? user._id : user);
  const chatId = req.query.chat_id;
  const kind = req.query.kind;
  const limit = Number(req.query.limit ?? 20), offset = Number(req.query.offset ?? 0);
  if (typeof chatId !== 'string' || !chatId.trim() || !['quiz', 'exam'].includes(String(kind)) ||
      !Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
    return res.status(400).json({ error: 'Provide chat_id, kind (quiz or exam), and valid pagination' });
  }
  try {
    if (!await User.exists({ _id: owner, 'chats.chat_id': chatId })) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    if (kind === 'quiz') {
      const filter = { userID: owner, chatID: chatId };
      const [records, total] = await Promise.all([
        QuizHistory.aggregate([
          { $match: filter }, { $sort: { createdAt: -1, _id: -1 } }, { $skip: offset }, { $limit: limit },
          { $project: { title: 1, schemaVersion: 1, status: 1, correctCount: 1, createdAt: 1, completedAt: 1,
            totalQuestions: { $ifNull: ['$totalQuestions', { $size: { $ifNull: ['$questions', []] } }] } } },
        ]), QuizHistory.countDocuments(filter),
      ]);
      return res.json({ items: records.map(r => ({ id: String(r._id), kind: 'quiz',
        title: r.title || 'Saved quiz', createdAt: r.createdAt, completedAt: r.completedAt,
        status: r.schemaVersion === 2 ? r.status : 'completed', legacy: r.schemaVersion !== 2,
        score: r.schemaVersion === 2 && r.status === 'completed' ? r.correctCount : null,
        total: r.totalQuestions,
      })), total, limit, offset });
    }
    const filter = { user_id: owner, chat_id: chatId };
    const [records, total] = await Promise.all([
      PracticeExam.find(filter).sort({ createdAt: -1, _id: -1 }).skip(offset).limit(limit)
        .select('title total_points createdAt').lean(),
      PracticeExam.countDocuments(filter),
    ]);
    // One batched attempt query for this page, rather than one query per exam.
    const attempts = records.length ? await Attempt.find({ user_id: owner, exam_id: { $in: records.map(r => r._id) } })
      .sort({ createdAt: -1, _id: -1 }).select('exam_id status grading.score grading.total createdAt submitted_at').lean() : [];
    const byExam = new Map<string, typeof attempts>();
    for (const attempt of attempts) {
      const id = String(attempt.exam_id);
      const group = byExam.get(id) || [];
      group.push(attempt); byExam.set(id, group);
    }
    return res.json({ items: records.map(r => {
      const history = byExam.get(String(r._id)) || [];
      const graded = history.find(a => a.status === 'submitted' && a.grading);
      return { id: String(r._id), kind: 'exam', title: r.title, createdAt: r.createdAt,
        status: history[0]?.status || 'not_started', score: graded?.grading?.score ?? null,
        total: graded?.grading?.total ?? r.total_points,
        attempts: history.map(a => ({ id: String(a._id), status: a.status, createdAt: a.createdAt,
          score: a.status === 'submitted' ? a.grading?.score : null, total: a.grading?.total ?? r.total_points })),
      };
    }), total, limit, offset });
  } catch (error) { next(error); }
}
