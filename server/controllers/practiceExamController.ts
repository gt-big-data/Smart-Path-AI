import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Types } from 'mongoose';
import axios from 'axios';
import FormData from 'form-data';
import User from '../models/User';
import PracticeExam from '../models/PracticeExam';
import Attempt from '../models/PracticeExamAttempt';
import { pythonServiceClient } from '../utils/axiosConfig';
import { publicExam, validateExam, validateAnswers, validateGrading } from '../services/practiceExamContract';

const GRADING_LEASE_MS = 10 * 60 * 1000;
class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function userId(req: Request): string {
  const value = (req.session as any)?.passport?.user;
  const id = typeof value === 'object' ? value?._id : value;
  if (!id) throw new ApiError(401, 'Sign in to access practice exams');
  return String(id);
}
function serviceHeaders() {
  const token = process.env.PRACTICE_EXAM_SERVICE_TOKEN;
  if (!token) throw new ApiError(503, 'Practice exam service is not configured');
  return { 'X-Practice-Exam-Token': token };
}
async function ownedChat(owner: string, chatId: string) {
  const user = await User.findById(owner);
  const chat = user?.chats.find(c => c.chat_id === chatId);
  if (!chat) throw new ApiError(404, 'Chat not found');
  return chat;
}
async function ownedExam(req: Request) {
  const owner = userId(req);
  if (!Types.ObjectId.isValid(req.params.examId)) throw new ApiError(404, 'Exam not found');
  const record = await PracticeExam.findOne({ _id: req.params.examId, user_id: owner }).select('+exam');
  if (!record) throw new ApiError(404, 'Exam not found');
  await ownedChat(owner, record.chat_id);
  return record;
}
function summary(record: any) {
  return { id: String(record._id), chat_id: record.chat_id, graph_id: record.graph_id,
    schema_version: record.schema_version, title: record.title, total_points: record.total_points,
    sample_filename: record.sample_filename, created_at: record.createdAt };
}
function attemptView(record: any) {
  return { id: String(record._id), exam_id: String(record.exam_id), status: record.status,
    revision: record.revision, answers: record.answers.map((a: any) => ({ part_id: a.part_id, user_answer: a.user_answer })),
    grading: record.status === 'submitted' ? record.grading : undefined,
    error: record.error, submitted_at: record.submitted_at,
    created_at: record.createdAt, updated_at: record.updatedAt };
}
export const requirePracticeExamUser: RequestHandler = (req, res, next) => {
  try { userId(req); next(); } catch (error) { next(error); }
};
export function practiceExamError(error: any, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(error);
  if (error instanceof ApiError) return res.status(error.status).json({ error: error.message });
  if (error?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Sample PDF must be at most 10 MB' });
  if (error?.name === 'MulterError') return res.status(400).json({ error: 'Upload exactly one practice_exam PDF' });
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const detail = error.response?.data?.detail;
    if (status === 422 && typeof detail === 'string') return res.status(422).json({ error: detail });
    if (status === 404) return res.status(422).json({ error: 'The chat study graph is missing; upload notes first' });
    return res.status(502).json({ error: 'AI service unavailable. Your saved drafts are safe; try again.' });
  }
  console.error('[Practice Exam]', error?.message || 'Request failed');
  return res.status(500).json({ error: 'Practice exam request failed' });
}
// Express 4 does not forward rejected promises automatically.
export const route = (handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { void handler(req, res).catch(next); };

export async function generate(req: Request, res: Response) {
  const owner = userId(req);
  const chatId = req.body.chat_id;
  if (typeof chatId !== 'string' || !chatId.trim()) throw new ApiError(400, 'chat_id is required');
  const chat = await ownedChat(owner, chatId);
  if (!chat.graph_id) throw new ApiError(409, 'Upload notes in this chat before generating an exam');
  if (!req.file || !req.file.originalname.toLowerCase().endsWith('.pdf')) throw new ApiError(400, 'practice_exam PDF is required');
  if (!req.file.buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new ApiError(400, 'Uploaded file is not a PDF');
  const graphId = chat.graph_id;
  const form = new FormData();
  form.append('graph_id', graphId);
  form.append('practice_exam', req.file.buffer, { filename: req.file.originalname, contentType: 'application/pdf' });
  const response = await pythonServiceClient.post('/practice-exam/generate', form, {
    headers: { ...form.getHeaders(), ...serviceHeaders() }, timeout: 600000, maxBodyLength: 11 * 1024 * 1024,
  });
  try { validateExam(response.data?.exam); }
  catch { throw new ApiError(502, 'AI service returned an invalid exam; nothing was saved'); }
  if (!response.data?.format || response.data.schema_version !== 2) throw new ApiError(502, 'AI service returned an invalid blueprint');
  await ownedChat(owner, chatId);
  const record = await PracticeExam.create({ user_id: owner, chat_id: chatId, graph_id: graphId,
    title: response.data.exam.title, total_points: response.data.exam.total_points,
    sample_filename: req.file.originalname, schema_version: 2,
    exam: response.data.exam, blueprint: response.data.format });
  return res.status(201).json({ ...summary(record), exam: publicExam(record.exam) });
}
export async function list(req: Request, res: Response) {
  const owner = userId(req);
  const chatId = req.query.chat_id;
  if (typeof chatId !== 'string') throw new ApiError(400, 'chat_id is required');
  await ownedChat(owner, chatId);
  const limit = Number(req.query.limit || 20);
  const offset = Number(req.query.offset || 0);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
    throw new ApiError(400, 'limit must be 1–100 and offset a nonnegative integer');
  }
  const filter = { user_id: owner, chat_id: chatId };
  const [records, total] = await Promise.all([
    PracticeExam.find(filter).sort({ createdAt: -1, _id: -1 }).skip(offset).limit(limit),
    PracticeExam.countDocuments(filter),
  ]);
  return res.json({ exams: records.map(summary), total, limit, offset });
}
export async function get(req: Request, res: Response) {
  const record = await ownedExam(req);
  return res.json({ ...summary(record), exam: publicExam(record.exam) });
}
export async function createAttempt(req: Request, res: Response) {
  const exam = await ownedExam(req);
  const owner = userId(req);
  const requestId = req.body.request_id;
  if (typeof requestId !== 'string' || !/^[\w-]{8,100}$/.test(requestId)) {
    throw new ApiError(400, 'request_id must be a stable unique identifier of 8–100 letters, digits, underscores or hyphens');
  }
  let record;
  let created = true;
  try { record = await Attempt.create({ user_id: owner, exam_id: exam._id, request_id: requestId }); }
  catch (error: any) {
    if (error.code !== 11000) throw error;
    created = false;
    record = await Attempt.findOne({ user_id: owner, request_id: requestId });
  }
  if (!record || String(record.exam_id) !== String(exam._id)) throw new ApiError(409, 'request_id was already used for another exam');
  return res.status(created ? 201 : 200).json({ attempt: attemptView(record) });
}
export async function listAttempts(req: Request, res: Response) {
  const exam = await ownedExam(req);
  const records = await Attempt.find({ user_id: userId(req), exam_id: exam._id }).sort({ createdAt: -1 }).limit(100);
  return res.json({ attempts: records.map(attemptView) });
}
async function ownedAttempt(req: Request, examId: Types.ObjectId) {
  if (!Types.ObjectId.isValid(req.params.attemptId)) throw new ApiError(404, 'Attempt not found');
  const attempt = await Attempt.findOne({ _id: req.params.attemptId, user_id: userId(req), exam_id: examId });
  if (!attempt) throw new ApiError(404, 'Attempt not found');
  return attempt;
}
export async function getAttempt(req: Request, res: Response) {
  const exam = await ownedExam(req);
  return res.json({ attempt: attemptView(await ownedAttempt(req, exam._id)) });
}
function revision(req: Request) {
  if (!Number.isInteger(req.body.revision) || req.body.revision < 0) throw new ApiError(400, 'revision must be a nonnegative integer');
  return req.body.revision;
}
export async function saveDraft(req: Request, res: Response) {
  const exam = await ownedExam(req);
  await ownedAttempt(req, exam._id);
  const rev = revision(req);
  let answers;
  try { answers = validateAnswers(req.body.answers, exam.exam); }
  catch (error: any) { throw new ApiError(400, error.message); }
  const record = await Attempt.findOneAndUpdate({ _id: req.params.attemptId, user_id: userId(req),
    exam_id: exam._id, status: { $in: ['draft', 'grading_failed'] }, revision: rev },
    { $set: { answers, status: 'draft' }, $unset: { error: 1 }, $inc: { revision: 1 } }, { new: true });
  if (!record) throw new ApiError(409, 'Draft changed or is locked; reload the attempt before saving');
  return res.json({ attempt: attemptView(record) });
}
export async function submit(req: Request, res: Response) {
  const exam = await ownedExam(req);
  const previous = await ownedAttempt(req, exam._id);
  if (previous.status === 'submitted') return res.json({ attempt: attemptView(previous) });
  const rev = revision(req);
  const headers = serviceHeaders();
  const now = new Date();
  const claimed = await Attempt.findOneAndUpdate({ _id: previous._id, user_id: userId(req), revision: rev,
    $or: [{ status: { $in: ['draft', 'grading_failed'] } },
      { status: 'grading', grading_started_at: { $lt: new Date(now.getTime() - GRADING_LEASE_MS) } }] },
    { $set: { status: 'grading', grading_started_at: now }, $unset: { error: 1 }, $inc: { revision: 1 } }, { new: true });
  if (!claimed) throw new ApiError(409, 'Attempt changed or is already grading; reload its status');
  try {
    const response = await pythonServiceClient.post('/practice-exam/grade', {
      exam: exam.exam, answers: claimed.answers.map(a => ({ part_id: a.part_id, user_answer: a.user_answer })),
    }, { headers, timeout: 300000 });
    let grading;
    try { grading = validateGrading(response.data, exam.exam); }
    catch { throw new ApiError(502, 'AI service returned invalid grading; your answers are saved'); }
    const record = await Attempt.findOneAndUpdate({ _id: claimed._id, status: 'grading', revision: claimed.revision },
      { $set: { status: 'submitted', grading, submitted_at: new Date() }, $inc: { revision: 1 } }, { new: true });
    if (!record) throw new ApiError(409, 'Grading was superseded; reload the attempt');
    return res.json({ attempt: attemptView(record) });
  } catch (error) {
    await Attempt.updateOne({ _id: claimed._id, status: 'grading', revision: claimed.revision },
      { $set: { status: 'grading_failed', error: 'Grading failed. Your answers are saved; retry submission.' },
        $inc: { revision: 1 } });
    throw error;
  }
}
