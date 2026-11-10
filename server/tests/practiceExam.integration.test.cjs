process.env.PRACTICE_EXAM_SERVICE_TOKEN = 'test-service-token';
/** Uses ONLY a disposable MongoDB. AI calls are stubbed; no app credentials or .env are loaded. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const User = require('../models/User').default;
const Exam = require('../models/PracticeExam').default;
const Attempt = require('../models/PracticeExamAttempt').default;
const Sample = require('../models/PracticeExamSample').default;
const client = require('../utils/axiosConfig').pythonServiceClient;
const router = require('../routes/practiceExamRoutes').default;
const { randomUUID } = require('node:crypto');

const uri = process.env.PRACTICE_EXAM_TEST_MONGO_URI;
if (!uri || !/^mongodb:\/\/127\.0\.0\.1:27028\/smartpath_exam_test_[a-z0-9]+$/.test(uri)) {
  throw new Error('Set PRACTICE_EXAM_TEST_MONGO_URI to mongodb://127.0.0.1:27028/smartpath_exam_test_<unique suffix>; remote/main databases are forbidden');
}
const definition = {
  schema_version: 2, title: 'Solutions', instructions: 'Show work', time_limit_minutes: 30, total_points: 5,
  sections: [{ name: 'Part I', instructions: null, questions: [{ id: 'q1', label: '1', stem: 'Shared scenario',
    concept_ids: ['topic-molarity'], parts: [
      { id: 'q1-a', label: '(i)', group_label: '(a)', group_instructions: 'Calculate each value.', type: 'numeric', prompt: 'Moles?', choices: null, answer: '2 mol',
        explanation: 'Given', rubric: 'Method and answer', points: 2, depends_on: [] },
      { id: 'q1-b', label: 'b', type: 'mcq', prompt: 'Concentration?', choices: ['1 M','2 M','3 M','4 M'],
        answer: '2 M', explanation: 'M = n/V', rubric: 'Exact choice', points: 3, depends_on: ['q1-a'] },
    ] }, { id: 'q2', label: '2', stem: '', concept_ids: [], parts: [], error: 'Required diagram missing' },
      { id: 'q3', label: '3', stem: 'Unverified question', concept_ids: ['topic-1'],
        error: 'Could not verify', parts: [{ id: 'q3-a', label: '', type: 'numeric',
          prompt: 'Unverified calculation', choices: null, answer: '99', explanation: 'Unverified',
          rubric: 'Unverified', points: 7, depends_on: [] }] }] }],
};
let server, base, owner, outsider, ownsDatabase = false;
let grades = 0, failGrade = false, holdGrade = false, releaseGrade;
let failGenerate = false, invalidGenerate = false, expectedGraph = 'graph-local';
const originalPost = client.post;
client.post = async (path, data) => {
  if (path.endsWith('/generate')) {
    const body = data.getBuffer().toString();
    assert.ok(body.includes(expectedGraph)); assert.doesNotMatch(body, /name="notes"/);
    assert.match(body, /%PDF-1.4\ntest sample/);
    if (failGenerate) throw new Error('Simulated generation failure');
    return { data: { schema_version: 2, format: { title: 'Blueprint' }, exam: invalidGenerate ? {} : structuredClone(definition) } };
  }
  grades++;
  assert.equal(data.exam.total_points, 5);
  assert.equal(data.exam.sections[0].questions[0].parts[0].answer, '2 mol');
  if (holdGrade) await new Promise(resolve => { releaseGrade = resolve; });
  if (failGrade) throw new Error('Simulated upstream failure');
  return { data: { score: 4, total: 5, results: [
    { part_id: 'q1-a', points_earned: 1, points_possible: 2, feedback: 'Partial credit' },
    { part_id: 'q1-b', points_earned: 3, points_possible: 3, feedback: 'Correct' },
  ] } };
};
before(async () => {
  await mongoose.connect(uri, { autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 5000 });
  if ((await mongoose.connection.db.listCollections().toArray()).length) {
    throw new Error('Refusing to use or delete an existing database; choose a fresh test suffix');
  }
  ownsDatabase = true;
  await Promise.all([User, Exam, Attempt, Sample].map(async model => {
    await model.createCollection(); await model.createIndexes();
  }));
  owner = String((await User.create({ email: 'owner@local.test', chats: [
    { chat_id: 'chat-local', title: 'Chemistry', graph_id: 'graph-local', messages: [] },
    { chat_id: 'chat-empty', title: 'Empty', graph_id: '', messages: [] },
    { chat_id: 'chat-pdfs', title: 'Saved PDFs', graph_id: 'graph-local', messages: [] },
    { chat_id: 'chat-other', title: 'Other course', graph_id: 'graph-local', messages: [] },
  ] }))._id);
  outsider = String((await User.create({ email: 'outsider@local.test', chats: [
    { chat_id: 'chat-pdfs', title: 'Another user', graph_id: 'graph-local', messages: [] },
  ] }))._id);
  const app = express();
  app.use(express.json());
  // Test-only authentication harness; never installed in the application.
  app.use((req, res, next) => { req.session = { passport: { user: req.headers['x-test-user'] } }; next(); });
  app.use('/api/practice-exams', router);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api/practice-exams`;
});
after(async () => {
  client.post = originalPost;
  if (server) await new Promise(resolve => server.close(resolve));
  if (ownsDatabase && mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
async function request(path = '', { method = 'GET', body, who = owner, multipart = false } = {}) {
  const headers = who ? { 'x-test-user': who } : {};
  if (body && !multipart) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + path, { method, headers, body: body ? (multipart ? body : JSON.stringify(body)) : undefined });
  return { status: response.status, data: await response.json() };
}
function upload(chat = 'chat-local') {
  const body = new FormData(); body.append('chat_id', chat);
  body.append('practice_exam', new Blob(['%PDF-1.4\ntest sample']), 'sample.pdf');
  return body;
}
test('owned exam lifecycle, private keys, draft conflicts, idempotent submission and failure recovery', async () => {
  assert.equal((await request('', { who: null })).status, 401);
  assert.equal((await request('?chat_id=chat-local', { who: outsider })).status, 404);
  assert.equal((await request('', { method: 'POST', body: upload('chat-empty'), multipart: true })).status, 409);
  const generated = await request('', { method: 'POST', body: upload(), multipart: true });
  assert.equal(generated.status, 201);
  const examId = generated.data.id;
  assert.equal(generated.data.graph_id, 'graph-local');
  const publicPart = generated.data.exam.sections[0].questions[0].parts[0];
  assert.equal(publicPart.group_label, '(a)');
  assert.equal(generated.data.exam.sections[0].questions[1].error, 'Required diagram missing');
  assert.equal(generated.data.exam.sections[0].questions[2].parts[0].prompt, 'Unverified calculation');
  assert.equal('answer' in generated.data.exam.sections[0].questions[2].parts[0], false);
  assert.equal('answer' in publicPart, false); assert.equal('rubric' in publicPart, false);
  assert.equal((await request(`/${examId}`, { who: outsider })).status, 404);
  assert.equal((await request('?chat_id=chat-local')).data.total, 1);
  const hidden = await Exam.findById(examId);
  assert.equal(hidden.exam, undefined); assert.equal(hidden.blueprint, undefined);
  // Changing the active graph must not change the saved exam or its answer key.
  await User.updateOne({ _id: owner, 'chats.chat_id': 'chat-local' }, { $set: { 'chats.$.graph_id': 'replacement-graph' } });
  assert.equal((await request(`/${examId}`)).data.graph_id, 'graph-local');
  const requestId = randomUUID();
  const created = await request(`/${examId}/attempts`, { method: 'POST', body: { request_id: requestId } });
  assert.equal(created.status, 201);
  const attemptId = created.data.attempt.id;
  const prefix = `/${examId}/attempts/${attemptId}`;
  assert.equal((await request(`/${examId}/attempts`, { method: 'POST', body: { request_id: requestId } })).data.attempt.id, attemptId);
  assert.equal((await request(prefix, { who: outsider })).status, 404);
  assert.equal((await request(prefix, { method: 'PATCH', body: { revision: 0, answers: [{ part_id: 'q3-a', user_answer: '99' }] } })).status, 400);
  const answers = [{ part_id: 'q1-a', user_answer: '1 mol' }, { part_id: 'q1-b', user_answer: '2 M' }];
  assert.equal((await request(prefix, { method: 'PATCH', body: { revision: 0, answers: [{ part_id: 'bad', user_answer: 'x' }] } })).status, 400);
  assert.equal((await request(prefix, { method: 'PATCH', body: { revision: 0, answers: [{ part_id: 'q1-a', user_answer: 'x', correct_answer: 'x' }] } })).status, 400);
  const saved = await request(prefix, { method: 'PATCH', body: { revision: 0, answers } });
  assert.equal(saved.data.attempt.revision, 1);
  assert.deepEqual((await request(prefix)).data.attempt.answers, answers);
  assert.equal((await request(prefix, { method: 'PATCH', body: { revision: 0, answers } })).status, 409);
  holdGrade = true;
  const submitting = request(prefix + '/submit', { method: 'POST', body: { revision: 1, correct_answer: 'tampering ignored' } });
  while (!releaseGrade) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal((await request(prefix)).data.attempt.status, 'grading');
  assert.equal((await request(prefix + '/submit', { method: 'POST', body: { revision: 1 } })).status, 409);
  releaseGrade(); holdGrade = false;
  const submitted = await submitting;
  assert.equal(submitted.data.attempt.status, 'submitted');
  assert.equal(submitted.data.attempt.grading.score, 4);
  assert.equal(submitted.data.attempt.grading.results[0].correct_answer, '2 mol');
  assert.equal((await request(prefix + '/submit', { method: 'POST', body: { revision: 1 } })).status, 200);
  assert.equal(grades, 1);
  assert.equal((await request(prefix, { method: 'PATCH', body: { revision: 3, answers } })).status, 409);
  const another = await request(`/${examId}/attempts`, { method: 'POST', body: { request_id: randomUUID() } });
  const second = `/${examId}/attempts/${another.data.attempt.id}`;
  failGrade = true;
  assert.equal((await request(second + '/submit', { method: 'POST', body: { revision: 0 } })).status, 500);
  const failed = (await request(second)).data.attempt;
  assert.equal(failed.status, 'grading_failed'); assert.equal(failed.revision, 2);
  failGrade = false;
  assert.equal((await request(second + '/submit', { method: 'POST', body: { revision: 2 } })).data.attempt.status, 'submitted');
  assert.equal((await request(`/${examId}/attempts`)).data.attempts.length, 2);
  assert.equal(await mongoose.connection.collection('quizhistories').countDocuments(), 0);
  assert.equal(await mongoose.connection.collection('conceptprogresses').countDocuments(), 0);
});

test('sample PDFs persist independently, remain private and generate fresh exams without reuploading', async () => {
  assert.equal((await request('/samples?chat_id=chat-pdfs', { who: null })).status, 401);
  assert.equal((await request('/samples', { method: 'POST', body: upload('chat-pdfs'), multipart: true, who: null })).status, 401);
  const saved = await request('/samples', { method: 'POST', body: upload('chat-pdfs'), multipart: true });
  assert.equal(saved.status, 201);
  const sample = saved.data.sample;
  assert.equal(sample.filename, 'sample.pdf');
  assert.equal(sample.size_bytes, Buffer.byteLength('%PDF-1.4\ntest sample'));
  assert.ok(!Number.isNaN(Date.parse(sample.created_at)));
  assert.equal('pdf' in sample, false); assert.equal('sha256' in sample, false);
  const hidden = await Sample.findById(sample.id);
  assert.equal(hidden.pdf, undefined); assert.equal(hidden.sha256, undefined);
  const duplicate = await request('/samples', { method: 'POST', body: upload('chat-pdfs'), multipart: true });
  assert.equal(duplicate.status, 200);
  assert.deepEqual(duplicate.data.sample, sample);
  const listed = await request('/samples?chat_id=chat-pdfs&limit=1&offset=0');
  assert.equal(listed.data.total, 1);
  assert.deepEqual(listed.data.samples, [sample]);
  assert.deepEqual((await request('/samples?chat_id=chat-pdfs&offset=1')).data.samples, []);
  assert.equal((await request('/samples?chat_id=chat-pdfs&limit=101')).status, 400);
  assert.equal((await request('/samples?chat_id=chat-pdfs&offset=-1')).status, 400);
  assert.equal((await request('/samples?chat_id=chat-pdfs', { who: outsider })).data.total, 0);
  assert.equal((await request('/samples?chat_id=chat-other')).data.total, 0);

  const fileUrl = `${base}/samples/${sample.id}/file`;
  assert.equal((await fetch(fileUrl)).status, 401);
  assert.equal((await fetch(fileUrl, { headers: { 'x-test-user': outsider } })).status, 404);
  const file = await fetch(fileUrl, { headers: { 'x-test-user': owner } });
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'application/pdf');
  assert.match(file.headers.get('content-disposition'), /^inline;/);
  assert.equal(file.headers.get('cache-control'), 'private, no-store');
  assert.equal(await file.text(), '%PDF-1.4\ntest sample');

  const generate = () => request('', { method: 'POST', body: { chat_id: 'chat-pdfs', sample_pdf_id: sample.id } });
  const first = await generate(), second = await generate();
  assert.equal(first.status, 201); assert.equal(second.status, 201);
  assert.notEqual(first.data.id, second.data.id);
  assert.equal(first.data.sample_pdf_id, sample.id);
  assert.equal(first.data.sample_filename, 'sample.pdf');
  assert.equal('answer' in first.data.exam.sections[0].questions[0].parts[0], false);
  assert.equal(await Sample.countDocuments({ user_id: owner, chat_id: 'chat-pdfs' }), 1);
  assert.equal((await request('', { method: 'POST', who: outsider,
    body: { chat_id: 'chat-pdfs', sample_pdf_id: sample.id } })).status, 404);
  assert.equal((await request('', { method: 'POST',
    body: { chat_id: 'chat-other', sample_pdf_id: sample.id } })).status, 404);
  assert.equal((await request('', { method: 'POST', body: { chat_id: 'chat-pdfs', sample_pdf_id: 'invalid' } })).status, 404);
  assert.equal((await request('', { method: 'POST', body: { chat_id: 'chat-pdfs' } })).status, 400);
  const ambiguous = upload('chat-pdfs'); ambiguous.append('sample_pdf_id', sample.id);
  assert.equal((await request('', { method: 'POST', body: ambiguous, multipart: true })).status, 400);

  // Saved PDFs always use the chat's CURRENT graph when creating a new exam.
  expectedGraph = 'graph-updated';
  await User.updateOne({ _id: owner, 'chats.chat_id': 'chat-pdfs' }, { $set: { 'chats.$.graph_id': expectedGraph } });
  assert.equal((await generate()).data.graph_id, expectedGraph);
  expectedGraph = 'graph-local';
  await User.updateOne({ _id: owner, 'chats.chat_id': 'chat-pdfs' }, { $set: { 'chats.$.graph_id': expectedGraph } });

  failGenerate = true;
  assert.equal((await generate()).status, 500);
  failGenerate = false;
  invalidGenerate = true;
  assert.equal((await generate()).status, 502);
  invalidGenerate = false;
  assert.equal((await generate()).status, 201);
  assert.equal((await request('/samples?chat_id=chat-pdfs')).data.total, 1);

  // Content deduplication is scoped to the user and chat, never global.
  const other = await request('/samples', { method: 'POST', body: upload('chat-pdfs'), multipart: true, who: outsider });
  assert.equal(other.status, 201); assert.notEqual(other.data.sample.id, sample.id);
  const races = await Promise.all(Array.from({ length: 4 }, () =>
    request('/samples', { method: 'POST', body: upload('chat-other'), multipart: true })));
  assert.equal(new Set(races.map(r => r.data.sample.id)).size, 1);
  assert.equal(races.filter(r => r.status === 201).length, 1);
  assert.equal(await Sample.countDocuments({ user_id: owner, chat_id: 'chat-other' }), 1);
});

test('invalid and oversized sample uploads are rejected; generation failures retain uploaded PDFs', async () => {
  const count = await Sample.countDocuments();
  for (const [bytes, filename] of [['not a PDF', 'bad.pdf'], ['%PDF-1.4\ntest sample', 'bad.txt']]) {
    const form = new FormData(); form.append('chat_id', 'chat-pdfs');
    form.append('practice_exam', new Blob([bytes]), filename);
    assert.equal((await request('/samples', { method: 'POST', body: form, multipart: true })).status, 400);
  }
  const oversized = new FormData(); oversized.append('chat_id', 'chat-pdfs');
  oversized.append('practice_exam', new Blob([Buffer.alloc(10 * 1024 * 1024 + 1)]), 'huge.pdf');
  assert.equal((await request('/samples', { method: 'POST', body: oversized, multipart: true })).status, 413);
  assert.equal(await Sample.countDocuments(), count);
  failGenerate = true;
  const form = upload('chat-pdfs');
  form.set('practice_exam', new Blob(['%PDF-1.4\ntest sample new upload']), 'retry.pdf');
  assert.equal((await request('', { method: 'POST', body: form, multipart: true })).status, 500);
  failGenerate = false;
  const saved = (await request('/samples?chat_id=chat-pdfs')).data.samples.find(s => s.filename === 'retry.pdf');
  assert.ok(saved);
  assert.equal((await request('', { method: 'POST', body: { chat_id: 'chat-pdfs', sample_pdf_id: saved.id } })).status, 201);
  // Saving a sample itself does not require an existing study graph.
  assert.equal((await request('/samples', { method: 'POST', body: upload('chat-empty'), multipart: true })).status, 200);
});

test('a PDF at the 10 MB limit is stored and served intact; inaccessible chats cannot expose files', async () => {
  const bytes = Buffer.alloc(10 * 1024 * 1024, 32);
  bytes.write('%PDF-1.4\n');
  const form = new FormData(); form.append('chat_id', 'chat-other');
  form.append('practice_exam', new Blob([bytes]), 'maximum.pdf');
  const saved = await request('/samples', { method: 'POST', body: form, multipart: true });
  assert.equal(saved.status, 201);
  assert.equal(saved.data.sample.size_bytes, bytes.length);
  const fileUrl = `${base}/samples/${saved.data.sample.id}/file`;
  const file = await fetch(fileUrl, { headers: { 'x-test-user': owner } });
  assert.equal(file.status, 200);
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);
  await User.updateOne({ _id: owner }, { $pull: { chats: { chat_id: 'chat-other' } } });
  assert.equal((await fetch(fileUrl, { headers: { 'x-test-user': owner } })).status, 404);
  assert.equal((await request('/samples?chat_id=chat-other')).status, 404);
});
