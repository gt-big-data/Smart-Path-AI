import type { Request, Response } from 'express';
import { afterEach, beforeEach, expect, test, vi, type Mock } from 'vitest';
import ConceptProgress from '../models/ConceptProgress';
import QuizHistory from '../models/QuizHistory';
import { getConceptProgress, updateConceptProgress } from '../controllers/progressController.ts';
import { verifyAnswer } from '../controllers/graphController.ts';
import { saveQuizHistory, processAllQuizHistory } from '../controllers/quizHistoryController.ts';
import { calculateDecayedConfidence } from '../utils/confidenceDecay';

vi.mock('../models/ConceptProgress', () => ({ __esModule: true, default: vi.fn() }));
vi.mock('../models/QuizHistory', () => ({ __esModule: true, default: vi.fn() }));
vi.mock('openai', () => ({ __esModule: true, default: vi.fn(function () { return {
  chat: { completions: { create: vi.fn().mockResolvedValue({ choices: [{ message: {
    content: JSON.stringify({ score: 100, feedback: 'Correct', thinkingPrompt: 'Why?' }),
  } }] }) } },
}; }) }));
vi.mock('../utils/axiosConfig', () => ({ pythonServiceClient: {} }));

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-01T12:00:00Z');
const model = ConceptProgress as unknown as Mock & { find: Mock; findOne: Mock };
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
  return { session: { passport: { user: 'user1' } }, body } as unknown as Request;
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
  historyModel.find = vi.fn();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
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

test.each([
  [true, false, 0.95], [true, true, 0.9], [false, false, 0.75],
])('progress updates decay before applying correct=%s retry=%s', async (isCorrect, isRetry, expected) => {
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

test('a correct answer after 30 days applies decay before clamping at one', async () => {
  const record = progress(1);
  model.findOne.mockResolvedValue(record);
  const next = vi.fn();
  await updateConceptProgress(request({ conceptId: 'topic1', isCorrect: true, isRetry: false }), response(), next);
  expect(record.confidenceScore).toBe(1);
  expect(next).not.toHaveBeenCalled();
});

test('new concepts retain the neutral starting score before their first answer', async () => {
  const record = progress(0.5, 0);
  model.findOne.mockResolvedValue(null);
  model.mockImplementationOnce(function () { return record; });
  const next = vi.fn();

  await updateConceptProgress(request({ conceptId: 'topic1', isCorrect: true, isRetry: false }), response(), next);

  expect(record.confidenceScore).toBeCloseTo(0.6);
  expect(record.lastAttempted).toEqual(NOW);
  expect(record.save).toHaveBeenCalledTimes(1);
  expect(next).not.toHaveBeenCalled();
});

test.each(['A', 'SKIPPED'])('website verification updates decayed MongoDB progress for %s', async userAnswer => {
  const record = progress();
  model.findOne.mockResolvedValue(record);
  const res = response();

  await verifyAnswer(request({ question: 'Pick A', userAnswer, correctAnswer: 'A',
    conceptId: 'topic1', isRetry: false }), res);

  expect(record.confidenceScore).toBeCloseTo(userAnswer === 'A' ? 0.95 : 0.75);
  expect(record.lastAttempted).toEqual(NOW);
  expect(record.save).toHaveBeenCalledTimes(1);
  expect(res.json).toHaveBeenCalled();
});

test('quiz-history saves preserve accrued decay when resetting the practice timestamp', async () => {
  const record = progress();
  model.findOne.mockResolvedValue(record);
  historyModel.mockImplementationOnce(function () { return { save: vi.fn().mockResolvedValue({ _id: 'quiz1' }) }; });
  const next = vi.fn();

  await saveQuizHistory(request({ concepts: [{ conceptID: 'topic1', name: 'Polynomial' }],
    questions: [{ questionText: 'Pick A', userAnswer: 'A', correctAnswer: 'A', explanation: 'A' }],
  }), response(), next);

  expect(record.confidenceScore).toBeCloseTo(0.85);
  expect(record.lastAttempted).toEqual(NOW);
  expect(record.save).toHaveBeenCalledTimes(1);
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

  expect(record.confidenceScore).toBeCloseTo(0.95);
  expect((res.json as Mock).mock.calls[0][0][0].confidenceScore).toBeCloseTo(0.95);
  expect(record.lastAttempted).toEqual(NOW);
  expect(next).not.toHaveBeenCalled();
});

test('history backfills apply decay at the original practice date', async () => {
  const record = progress(0.9, 60);
  const practicedAt = new Date(NOW.getTime() - 30 * DAY);
  model.findOne.mockResolvedValue(record);
  historyModel.find.mockResolvedValue([{ concepts: [{ conceptID: 'topic1', name: 'Polynomial' }],
    questions: [{ userAnswer: 'A', correctAnswer: 'A', timestamp: practicedAt }],
  }]);
  const next = vi.fn();

  await processAllQuizHistory(request(), response(), next);

  expect(record.confidenceScore).toBeCloseTo(0.95);
  expect(record.lastAttempted).toEqual(practicedAt);
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
