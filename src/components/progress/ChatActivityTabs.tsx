import { useId, useRef, useState, type ReactNode, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAssessments } from '../../hooks/useAssessments';
import { assessmentLink, assessmentScore, assessmentStatus, type AssessmentKind } from '../../lib/assessmentHistory';

const button = 'cursor-pointer border border-[#b9c7c4] bg-white px-3 py-2 text-[11px] font-semibold text-teal-dark hover:bg-teal-pale disabled:cursor-default disabled:opacity-50';

function Assessments({ chatId, kind }: { chatId: string; kind: AssessmentKind }) {
  const data = useAssessments(chatId, kind);
  const navigate = useNavigate();
  if (data.loading) return <p className="px-3.5 py-4 text-xs" role="status">Loading {kind === 'quiz' ? 'quizzes' : 'practice exams'}…</p>;
  if (data.error) return <div className="p-3.5 text-xs"><p role="alert">{data.error}</p><button className={button} onClick={data.retry}>Retry</button></div>;
  return <div>
    {!data.items.length && <p className="m-0 p-3.5 text-xs text-[#6f7d7a]">No {kind === 'quiz' ? 'quizzes' : 'practice exams'} saved for this chat yet.</p>}
    {data.items.map(item => <div key={item.id} className="border-t border-[#e3e8e7] p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 text-xs">
          <strong className="block break-words">{item.title}</strong>
          <p className="mb-1 mt-1 text-[#6f7d7a]">{assessmentStatus(item.status)} · {new Date(item.completedAt || item.createdAt).toLocaleString()}</p>
          <span>{item.legacy ? 'Score unavailable for this older quiz' :
            assessmentScore(item.score, item.total) ? `${kind === 'exam' ? 'Last graded score: ' : 'Score: '}${assessmentScore(item.score, item.total)}` :
              kind === 'quiz' ? `${item.total} questions · Not scored yet` : 'Not scored yet'}</span>
        </div>
        <button className={button} onClick={() => navigate(assessmentLink(chatId, kind, item.id))}>
          {kind === 'exam' ? 'Open exam' : item.status === 'completed' ? 'Review quiz' : 'Resume quiz'}
        </button>
      </div>
      {!!item.attempts?.length && <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-teal-dark">Attempts ({item.attempts.length})</summary>
        <ul className="mb-0 list-none p-0">{item.attempts.map((attempt, index) => <li key={attempt.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#e3e8e7] pt-2">
          <span>Attempt {item.attempts!.length - index} · {assessmentStatus(attempt.status)} · {assessmentScore(attempt.score, attempt.total) || 'Not scored yet'}</span>
          <button className={button} onClick={() => navigate(assessmentLink(chatId, 'exam', item.id, attempt.id))}>
            {attempt.status === 'submitted' ? 'View results' : 'Open attempt'}
          </button>
        </li>)}</ul>
      </details>}
    </div>)}
    {data.total > data.limit && <nav aria-label="Assessment pages" className="flex items-center justify-between gap-2 border-t border-[#e3e8e7] p-3.5 text-xs">
      <button className={button} disabled={data.offset === 0} onClick={() => data.setOffset(n => Math.max(0, n - data.limit))}>Previous</button>
      <span>{data.offset + 1}–{Math.min(data.offset + data.limit, data.total)} of {data.total}</span>
      <button className={button} disabled={data.offset + data.limit >= data.total} onClick={() => data.setOffset(n => n + data.limit)}>Next</button>
    </nav>}
  </div>;
}

export default function ChatActivityTabs({ chatId, children }: { chatId: string; children: ReactNode }) {
  const [tab, setTab] = useState(0);
  const id = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const labels = ['Confidence', 'Quizzes', 'Practice exams'];
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 :
      event.key === 'Home' ? 0 : event.key === 'End' ? 2 : undefined;
    if (next !== undefined) { event.preventDefault(); setTab(next); buttons.current[next]?.focus(); }
  };
  return <>
    <div role="tablist" aria-label="Study activity" className="flex flex-wrap gap-1 border-t border-[#e3e8e7] p-2">
      {labels.map((label, index) => <button key={label} ref={element => { buttons.current[index] = element; }}
        id={`${id}-tab-${index}`} role="tab" aria-selected={tab === index} aria-controls={`${id}-panel`}
        tabIndex={tab === index ? 0 : -1} onKeyDown={event => onKeyDown(event, index)} onClick={() => setTab(index)}
        className={`cursor-pointer px-3 py-2 text-[11px] font-semibold ${tab === index ? 'bg-teal text-white' : 'bg-[#f0f4f3] text-[#4d5b58] hover:bg-teal-pale'}`}>{label}</button>)}
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`} tabIndex={0}>
      {tab === 0 ? children : <Assessments key={tab} chatId={chatId} kind={tab === 1 ? 'quiz' : 'exam'} />}
    </div>
  </>;
}
