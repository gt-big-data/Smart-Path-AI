import { useRef, useState } from 'react';
import Icon from '../common/Icon';

// Chat progress has no function yet. Keep the button and its handler in code; set this to true to show it again.
const SHOW_CHAT_PROGRESS_BUTTON = false;

const actionBase =
  'inline-flex min-h-[34px] items-center gap-[7px] rounded-[2px] border px-3 text-[11px] font-semibold transition-transform hover:-translate-y-px max-[900px]:min-h-[35px] max-[900px]:px-[9px] max-[900px]:[&_svg]:h-3.5 max-[900px]:[&_svg]:w-3.5';
const actionSubtle = `${actionBase} border-[#bdcfcc] bg-[#fbfcfc] text-[#245f59] hover:border-[#72bbb3] hover:bg-[#eef5f4] hover:text-[#0f655e]`;
const actionPrimary = `${actionBase} border-teal bg-teal text-white hover:border-teal-dark hover:bg-teal-dark`;

interface WorkspaceHeaderProps {
  title: string;
  breadcrumb: string;
  hasGraph: boolean;
  /** Saves a new chat name from double-click editing; the title is editable only when provided */
  onRenameTitle?: (title: string) => void;
  onProgress: () => void;
  onQuiz: () => void;
  onExam: () => void;
  onUnavailable: () => void;
}

export default function WorkspaceHeader({
  title,
  breadcrumb,
  hasGraph,
  onRenameTitle,
  onProgress,
  onQuiz,
  onExam,
  onUnavailable,
}: WorkspaceHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  // Mirrors isEditingTitle synchronously, so the blur that follows Enter or Escape doesn't save twice
  const editingRef = useRef(false);

  const startTitleEdit = () => {
    if (!onRenameTitle) return;
    editingRef.current = true;
    setTitleDraft(title);
    setIsEditingTitle(true);
  };

  const finishTitleEdit = (commit: boolean) => {
    if (!editingRef.current) return;
    editingRef.current = false;
    setIsEditingTitle(false);
    const next = titleDraft.trim();
    if (commit && next && next !== title) onRenameTitle?.(next);
  };

  return (
    <header className="flex min-h-17.5 items-center justify-between gap-5 border-b border-line bg-paper px-4.25 max-[900px]:min-h-15 max-[900px]:gap-2.5 max-[900px]:px-4 group-[.sidebar-is-collapsed]:pl-16.25">
      <div className="min-w-0">
        <span className="mb-0.5 block text-[10px] text-muted">{breadcrumb}</span>
        {isEditingTitle ? (
          <input
            autoFocus
            className="box-border h-7 w-[min(100%,460px)] border border-teal bg-white px-1.5 text-xl font-semibold leading-6.5 text-ink shadow-[0_0_0_3px_rgba(20,125,116,0.15)] outline-none"
            aria-label="Chat name"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => finishTitleEdit(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') finishTitleEdit(true);
              if (e.key === 'Escape') finishTitleEdit(false);
            }}
          />
        ) : (
          <h1
            className={`m-0 truncate text-xl font-semibold leading-7 text-ink max-[900px]:text-lg${onRenameTitle ? ' cursor-text' : ''}`}
            title={onRenameTitle ? `${title} (double-click to rename)` : title}
            onDoubleClick={startTitleEdit}
          >
            {title}
          </h1>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 max-[900px]:flex-nowrap max-[900px]:gap-1">
        {/* Hidden for now: the chat progress button has no function yet but may be used in the future */}
        {SHOW_CHAT_PROGRESS_BUTTON && (
          <button type="button" className={actionSubtle} onClick={onProgress}>
            <Icon name="progress" size={16} />
            <span>Chat progress</span>
          </button>
        )}
        <button type="button" className={actionSubtle} onClick={hasGraph ? onQuiz : onUnavailable}>
          <Icon name="sparkles" size={16} />
          <span>Generate quiz</span>
        </button>
        <button type="button" className={actionPrimary} onClick={hasGraph ? onExam : onUnavailable}>
          <Icon name="book" size={16} />
          <span>Practice exam</span>
        </button>
      </div>
    </header>
  );
}
