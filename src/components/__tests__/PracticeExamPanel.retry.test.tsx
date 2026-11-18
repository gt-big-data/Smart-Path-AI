import type { ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PracticeExamPanel from '../PracticeExamPanel';
import { examApi } from '../practiceExamApi';

vi.mock('../MathText', () => ({ default: ({ children }: { children?: ReactNode }) => <span>{children}</span> }));
vi.mock('../../lib/progressCache', () => ({ invalidateProgressCache: vi.fn() }));

const exam = { id: 'exam1', title: 'Practice', total_points: 5, exam: { sections: [{ name: 'Exam', questions: [
  { id: 'q1', label: '1', stem: '', parts: [
    { id: 'p1', label: '', type: 'numeric', prompt: 'What is 2 + 2?', points: 5, choices: null },
  ] },
] }] } };
const savedAttempt = { id: 'attempt1', status: 'grading_failed', revision: 2,
  answers: [{ part_id: 'p1', user_answer: '4' }], created_at: '2026-11-18T12:00:00Z' };
let view: ReactTestRenderer | undefined;

async function openAttempt(locked: boolean) {
  const attempt = { ...savedAttempt, answers_locked: locked };
  vi.spyOn(examApi, 'get').mockImplementation(async url => ({ data:
    url?.endsWith('/attempts') ? { attempts: [attempt] }
      : url?.includes('/attempts/') ? { attempt } : exam,
  } as any));
  await act(async () => { view = create(<PracticeExamPanel chatId="chat1" examId="exam1" title="Practice" onClose={vi.fn()} />); });
  const history = view!.root.findAllByType('button').find(button => button.children.includes('grading failed'))!;
  await act(async () => { history.props.onClick(); });
}

beforeEach(() => {
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(async () => {
  await act(async () => { view?.unmount(); });
  view = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('practice exam submission recovery', () => {
  it.each([true, false])('failed attempts respect answers_locked=%s', async locked => {
    await openAttempt(locked);
    expect(view!.root.findByType('fieldset').props.disabled).toBe(locked);
  });

  it('retries a locked submission without saving or changing its answers', async () => {
    await openAttempt(true);
    const patch = vi.spyOn(examApi, 'patch');
    const post = vi.spyOn(examApi, 'post').mockResolvedValue({ data: {
      attempt: { ...savedAttempt, status: 'submitted', answers_locked: true },
    } });
    const retry = view!.root.findAllByType('button').find(button => button.children.includes('Retry submission'))!;
    expect(retry.props.disabled).toBe(false);
    await act(async () => { retry.props.onClick(); });
    const dialog = view!.root.findByProps({ role: 'alertdialog' });
    const confirm = dialog.findAllByType('button').find(button => button.children.includes('Retry submission'))!;
    await act(async () => { confirm.props.onClick(); });
    expect(patch).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledExactlyOnceWith('/exam1/attempts/attempt1/submit', { revision: 2 }, { timeout: 300_000 });
  });
});
