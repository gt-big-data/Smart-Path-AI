import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import ConceptProgress from '../models/ConceptProgress';
import { updateConfidenceScore } from '../services/confidence.ts';

vi.mock('../models/ConceptProgress', () => ({ default: { findOne: vi.fn(), findOneAndUpdate: vi.fn() } }));
const model = vi.mocked(ConceptProgress);
const now = new Date('2026-11-13T12:00:00Z');
const existing = (score: number) => ({ _id: 'record1', confidenceScore: score,
  lastAttempted: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) });
function found(value: unknown) {
  model.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(value) } as any);
}
beforeEach(() => {
  vi.useFakeTimers().setSystemTime(now);
  vi.clearAllMocks();
  model.findOneAndUpdate.mockResolvedValue({ confidenceScore: 0.6 } as any);
});
afterEach(() => vi.useRealTimers());

test.each([
  [undefined, true, 0.57647],
  [0.9, true, 0.96604],
  [0.9, false, 0.47317],
  [1, true, 0.98960],
  [0.05, false, 0.1],
])('confidence %s, correct=%s becomes %s', async (score, correct, expected) => {
  found(score === undefined ? null : existing(score));
  await updateConfidenceScore('user1', 'chat1', 'topic1', correct, 'attempt1:q1');
  const [filter, update, options] = model.findOneAndUpdate.mock.calls[0] as any[];
  const key = { user: 'user1', chatId: 'chat1', conceptId: 'topic1' };
  expect(model.findOne).toHaveBeenCalledWith(key);
  expect(filter).toMatchObject({ ...key, examProgressUpdates: { $ne: 'attempt1:q1' } });
  expect(update.$set.confidenceScore).toBeCloseTo(expected, 5);
  expect(update.$set.lastAttempted).toEqual(now);
  expect(update.$addToSet.examProgressUpdates).toBe('attempt1:q1');
  expect(options.upsert).toBe(score === undefined);
});

test('a repeated question update does not change confidence', async () => {
  found({ ...existing(0.6), examProgressUpdates: ['attempt1:q1'] });
  await updateConfidenceScore('user1', 'chat1', 'topic1', true, 'attempt1:q1');
  expect(model.findOneAndUpdate).not.toHaveBeenCalled();
});

test('a concurrent write causes a fresh read before updating', async () => {
  found(existing(0.9));
  model.findOneAndUpdate.mockResolvedValueOnce(null);
  await updateConfidenceScore('user1', 'chat1', 'topic1', true, 'attempt1:q1');
  expect(model.findOne).toHaveBeenCalledTimes(2);
});

test('persistence failures are surfaced to the submission retry flow', async () => {
  found(existing(0.9));
  model.findOneAndUpdate.mockRejectedValueOnce(new Error('Database unavailable'));
  await expect(updateConfidenceScore('user1', 'chat1', 'topic1', true, 'attempt1:q1')).rejects.toThrow('Database unavailable');
});
