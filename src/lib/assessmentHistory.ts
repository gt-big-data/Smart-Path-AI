export type AssessmentKind = 'quiz' | 'exam';
export interface AssessmentAttempt {
  id: string; status: string; score: number | null; total: number; createdAt: string;
}
export interface AssessmentSummary {
  id: string; kind: AssessmentKind; title: string; status: string; createdAt: string;
  completedAt?: string; score: number | null; total: number; legacy?: boolean;
  attempts?: AssessmentAttempt[];
}
export function assessmentLink(chatId: string, kind: AssessmentKind, id: string, attemptId?: string) {
  const params = new URLSearchParams({ chat_id: chatId, assessment: kind, assessment_id: id, from: 'progress' });
  if (attemptId) params.set('attempt_id', attemptId);
  return `/chat?${params}`;
}
export function assessmentScore(score: number | null | undefined, total: number) {
  if (score == null) return undefined;
  return total > 0 ? `${score}/${total} (${Math.round(score / total * 100)}%)` : 'Not scored';
}
export function assessmentStatus(status: string) {
  return ({ draft: 'In progress', completed: 'Completed', submitted: 'Graded', grading: 'Grading',
    grading_failed: 'Grading failed — answers saved', not_started: 'Not started' } as Record<string, string>)[status] || status;
}
