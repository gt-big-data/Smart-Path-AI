import type { Request, Response } from 'express';
import { afterEach, beforeEach, expect, test, vi, type Mock } from 'vitest';
import ConceptProgress from '../models/ConceptProgress';
import QuizHistory from '../models/QuizHistory';
import { getConceptProgress, updateConceptProgress } from '../controllers/progressController.ts';
import { verifyAnswer } from '../controllers/graphController.ts';
import { saveQuizHistory, processAllQuizHistory } from '../controllers/quizHistoryController.ts';
import { calculateDecayedConfidence } from '../utils/confidenceDecay';
import User from '../models/User';

vi.mock('../models/ConceptProgress', () => ({ __esModule: true, default: vi.fn() }));
vi.mock('../models/QuizHistory', () => ({ __esModule: true, default: vi.fn() }));
vi.mock('openai', () => ({ __esModule: true, default: vi.fn(function () { return {
  chat: { completions: { create: vi.fn().mockResolvedValue({ choices: [{ message: {
    content: JSON.stringify({ score: 100, feedback: 'Correct', thinkingPrompt: 'Why?' }),
  } }] }) } },
}; }) }));
vi.mock('../utils/axiosConfig', () => ({ pythonServiceClient: {} }));
vi.mock('../models/User', () => ({ __esModule: true, default: { exists: vi.fn() } }));

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-01T12:00:00Z');
const model = ConceptProgress as unknown as Mock & {
  find: Mock;
  findOne: Mock;
  updateOne: Mock;
  findOneAndUpdate: Mock;
};
const historyModel = QuizHistory as unknown as Mock & { find: Mock };

function progress(score = 0.9, daysAgo = 30) {
  const record = {
    conceptId: 'topic1', conceptName: 'Polynomial', confidenceScore: score,
    lastAttempted: new Date(NOW.getTime() - daysAgo * DAY),
    save: vi.fn().mockResolvedValue(undefined),
    toObject: () => ({ conceptId: record.conceptId, conceptName: record.conceptName,
      confidenceScore: record.confidenceScore, lastAttempted: record.lastAttempted }),
  };
  return record;
}

function request(body: object = {}) {
  return {
    session: { passport: { user: 'user1' } },
    body: { chat_id: 'chat1', submission_id: 'test-submission-1', ...body },
    query: { chat_id: 'chat1' },
  } as unknown as Request;
}

function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

