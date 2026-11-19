/** Run only against a fresh disposable MongoDB on loopback port 27028. No real AI calls or app .env. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { randomUUID } = require('node:crypto');
process.env.OPENAI_API_KEY = 'offline-test-key';
process.env.PRACTICE_EXAM_SERVICE_TOKEN = 'test-service-token';
let gradingCalls = 0;
class FakeOpenAI {
  chat = { completions: { create: async () => {
    gradingCalls++;
    return { choices: [{ message: { content: JSON.stringify({ score: 100, feedback: 'Checked', thinkingPrompt: 'Explain your reasoning', conceptualHint: 'Review the definition' }) } }] };
  } } };
}
const load = Module._load;
Module._load = function(name, ...args) {
  if (name === 'openai') return FakeOpenAI;
  if (name === 'dotenv') return { config: () => ({ parsed: {} }) };
  return load.call(this, name, ...args);
};
const mongoose = require('mongoose');
const express = require('express');
const User = require('../models/User').default;
const Quiz = require('../models/QuizHistory').default;
const Exam = require('../models/PracticeExam').default;
const Attempt = require('../models/PracticeExamAttempt').default;
const Sample = require('../models/PracticeExamSample').default;
const Progress = require('../models/ConceptProgress').default;
const graph = require('../controllers/graphController');
const client = require('../utils/axiosConfig').pythonServiceClient;
const quizRoutes = require('../routes/quizHistoryRoutes').default;
const progressRoutes = require('../routes/progressRoutes').default;
const examRoutes = require('../routes/practiceExamRoutes').default;
const chatRoutes = require('../routes/chatRoutes').default;
Module._load = load;
let generations = 0, server, base, owner, outsider, run, exam, ownsDatabase = false;
const uri = process.env.ASSESSMENT_TEST_MONGO_URI;
if (!uri || !/^mongodb:\/\/127\.0\.0\.1:27028\/smartpath_assessment_test_[a-z0-9]+$/.test(uri)) {
  throw new Error('Use a fresh smartpath_assessment_test_<suffix> database on loopback port 27028');
}
const definition = { schema_version: 2, title: 'Practice algebra', total_points: 5,
  sections: [{ name: 'Part I', questions: [{ id: 'q1', label: '1', stem: '', concept_ids: ['topic1'],
    parts: [{ id: 'part1', label: 'a', type: 'mcq', prompt: 'Choose A', points: 5, choices: ['A','B','C','D'],
      answer: 'A', explanation: 'Expected A', rubric: 'Exact choice', depends_on: [] }] }] }] };
client.post = async path => {
  assert.match(path, /^\/questions\//);
  generations++;
  return { data: { questions: [
    { text: 'Choose the correct letter.\nA) Correct\nB) Wrong\nC) Wrong\nD) Wrong', correct_answer: 'A', topic_id: 'topic1', concept_name: 'Algebra', explanation: 'A is correct', format: 'mcq' },
    { text: 'Name the conserved quantity.', correct_answer: 'energy', topic_id: 'topic2', concept_name: 'Energy', explanation: 'Energy is conserved', format: 'open-ended' },
  ] } };
};
async function api(path, body, user = owner, method) {
  const response = await fetch(base + path, { method: method || (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(user ? { 'X-Test-User': user } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json() };
}
const start = id => api('/api/generate-questions-with-answers?chat_id=chat-local&graph_id=graph-local&persist=true&length=5&format=mixed&attempt_id='+id);

before(async () => {
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 5000 });
  assert.equal((await mongoose.connection.db.listCollections().toArray()).length, 0, 'Refusing to use an existing database');
  ownsDatabase = true;
  for (const model of [User, Quiz, Exam, Attempt, Sample, Progress]) { await model.createCollection(); await model.createIndexes(); }
  owner = String((await User.create({ name: 'Test owner', email: 'owner@example.test', chats: [
    { chat_id: 'chat-local', title: 'Algebra', graph_id: 'graph-local', messages: [] },
    { chat_id: 'exam-only', title: 'Exam only', graph_id: 'graph-only', messages: [] },
  ] }))._id);
  outsider = String((await User.create({ email: 'outsider@example.test', chats: [] }))._id);
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { req.session = { passport: { user: req.headers['x-test-user'] } }; next(); });
  app.get('/api/generate-questions-with-answers', graph.generateQuestionsWithAnswers);
  app.post('/api/verify-answer', graph.verifyAnswer);
  app.use('/api/quiz-history', quizRoutes); app.use('/api', progressRoutes);
  app.use('/api/practice-exams', examRoutes); app.use('/chat', chatRoutes);
  app.use((error, req, res, next) => res.status(500).json({ error: error.message }));
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (ownsDatabase) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('generated quizzes persist immediately, redact keys, and reuse a stable request ID', async () => {
  const id = randomUUID();
  const first = await start(id); assert.equal(first.status, 200); run = first.data.quiz;
  assert.equal(run.completed, false); assert.equal(run.qaData.length, 2);
  assert.equal(run.qaData[0].answer, ''); assert.equal(run.qaData[0].explanation, undefined);
  const calls = generations;
  const again = await start(id); assert.equal(again.data.quiz.quizId, run.quizId); assert.equal(generations, calls);
  const stored = await Quiz.findById(run.quizId).select('+definition');
  assert.equal(stored.definition[0].answer, 'A');
});
test('review and summary routes enforce user and current chat ownership', async () => {
  assert.equal((await api('/api/quiz-history/runs/'+run.quizId, undefined, outsider)).status, 404);
  assert.equal((await api('/api/progress/assessments?chat_id=chat-local&kind=quiz', undefined, outsider)).status, 404);
  assert.equal((await api('/api/progress/assessments?chat_id=chat-local&kind=quiz', undefined, '')).status, 401);
  assert.equal((await api('/api/progress/assessments?chat_id=chat-local&kind=bad')).status, 400);
  assert.equal((await api('/api/progress/assessments?chat_id=chat-local&kind=quiz&limit=101')).status, 400);
});
test('canonical verification saves the verdict and duplicate submissions do not regrade or increase confidence', async () => {
  const answer = { quiz_id: run.quizId, question_index: 0, userAnswer: 'A',
    question: 'Forged', correctAnswer: 'B', conceptId: 'forged', chat_id: 'forged' };
  const checked = await api('/api/verify-answer', answer);
  assert.equal(checked.status, 200); assert.equal(checked.data.isCorrect, true); assert.equal(checked.data.correctAnswer, 'A');
  const progress = await Progress.findOne({ user: owner, chatId: 'chat-local', conceptId: 'topic1' }).lean();
  const calls = gradingCalls;
  assert.equal((await api('/api/verify-answer', answer)).status, 200);
  assert.equal(gradingCalls, calls);
  const after = await Progress.findById(progress._id).lean(); assert.equal(after.confidenceScore, progress.confidenceScore);
  assert.equal((await api('/api/verify-answer', { ...answer, userAnswer: 'B' })).status, 409);
  assert.equal(await Progress.countDocuments({ conceptId: 'forged' }), 0);
});
test('quizzes resume from the database and skip/complete scores are reliable and idempotent', async () => {
  const resumed = await api('/api/quiz-history/runs/'+run.quizId);
  assert.equal(resumed.data.quiz.currentQuestionIndex, 1); assert.equal(resumed.data.quiz.results[0].isCorrect, true);
  assert.equal((await api('/api/quiz-history/runs/'+run.quizId+'/complete', {})).status, 409);
  await api('/api/verify-answer', { quiz_id: run.quizId, question_index: 1, userAnswer: 'SKIPPED' });
  const done = await api('/api/quiz-history/runs/'+run.quizId+'/complete', {});
  assert.equal(done.status, 200); assert.equal(done.data.quiz.completed, true); assert.equal(done.data.quiz.scoreAvailable, true);
  let stored = await Quiz.findById(run.quizId); assert.equal(stored.correctCount, 1); assert.equal(stored.totalQuestions, 2);
  const before = await Progress.find({ user: owner }).sort({ conceptId: 1 }).lean();
  const finishedAt = String(stored.completedAt), calls = gradingCalls;
  await api('/api/quiz-history/runs/'+run.quizId+'/complete', {});
  assert.equal(String((await Quiz.findById(run.quizId)).completedAt), finishedAt);
  assert.deepEqual(await Progress.find({ user: owner }).sort({ conceptId: 1 }).lean(), before);
  await api('/api/quiz-history/runs/'+run.quizId);
  assert.equal(gradingCalls, calls);
  const summary = await api('/api/progress/assessments?chat_id=chat-local&kind=quiz');
  assert.equal(summary.data.items[0].score, 1); assert.equal(summary.data.items[0].total, 2);
  assert.equal(JSON.stringify(summary.data).includes('correctAnswer'), false);
});
test('new runs remain separate and legacy history has no invented scores', async () => {
  const second = await start(randomUUID()); assert.notEqual(second.data.quiz.quizId, run.quizId);
  const legacy = await Quiz.create({ userID: owner, chatID: 'chat-local', concepts: [], questions: [
    { questionText: 'Explain energy', userAnswer: 'Conserved quantity', correctAnswer: 'energy', explanation: 'Energy' },
  ] });
  const review = await api('/api/quiz-history/runs/'+legacy._id);
  assert.equal(review.data.quiz.scoreAvailable, false); assert.equal(review.data.quiz.results[0].isCorrect, null);
  const summary = await api('/api/progress/assessments?chat_id=chat-local&kind=quiz');
  assert.equal(summary.data.items.find(i => i.id === String(legacy._id)).score, null);
  assert.equal(await Quiz.countDocuments({ userID: owner, chatID: 'chat-local' }), 3);
});
test('exam summaries include unattempted exams, all attempt scores, and zero-point exams', async () => {
  exam = await Exam.create({ user_id: owner, chat_id: 'exam-only', graph_id: 'graph-only', title: 'Practice algebra',
    total_points: 5, sample_filename: 'sample.pdf', exam: definition, blueprint: {} });
  let response = await api('/api/progress/assessments?chat_id=exam-only&kind=exam');
  assert.equal(response.data.items[0].status, 'not_started'); assert.equal(response.data.items[0].score, null);
  await Attempt.create({ user_id: owner, exam_id: exam._id, request_id: randomUUID(), status: 'submitted', grading: { score: 2, total: 5, results: [] }, createdAt: new Date('2026-11-17') });
  await Attempt.create({ user_id: owner, exam_id: exam._id, request_id: randomUUID(), status: 'submitted', grading: { score: 4, total: 5, results: [] } });
  response = await api('/api/progress/assessments?chat_id=exam-only&kind=exam');
  assert.equal(response.data.items[0].score, 4); assert.equal(response.data.items[0].attempts.length, 2);
  assert.deepEqual(response.data.items[0].attempts.map(a => a.score), [4,2]);
  assert.equal(JSON.stringify(response.data).includes('Expected A'), false);
  await Exam.create({ user_id: owner, chat_id: 'exam-only', graph_id: 'graph-only', title: 'Unscorable',
    total_points: 0, sample_filename: 'sample.pdf', exam: { ...definition, total_points: 0 }, blueprint: {} });
  response = await api('/api/progress/assessments?chat_id=exam-only&kind=exam');
  assert.equal(response.data.items.find(i => i.title === 'Unscorable').total, 0);
  assert.equal(await Progress.countDocuments({ user: owner, chatId: 'exam-only' }), 0);
});
test('summary pagination is stable and excludes other chats', async () => {
  for (let i=0; i<22; i++) await Quiz.create({ userID: owner, chatID: 'exam-only', concepts: [], questions: [] });
  const a = await api('/api/progress/assessments?chat_id=exam-only&kind=quiz&limit=20');
  const b = await api('/api/progress/assessments?chat_id=exam-only&kind=quiz&limit=20&offset=20');
  assert.equal(a.data.total, 22); assert.equal(a.data.items.length, 20); assert.equal(b.data.items.length, 2);
  assert.equal(new Set([...a.data.items,...b.data.items].map(i=>i.id)).size,22);
});
test('deleting a chat removes all its assessment collections without affecting another chat', async () => {
  await Sample.create({ user_id: owner, chat_id: 'exam-only', filename: 'sample.pdf', size_bytes: 4, sha256: 'sample-hash', pdf: Buffer.from('%PDF') });
  const response = await api('/chat/delete/exam-only', undefined, owner, 'DELETE');
  assert.equal(response.status, 200);
  assert.equal(await Exam.countDocuments({ user_id: owner, chat_id: 'exam-only' }), 0);
  assert.equal(await Attempt.countDocuments({ user_id: owner, exam_id: exam._id }), 0);
  assert.equal(await Sample.countDocuments({ user_id: owner, chat_id: 'exam-only' }), 0);
  assert.equal(await Quiz.countDocuments({ userID: owner, chatID: 'exam-only' }), 0);
  assert.equal(await Quiz.countDocuments({ userID: owner, chatID: 'chat-local' }), 3);
  assert.equal((await api('/api/progress/assessments?chat_id=exam-only&kind=quiz')).status, 404);
});
