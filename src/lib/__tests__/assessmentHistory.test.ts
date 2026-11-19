import { describe, expect, it } from 'vitest';
import { assessmentLink, assessmentScore, assessmentStatus } from '../assessmentHistory';

describe('assessment history display and navigation', () => {
  it('distinguishes ungraded work from an earned zero and excludes a zero denominator', () => {
    expect(assessmentScore(null, 5)).toBeUndefined();
    expect(assessmentScore(0, 5)).toBe('0/5 (0%)');
    expect(assessmentScore(0, 0)).toBe('Not scored');
    expect(assessmentScore(3, 5)).toBe('3/5 (60%)');
  });
  it('links to the exact owning chat, exam and attempt without losing encoded IDs', () => {
    const url = new URL(assessmentLink('chat & 1', 'exam', 'exam-2', 'attempt-3'), 'https://local.test');
    expect(url.pathname).toBe('/chat');
    expect(Object.fromEntries(url.searchParams)).toEqual({ chat_id: 'chat & 1', assessment: 'exam',
      assessment_id: 'exam-2', attempt_id: 'attempt-3', from: 'progress' });
  });
  it('labels unfinished and failed grading without inventing scores', () => {
    expect(assessmentStatus('draft')).toBe('In progress');
    expect(assessmentStatus('grading_failed')).toContain('answers saved');
    expect(assessmentStatus('not_started')).toBe('Not started');
  });
});