beforeEach(() => {
  vi.useFakeTimers().setSystemTime(NOW);
  vi.clearAllMocks();
  model.find = vi.fn();
  model.findOne = vi.fn();
  model.updateOne = vi.fn().mockResolvedValue({});
  model.findOneAndUpdate = vi.fn();
  historyModel.find = vi.fn();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(User.exists).mockResolvedValue({ _id: 'user1' } as any);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test.each([
  [0.9, 0, 0.9], [0.9, 15, 0.875], [0.9, 90, 0.75],
  [0.1, 90, 0], [0.9, -30, 0.9], [0.9, null, 0.9],
])('decay keeps score %s with days elapsed %s within bounds', (score, daysAgo, expected) => {
  const lastPracticedAt = daysAgo === null ? null : new Date(NOW.getTime() - daysAgo * DAY);
  expect(calculateDecayedConfidence(score, lastPracticedAt)).toBeCloseTo(expected);
});

test('progress reads decay scores without changing the stored score or practice timestamp', async () => {
  const record = progress();
  model.find.mockResolvedValue([record]);
  const res = response();
  const next = vi.fn();

  await getConceptProgress(request(), res, next);
  await getConceptProgress(request(), res, next);

  for (const [body] of (res.json as Mock).mock.calls) {
    expect(body[0].confidenceScore).toBeCloseTo(0.85);
    expect(body[0].conceptName).toBe('Polynomial');
    expect(body[0].lastAttempted).toEqual(record.lastAttempted);
  }
  expect(record.confidenceScore).toBe(0.9);
  expect(record.save).not.toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();
});

// The stored 0.9 was last practised 30 days ago, so the update starts from the decayed 0.85
test.each([
  [true, false, 0.966037736],
  [true, true, 0.966037736],
  [false, false, 0.473170732],
])('progress applies decay, then the Bayesian update, for correct=%s retry=%s', async (isCorrect, isRetry, expected) => {
  const record = progress();
  model.findOne.mockResolvedValue(record);
  const res = response();
  const next = vi.fn();

  await updateConceptProgress(request({ conceptId: 'topic1', isCorrect, isRetry }), res, next);

  expect(record.confidenceScore).toBeCloseTo(expected);
  expect(record.lastAttempted).toEqual(NOW);
  expect(record.save).toHaveBeenCalledTimes(1);
  expect(next).not.toHaveBeenCalled();
});

test('a correct answer after 30 days starts from the decayed score, not the stored 1', async () => {
  const record = progress(1);
  model.findOne.mockResolvedValue(record);
  const next = vi.fn();
  await updateConceptProgress(request({ conceptId: 'topic1', isCorrect: true, isRetry: false }), response(), next);
  // 1 decays to 0.95 over 30 days before the update is applied
  expect(record.confidenceScore).toBeCloseTo(0.989595376);
  expect(next).not.toHaveBeenCalled();
});

test('new concepts start with Bayesian initial mastery of 0.2', async () => {
  const record = progress(0.2, 0);
  model.findOne.mockResolvedValue(null);
  model.mockImplementationOnce(function () { return record; });
  const next = vi.fn();

  await updateConceptProgress(request({ conceptId: 'topic1', isCorrect: true, isRetry: false }), response(), next);

  expect(record.confidenceScore).toBeCloseTo(0.576470588);
  expect(record.lastAttempted).toEqual(NOW);
  expect(record.save).toHaveBeenCalledTimes(1);
  expect(next).not.toHaveBeenCalled();
});

test.each(['A', 'SKIPPED'])('website verification uses atomic Bayesian update for %s', async userAnswer => {
  const record = progress();
  model.findOne.mockResolvedValue(record);
  model.findOneAndUpdate.mockResolvedValue(record);
  const res = response();

  await verifyAnswer(request({
    question: 'Pick A',
    userAnswer,
    correctAnswer: 'A',
    conceptId: 'topic1',
    isRetry: false,
  }), res);

  expect(model.updateOne).toHaveBeenCalledTimes(1);
  expect(model.findOneAndUpdate).toHaveBeenCalledTimes(1);

  const [filter, pipeline] = model.findOneAndUpdate.mock.calls[0];

  expect(filter.submissionIds).toEqual({ $ne: 'test-submission-1' });
  expect(pipeline[0].$set.submissionIds).toEqual({
    $setUnion: [
      { $ifNull: ['$submissionIds', []] },
      ['test-submission-1'],
    ],
  });
  expect(pipeline[0].$set.confidenceScore).toBeDefined();
  expect(pipeline[0].$set.lastAttempted).toEqual(NOW);

  expect(record.save).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalled();
});

test('saving quiz history does not change confidence or practice timestamp', async () => {
  const record = progress();
  model.findOne.mockResolvedValue(record);
  historyModel.mockImplementationOnce(function () { return { save: vi.fn().mockResolvedValue({ _id: 'quiz1' }) }; });
  const next = vi.fn();

  await saveQuizHistory(request({ concepts: [{ conceptID: 'topic1', name: 'Polynomial' }],
    questions: [{ questionText: 'Pick A', userAnswer: 'A', correctAnswer: 'A', explanation: 'A' }],
  }), response(), next);

  expect(record.confidenceScore).toBeCloseTo(0.9);
  expect(record.lastAttempted).toEqual(new Date(NOW.getTime() - 30 * DAY));
  expect(record.save).not.toHaveBeenCalled();
  expect(model.updateOne).toHaveBeenCalledWith(
  { user: 'user1', chatId: 'chat1', conceptId: 'topic1' },
  { $set: { conceptName: 'Polynomial' } }
);
  expect(next).not.toHaveBeenCalled();
});

test('saving quiz history after grading does not award points or apply decay twice', async () => {
  const record = progress();
  model.findOne.mockResolvedValue(record);
  historyModel.mockImplementationOnce(function () { return { save: vi.fn().mockResolvedValue({ _id: 'quiz1' }) }; });
  const next = vi.fn();

  await verifyAnswer(request({ question: 'Pick A', userAnswer: 'A', correctAnswer: 'A',
    conceptId: 'topic1', isRetry: false }), response());
  await saveQuizHistory(request({ concepts: [{ conceptID: 'topic1', name: 'Polynomial' }],
    questions: [{ questionText: 'Pick A', userAnswer: 'A', correctAnswer: 'A', explanation: 'A' }],
  }), response(), next);
  model.find.mockResolvedValue([record]);
  const res = response();
  await getConceptProgress(request(), res, next);

  expect(record.confidenceScore).toBeCloseTo(0.9);
  expect((res.json as Mock).mock.calls[0][0][0].confidenceScore).toBeCloseTo(0.85);
  expect(record.lastAttempted).toEqual(new Date(NOW.getTime() - 30 * DAY));
  expect(record.save).not.toHaveBeenCalled();
  expect(model.findOneAndUpdate).toHaveBeenCalledTimes(1);
  expect(next).not.toHaveBeenCalled();
});

test('processing quiz history does not replay old answers', async () => {
  const record = progress(0.9, 60);
  const practicedAt = new Date(NOW.getTime() - 30 * DAY);
  model.findOne.mockResolvedValue(record);
  historyModel.find.mockResolvedValue([{ concepts: [{ conceptID: 'topic1', name: 'Polynomial' }],
    questions: [{ userAnswer: 'A', correctAnswer: 'A', timestamp: practicedAt }],
  }]);
  const next = vi.fn();

  await processAllQuizHistory(request(), response(), next);

  expect(record.confidenceScore).toBeCloseTo(0.9);
  expect(record.lastAttempted).toEqual(new Date(NOW.getTime() - 60 * DAY));
  expect(record.save).not.toHaveBeenCalled();
  expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();
});

test('processing older history cannot move the decay baseline behind recent practice', async () => {
  const record = progress(0.9, 0);
  model.findOne.mockResolvedValue(record);
  historyModel.find.mockResolvedValue([{ concepts: [{ conceptID: 'topic1', name: 'Polynomial' }],
    questions: [{ userAnswer: 'A', correctAnswer: 'A', timestamp: new Date(NOW.getTime() - 30 * DAY) }],
  }]);
  const next = vi.fn();

  await processAllQuizHistory(request(), response(), next);

  expect(record.lastAttempted).toEqual(NOW);
  expect(next).not.toHaveBeenCalled();
});
