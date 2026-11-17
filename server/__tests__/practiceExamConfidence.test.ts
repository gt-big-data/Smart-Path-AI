import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import User from '../models/User';
import Exam from '../models/PracticeExam';
import Attempt from '../models/PracticeExamAttempt';
import { pythonServiceClient } from '../utils/axiosConfig';
import { updateConfidenceScore } from '../services/confidence';
import { submit } from '../controllers/practiceExamController.ts';

vi.mock('../services/confidence', () => ({ updateConfidenceScore: vi.fn() }));
const examId = '111111111111111111111111';
const attemptId = '222222222222222222222222';
const part = (id: string) => ({ id, points: 5, answer: 'key', explanation: 'Explanation' });
const exam = { _id: examId, chat_id: 'chat1', exam: { total_points: 10,
  sections: [{ questions: [
    { id: 'q1', concept_ids: ['topic1', 'topic1', 'topic2'], parts: [part('a'), part('b')] },
    { id: 'failed', error: 'Generation failed', concept_ids: ['ignored'], parts: [] },
  ] }] } };
const grading = { score: 7, total: 10, results: [
  { part_id: 'a', points_earned: 2, points_possible: 5, feedback: 'Partial credit' },
  { part_id: 'b', points_earned: 5, points_possible: 5, feedback: 'Correct' },
] };
const attempt = { _id: attemptId, exam_id: examId, status: 'draft', revision: 0, answers: [] };
const req = { params: { examId, attemptId }, body: { revision: 0 }, session: { passport: { user: 'user1' } } };

beforeEach(() => {
  vi.stubEnv('PRACTICE_EXAM_SERVICE_TOKEN', 'test-token');
  vi.spyOn(User, 'findById').mockResolvedValue({ chats: [{ chat_id: 'chat1' }] } as any);
  vi.spyOn(Exam, 'findOne').mockReturnValue({ select: vi.fn().mockResolvedValue(exam) } as any);
  vi.spyOn(Attempt, 'findOne').mockResolvedValue(attempt as any);
  vi.spyOn(Attempt, 'findOneAndUpdate').mockResolvedValueOnce({ ...attempt, status: 'grading', revision: 1 } as any)
    .mockResolvedValueOnce({ ...attempt, status: 'submitted', revision: 2, grading } as any);
  vi.spyOn(Attempt, 'updateOne').mockResolvedValue({ matchedCount: 1 } as any);
  vi.spyOn(pythonServiceClient, 'post').mockResolvedValue({ data: grading });
  vi.mocked(updateConfidenceScore).mockResolvedValue({} as any);
});
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllEnvs(); });

test.each([[7, true], [6, false]])('question score %s/10 produces correct=%s for each linked concept', async (score, correct) => {
  vi.mocked(pythonServiceClient.post).mockResolvedValueOnce({ data: { ...grading, score,
    results: [{ ...grading.results[0], points_earned: score as number - 5 }, grading.results[1]] } });
  await submit(req as any, { json: vi.fn() } as any);
  expect(updateConfidenceScore).toHaveBeenCalledTimes(2);
  expect(updateConfidenceScore).toHaveBeenCalledWith('user1', 'chat1', 'topic1', correct, `${attemptId}:q1`);
  expect(updateConfidenceScore).toHaveBeenCalledWith('user1', 'chat1', 'topic2', correct, `${attemptId}:q1`);
});

test('an already submitted attempt does not update progress or grade again', async () => {
  vi.mocked(Attempt.findOne).mockResolvedValueOnce({ ...attempt, status: 'submitted', grading } as any);
  await submit(req as any, { json: vi.fn() } as any);
  expect(updateConfidenceScore).not.toHaveBeenCalled();
  expect(pythonServiceClient.post).not.toHaveBeenCalled();
});

test('progress failure keeps grading for retry and marks the attempt failed', async () => {
  vi.mocked(updateConfidenceScore).mockRejectedValueOnce(new Error('Progress unavailable'));
  await expect(submit(req as any, { json: vi.fn() } as any)).rejects.toThrow('Progress unavailable');
  expect(Attempt.updateOne).toHaveBeenNthCalledWith(1, expect.anything(), { $set: { grading: expect.anything() } });
  expect(Attempt.updateOne).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({
    $set: expect.objectContaining({ status: 'grading_failed' }),
  }));
});

test('retrying saved grading does not call the AI grader again', async () => {
  vi.mocked(Attempt.findOneAndUpdate).mockReset().mockResolvedValueOnce({ ...attempt, revision: 1, grading } as any)
    .mockResolvedValueOnce({ ...attempt, status: 'submitted', grading } as any);
  await submit(req as any, { json: vi.fn() } as any);
  expect(pythonServiceClient.post).not.toHaveBeenCalled();
  expect(updateConfidenceScore).toHaveBeenCalledTimes(2);
});
