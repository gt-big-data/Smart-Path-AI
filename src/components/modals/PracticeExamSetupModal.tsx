import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, X } from "lucide-react";
import { Exam, examApi, errorText } from "../practiceExamApi";
import PracticeExamSamples from "../PracticeExamSamples";
import {
  examButtonClass,
  savedExamRowClass,
  setupEmptyClass,
  setupErrorClass,
  setupHeaderClass,
  setupPagerClass,
  setupSectionClass,
} from "../practiceExamClasses";

const PAGE_SIZE = 20;

interface PracticeExamSetupModalProps {
  chatId: string;
  onClose: () => void;
  /** Receives the exam to open full screen: either a freshly generated one or one picked from the list */
  onOpenExam: (examId: string) => void;
}

/** Exam setup pop-up opened from the workspace header, matching the quiz settings modal */
export default function PracticeExamSetupModal({ chatId, onClose, onOpenExam }: PracticeExamSetupModalProps) {
  const [generating, setGenerating] = useState(false);
  const [sampleError, setSampleError] = useState("");
  const [examError, setExamError] = useState("");
  const [exams, setExams] = useState<Exam[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [examsLoading, setExamsLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadExams = useCallback(
    async (page = 0) => {
      setExamsLoading(true);
      try {
        const { data } = await examApi.get("/", {
          params: { chat_id: chatId, limit: PAGE_SIZE, offset: page },
        });
        if (!mounted.current) return;
        setExams(data.exams);
        setTotal(data.total);
        setOffset(page);
        setExamError("");
      } catch (e) {
        if (mounted.current) setExamError(errorText(e));
      } finally {
        if (mounted.current) setExamsLoading(false);
      }
    },
    [chatId],
  );

  useEffect(() => {
    void loadExams();
  }, [loadExams]);

  const close = () => {
    if (!generating) onClose();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !generating) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [generating, onClose]);

  // One banner for every failure in this dialog, so a message never appears twice
  const bannerError = sampleError || examError;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="modal-card max-h-[min(820px,90vh)] w-[min(650px,100%)] overflow-y-auto p-7.25 max-[600px]:px-4.5 max-[600px]:py-5.75"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-setup-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close"
          aria-label="Close exam setup"
          disabled={generating}
          onClick={close}
        >
          <X size={18} aria-hidden="true" />
        </button>
        <span className="modal-icon modal-icon-teal">
          <BookOpen size={19} aria-hidden="true" />
        </span>
        <span className="modal-kicker -mt-1.5 block">EXAM SETUP</span>
        <h2 id="exam-setup-title" className="mb-2 mt-1.25 font-heading text-[22px] tracking-tight text-ink">
          Generate from a sample exam
        </h2>
        <p className="mb-5.25 max-w-142.5 text-[13px] leading-[1.6] text-[#65736f]">
          Upload a sample exam PDF up to 10 MB, or choose one already saved in this chat. SmartPath will use its
          structure with your course material to generate a new practice exam.
        </p>

        {bannerError && (
          <p role="alert" className={setupErrorClass}>
            {bannerError}
          </p>
        )}

        <PracticeExamSamples
          chatId={chatId}
          onBusyChange={setGenerating}
          onError={setSampleError}
          onGenerated={(exam) => onOpenExam(exam.id)}
        />

        <section className={setupSectionClass} aria-label="Saved exams">
          <header className={setupHeaderClass}>
            <div className="grid gap-0.75">
              <strong className="text-[11px] text-[#34423f]">Saved exams ({total})</strong>
              <span className="text-[9px] text-[#83908d]">Generated exams remain available in this chat.</span>
            </div>
            <button
              type="button"
              className={examButtonClass("neutral", "compact")}
              disabled={generating || examsLoading}
              onClick={() => void loadExams(offset)}
            >
              Refresh
            </button>
          </header>
          {examsLoading ? (
            <p role="status" className={setupEmptyClass}>Loading saved exams…</p>
          ) : exams.length ? (
            <div className="grid gap-1.5">
              {exams.map((item) => (
                <div key={item.id} className={savedExamRowClass}>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <strong className="truncate text-[10px] text-ink">{item.title}</strong>
                    <small className="text-[8px] text-[#7c8986]">
                      {item.total_points} points · {new Date(item.created_at).toLocaleString()}
                    </small>
                  </span>
                  <button
                    type="button"
                    className="h-7.25 cursor-pointer border border-teal bg-white px-2.25 text-[9px] font-semibold text-teal-dark disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={generating}
                    onClick={() => onOpenExam(item.id)}
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className={setupEmptyClass}>No saved exams on this page. Generate an exam to begin.</p>
          )}
          {(offset > 0 || total > PAGE_SIZE) && (
            <div className={setupPagerClass}>
              <button
                type="button"
                className={examButtonClass("neutral", "compact")}
                disabled={offset === 0 || generating || examsLoading}
                onClick={() => void loadExams(offset - PAGE_SIZE)}
              >
                Previous
              </button>
              <button
                type="button"
                className={examButtonClass("neutral", "compact")}
                disabled={offset + PAGE_SIZE >= total || generating || examsLoading}
                onClick={() => void loadExams(offset + PAGE_SIZE)}
              >
                Next
              </button>
            </div>
          )}
        </section>

        <div className="modal-actions border-t border-[#d9e2e0] pt-4.25">
          <button type="button" className="modal-button modal-button-ghost" disabled={generating} onClick={close}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
