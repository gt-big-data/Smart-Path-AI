import { Types } from 'mongoose';
import QuizHistory, { IQuizHistory, QuizQuestion, QuizResult } from '../models/QuizHistory';
import User from '../models/User';
import ConceptProgress from '../models/ConceptProgress';
import { updateConfidenceScore } from './confidence';

export class QuizRunError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Legacy archives remain reviewable, with no invented correctness verdicts. */
export function quizRunView(run: IQuizHistory) {
  const modern = run.schemaVersion === 2;
  const definition: QuizQuestion[] = modern ? run.definition || [] : run.questions.map((q, i) => ({
    question: q.questionText, answer: q.correctAnswer, explanation: q.explanation,
    conceptId: run.concepts[i]?.conceptID || '', conceptName: run.concepts[i]?.name,
  }));
  const results = definition.map((_, i) => modern ? run.results?.[i] || null : {
    answer: run.questions[i].userAnswer, isCorrect: null, feedback: '',
    skipped: run.questions[i].userAnswer === 'SKIPPED',
  });
  const completed = !modern || run.status === 'completed';
  const nextQuestion = results.findIndex(result => !result);
  return {
    quizId: String(run._id), attemptId: run.attemptId || String(run._id),
    chatId: run.chatID, graphId: run.graphId, title: run.title || 'Saved quiz',
    completed, scoreAvailable: modern && completed,
    currentQuestionIndex: nextQuestion < 0 ? Math.max(0, definition.length - 1) : nextQuestion,
    qaData: definition.map((q, i) => ({ ...q,
      answer: completed || results[i] ? q.answer : '',
      explanation: completed || results[i] ? q.explanation : undefined,
    })), results,
  };
}

export async function ownedQuizRun(owner: string, id: string, chatId?: string) {
  if (!Types.ObjectId.isValid(id)) throw new QuizRunError(404, 'Quiz not found');
  const run = await QuizHistory.findOne({ _id: id, userID: owner, ...(chatId ? { chatID: chatId } : {}) })
    .select('+definition +results');
  if (!run || !await User.exists({ _id: owner, 'chats.chat_id': run.chatID })) {
    throw new QuizRunError(404, 'Quiz not found');
  }
  return run;
}

export async function createQuizRun(owner: string, chatId: string, graphId: string,
  attemptId: string, definition: QuizQuestion[], format: string) {
  if (!definition.length || definition.some(q => !q.question.trim() || !q.conceptId.trim() || !q.answer.trim())) {
    throw new QuizRunError(502, 'The generated quiz is missing questions or topic information. Please try again.');
  }
  try {
    return await QuizHistory.create({ userID: owner, chatID: chatId, graphId, attemptId,
      schemaVersion: 2, title: `${definition.length}-question quiz`, format, status: 'draft',
      definition, results: {}, totalQuestions: definition.length,
      concepts: definition.map(q => ({ conceptID: q.conceptId, name: q.conceptName || 'Topic' })), questions: [],
    });
  } catch (error: any) {
    if (error.code !== 11000) throw error;
    const existing = await QuizHistory.findOne({ userID: owner, chatID: chatId, attemptId }).select('+definition +results');
    if (!existing) throw new QuizRunError(409, 'Quiz request ID is already in use');
    return existing;
  }
}

export async function storeQuizResult(owner: string, run: IQuizHistory, index: number, result: QuizResult) {
  const saved = await QuizHistory.findOneAndUpdate({ _id: run._id, userID: owner, status: 'draft',
    [`results.${index}`]: { $exists: false } }, {
    $set: { [`results.${index}`]: result, updatedAt: new Date() },
  }, { new: true }).select('+definition +results');
  const latest = saved || await ownedQuizRun(owner, String(run._id));
  const verdict = latest.results?.[index];
  if (!verdict || verdict.answer !== result.answer) {
    throw new QuizRunError(409, 'This question already has a different saved answer. Reload the quiz.');
  }
  return verdict;
}

/** Safe to retry after a network failure; the shared confidence service deduplicates this update. */
export async function applyQuizResult(owner: string, run: IQuizHistory, index: number, result: QuizResult) {
  const question = run.definition![index];
  await updateConfidenceScore(owner, run.chatID, question.conceptId, result.isCorrect,
    `quiz:${run._id}:${index}`);
  if (question.conceptName) await ConceptProgress.updateOne(
    { user: owner, chatId: run.chatID, conceptId: question.conceptId },
    { $set: { conceptName: question.conceptName } });
}

export async function completeQuizRun(owner: string, id: string) {
  const run = await ownedQuizRun(owner, id);
  if (run.schemaVersion !== 2 || run.status === 'completed') return quizRunView(run);
  const definition = run.definition || [];
  if (!definition.length || definition.some((_, i) => !run.results?.[i])) {
    throw new QuizRunError(409, 'Answer or skip every question before completing the quiz');
  }
  // Reconcile a saved verdict whose confidence write was interrupted, without regrading it.
  for (let i = 0; i < definition.length; i++) await applyQuizResult(owner, run, i, run.results![i]);
  const saved = await QuizHistory.findOneAndUpdate({ _id: run._id, userID: owner, status: 'draft' }, {
    $set: { status: 'completed', completedAt: new Date(), updatedAt: new Date(),
      correctCount: definition.filter((_, i) => run.results![i].isCorrect).length,
      totalQuestions: definition.length,
      questions: definition.map((q, i) => ({ questionText: q.question, userAnswer: run.results![i].answer,
        correctAnswer: q.answer, explanation: q.explanation || 'Review the correct answer.', timestamp: new Date() })),
    },
  }, { new: true }).select('+definition +results');
  return quizRunView(saved || await ownedQuizRun(owner, id));
}
