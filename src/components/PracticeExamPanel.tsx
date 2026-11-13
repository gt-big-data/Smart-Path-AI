import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Loader2, X } from "lucide-react";
import { Answer, Attempt, Exam, examApi, errorText, selectedChoices } from "./practiceExamApi";
import MathText from "./MathText";
import { examButtonClass, examFieldClass } from "./practiceExamClasses";

type PendingConfirm = {
  title: string;
  message: string;
  confirmLabel: string;
  tone: "warning" | "submit";
  run: () => void;
};

// Each grade tone is a complete class string (the left border colour is the only tone-specific part).
const GRADE_BASE = "grid gap-1.5 border-l-[3px] bg-[#f7f9f8] px-3.5 py-3 text-[10px] leading-[1.55]";
const GRADE_TONE = {
  correct: "border-l-[#3b9c70]",
  incorrect: "border-l-[#c4474d]",
  partial: "border-l-[#d89b3c]",
} as const;

const gradeTone = (earned: number, possible: number) => {
  if (earned >= possible) return `${GRADE_BASE} ${GRADE_TONE.correct}`;
  if (earned <= 0) return `${GRADE_BASE} ${GRADE_TONE.incorrect}`;
  return `${GRADE_BASE} ${GRADE_TONE.partial}`;
};

const CHOICE_BASE =
  "relative grid min-h-11 cursor-pointer grid-cols-[25px_minmax(0,1fr)] items-center gap-2.5 border px-3 py-2 text-[11px] [transition:border-color_0.15s_ease,background_0.15s_ease] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-teal";
const CHOICE_IDLE = "border-[#d8e0de] bg-white text-[#4b5956] hover:border-[#73aaa4] hover:bg-[#f5faf9]";
const CHOICE_SELECTED = "border-teal bg-[#edf7f5] text-teal-dark";

const LETTER_BASE = "grid h-[25px] w-[25px] place-items-center border text-[9px]";
const LETTER_IDLE = "border-[#c3cecc]";
const LETTER_SELECTED = "border-teal bg-teal text-white";

const BACK_BUTTON = "justify-self-start";
const SUBMIT_BUTTON = "justify-self-end max-[600px]:hidden";

const SECTION_CARD = "grid gap-3.5 border border-[#ccd8d5] bg-paper p-[clamp(18px,3vw,26px)]";
const QUESTION_CARD = "m-0 grid gap-3.5 border border-[#ccd8d5] bg-paper p-[clamp(18px,3vw,26px)]";
const ATTEMPT_ROW =
  "w-full cursor-pointer border border-[#c7d1cf] bg-white px-3 py-2.5 text-left text-[10px] text-[#263331] enabled:hover:border-[#73aaa4] enabled:hover:bg-[#f5faf9] disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Full-screen practice exam view opened from the chat: takes one exam with autosaved answers,
 * submits it for grading and shows the results. Exams are chosen in the exam setup modal.
 */
export default function PracticeExamPanel({
  chatId,
  examId,
  title,
  onClose,
}: {
  chatId: string;
  examId: string;
  title: string;
  onClose: () => void;
}) {
  const [exam, setExam] = useState<Exam>();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [attempt, setAttempt] = useState<Attempt>();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const current = useRef<Attempt>();
  const latest = useRef<Record<string, string>>({});
  const dirty = useRef(false);
  const paused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const saving = useRef<Promise<void>>();
  const requestId = useRef<string>();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  const loadExam = useCallback(async (id: string) => {
    const [detail, history] = await Promise.all([
      examApi.get(`/${id}`),
      examApi.get(`/${id}/attempts`),
    ]);
    if (!mounted.current) return;
    setExam(detail.data);
    setAttempts(history.data.attempts);
    setAttempt(undefined);
    current.current = undefined;
    setAnswers({});
    latest.current = {};
    requestId.current = undefined;
    setSaveStatus("");
  }, []);

  const adopt = (value: Attempt) => {
    current.current = value;
    setAttempt(value);
    latest.current = Object.fromEntries(
      value.answers.map((a) => [a.part_id, a.user_answer]),
    );
    setAnswers(latest.current);
    dirty.current = false;
    paused.current = false;
    setBlocked(false);
    setSaveStatus("All answers saved");
  };
  const flush = async (): Promise<void> => {
    clearTimeout(timer.current);
    if (saving.current) {
      await saving.current;
      return flush();
    }
    if (paused.current)
      throw new Error(
        "Reload the saved attempt before continuing. Your unsaved answers remain visible.",
      );
    if (!dirty.current || !current.current || !exam) return;
    const snapshot = latest.current;
    const active = current.current;
    setSaveStatus("Saving…");
    const task = (async () => {
      try {
        const payload: Answer[] = Object.entries(snapshot).map(
          ([part_id, user_answer]) => ({ part_id, user_answer }),
        );
        const { data } = await examApi.patch(
          `/${exam.id}/attempts/${active.id}`,
          { revision: active.revision, answers: payload },
        );
        current.current = data.attempt;
        setAttempt(data.attempt);
        dirty.current = latest.current !== snapshot;
        setSaveStatus(dirty.current ? "Unsaved changes" : "All answers saved");
      } catch (e) {
        paused.current = true;
        setBlocked(true);
        setSaveStatus("Answers not saved");
        setError(errorText(e));
        throw e;
      }
    })();
    saving.current = task;
    try {
      await task;
    } finally {
      saving.current = undefined;
    }
    if (dirty.current) return flush();
  };
  const act = async (label: string, action: () => Promise<void>) => {
    if (busy) return;
    setBusy(label);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(errorText(e));
    } finally {
      if (mounted.current) setBusy("");
    }
  };
  const close = () =>
    void act("Saving before closing…", async () => {
      try {
        await flush();
      } catch {
        // Panels stay mounted, retaining the unsaved draft and recovery controls.
        return;
      }
      onClose();
    });

  // Open the exam this view was started for; runs once per exam
  useEffect(() => {
    void act("Opening exam…", () => loadExam(examId));
    // act is recreated on every render, so only the exam id drives this effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  // Save pending answers if the panel unmounts first, for example when the user switches chats
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(
    () => () => {
      if (dirty.current) void flushRef.current().catch(() => {});
    },
    [],
  );


  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current || saving.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  useEffect(() => {
    if (attempt?.status !== "grading" || !exam) return;
    let cancelled = false;
    const poll = setInterval(() => {
      void examApi
        .get(`/${exam.id}/attempts/${attempt.id}`)
        .then(({ data }) => {
          if (!cancelled) {
            current.current = data.attempt;
            setAttempt(data.attempt);
          }
        })
        .catch((e) => {
          if (!cancelled) setError(errorText(e));
        });
    }, 4000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [attempt?.id, attempt?.status, exam]);

  const changeAnswer = (id: string, value: string) => {
    latest.current = { ...latest.current, [id]: value };
    setAnswers(latest.current);
    dirty.current = true;
    setSaveStatus("Unsaved changes");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flush().catch(() => {});
    }, 700);
  };
  const editable =
    attempt &&
    ["draft", "grading_failed"].includes(attempt.status) &&
    !busy &&
    !blocked;
  const parts =
    exam?.exam.sections.flatMap((s) => s.questions.filter((q) => !q.error).flatMap((q) => q.parts)) ??
    [];
  const answeredCount = parts.filter((p) =>
    p.type === "multi_select" ? selectedChoices(answers[p.id]).length : answers[p.id]?.trim(),
  ).length;

  // Destructive or grading actions go through the confirm dialog first
  const askConfirm = (next: PendingConfirm) => setPending(next);
  const confirmPending = () => {
    const next = pending;
    setPending(null);
    next?.run();
  };
  const submitForGrading = () =>
    askConfirm({
      title: "Submit for grading?",
      message: "Submit the saved answers for grading? Unanswered parts receive zero points.",
      confirmLabel: "Submit for grading",
      tone: "submit",
      run: () =>
        void act("Saving answers and grading…", async () => {
          await flush();
          try {
            const { data } = await examApi.post(
              `/${exam!.id}/attempts/${current.current!.id}/submit`,
              { revision: current.current!.revision },
              { timeout: 300_000 },
            );
            adopt(data.attempt);
          } catch (e) {
            try {
              const { data } = await examApi.get(
                `/${exam!.id}/attempts/${current.current!.id}`,
              );
              adopt(data.attempt);
            } catch {
              paused.current = true;
              setBlocked(true);
            }
            throw e;
          }
        }),
    });
  const reloadSaved = () =>
    askConfirm({
      title: "Replace visible answers?",
      message: "Replace your visible answers with the saved version? Copy anything you want to keep first.",
      confirmLabel: "Replace answers",
      tone: "warning",
      run: () =>
        void act("Reloading saved attempt…", async () => {
          const { data } = await examApi.get(
            `/${exam!.id}/attempts/${current.current!.id}`,
          );
          adopt(data.attempt);
        }),
    });

  const canSubmit = !!attempt && attempt.status !== "submitted";

  return (
    <section
      className="relative flex min-h-0 w-full flex-auto flex-col bg-[#fafbfb] font-brand text-[11px] text-[#263331] antialiased [font-synthesis:none]"
      aria-labelledby={`exam-title-${chatId}`}
    >
      <header className="grid min-h-[58px] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3.5 border-b border-[#d8e0de] bg-paper px-[18px] max-[600px]:grid-cols-[auto_1fr] max-[600px]:px-3">
        <button type="button" className={`${examButtonClass()} ${BACK_BUTTON}`} disabled={!!busy} onClick={close}>
          <ArrowLeft size={14} aria-hidden="true" />
          Back to chat
        </button>
        <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
          <span className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[#8d9996]">Practice exam</span>
          <strong id={`exam-title-${chatId}`} className="max-w-full truncate text-[11px] font-semibold text-[#202a29]" title={title}>
            {exam ? exam.title : title}
          </strong>
        </div>
        {exam && canSubmit ? (
          <button
            type="button"
            className={`${examButtonClass("primary")} ${SUBMIT_BUTTON}`}
            disabled={!!busy || blocked}
            onClick={submitForGrading}
          >
            {attempt?.status === "grading" ? "Retry grading" : "Submit exam"}
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
      </header>

      {exam && (
        <div className="flex min-h-[34px] shrink-0 flex-wrap items-center justify-center gap-[18px] border-b border-[#e0e6e4] px-[18px] text-[9px] text-[#75827f]">
          <span>{exam.total_points} points</span>
          {exam.exam.time_limit_minutes ? (
            <span>Suggested time: {exam.exam.time_limit_minutes} minutes (not enforced)</span>
          ) : null}
          <span>{parts.length} scored parts</span>
          {attempt && <span>{attempt.status === "submitted" ? "Submitted" : `Attempt ${attempt.status.replace("_", " ")}`}</span>}
          {attempt && attempt.status !== "submitted" && <span role="status">{saveStatus}</span>}
        </div>
      )}

      <div className="grid min-h-0 flex-auto content-start gap-[18px] overflow-y-auto px-[clamp(20px,5vw,56px)] pt-7 pb-10 max-[600px]:px-3.5 max-[600px]:pt-[18px] max-[600px]:pb-7">
        {busy && (
          <p role="status" className="m-0 flex items-center gap-2 text-[10px] font-semibold text-teal">
            <Loader2 size={16} aria-hidden="true" className="animate-spin" />
            {busy}
          </p>
        )}
        {error && (
          <div role="alert" className="m-0 border border-[#e1b0b3] bg-[#fdf1f1] px-3.5 py-3 text-[10px] leading-[1.55] text-[#7f3a3e]">
            {error}
          </div>
        )}
        {blocked && (
          <div className="grid m-0 justify-items-start gap-2.5 border border-[#e6cf8f] bg-[#fdf6e3] px-3.5 py-3 text-[10px] leading-[1.55] text-[#8a5a00]">
            <p className="m-0">
              Your local answers are still visible. Reloading replaces them with the last saved answers.
            </p>
            <button type="button" className={examButtonClass()} disabled={!!busy} onClick={reloadSaved}>
              Reload saved answers
            </button>
          </div>
        )}

        {!exam ? null : (
          <>
            <div className="grid gap-2">
              <h3 className="m-0 text-[20px] font-semibold leading-[1.25] tracking-[-0.02em] text-[#202a29]">{exam.title}</h3>
              {exam.sample_pdf_id && (
                <a
                  className="text-[10px] font-semibold text-[#0f655e]"
                  href={`${examApi.defaults.baseURL}/samples/${exam.sample_pdf_id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View sample PDF: {exam.sample_filename || "Original sample"}
                </a>
              )}
              <p className="m-0 text-[10px] leading-[1.55] text-[#8d9996]">{exam.total_points} points</p>
              <p className="m-0 whitespace-pre-wrap text-[11px] leading-[1.6] text-[#4b5956]">
                <MathText>{exam.exam.instructions}</MathText>
              </p>
            </div>

            {!attempt ? (
              <section className={SECTION_CARD}>
                <div>
                  <button
                    type="button"
                    className={examButtonClass("primary")}
                    disabled={!!busy || !parts.length}
                    onClick={() =>
                      void act("Starting attempt…", async () => {
                        requestId.current ??= crypto.randomUUID();
                        const { data } = await examApi.post(
                          `/${exam.id}/attempts`,
                          { request_id: requestId.current },
                        );
                        adopt(data.attempt);
                        requestId.current = undefined;
                      })
                    }
                  >
                    Start new attempt
                  </button>
                </div>
                <h4 className="m-0 text-xs font-semibold text-[#202a29]">Attempt history</h4>
                {!attempts.length && <p className="m-0 text-[10px] leading-[1.55] text-[#687572]">No attempts yet.</p>}
                <div className="grid gap-2">
                  {attempts.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={ATTEMPT_ROW}
                      disabled={!!busy}
                      onClick={() =>
                        void act("Loading attempt…", async () => {
                          const { data } = await examApi.get(`/${exam.id}/attempts/${a.id}`);
                          adopt(data.attempt);
                        })
                      }
                    >
                      {new Date(a.created_at).toLocaleString()} · {a.status.replace("_", " ")}{" "}
                      {a.grading ? `· ${a.grading.score}/${a.grading.total}` : ""}
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              <section className="grid gap-2.5 border border-[#b5d6cf] bg-[#edf7f5] px-[18px] py-4">
                <p className="m-0 text-[11px] font-semibold text-[#202a29]">
                  {attempt.status === "submitted"
                    ? `Score: ${attempt.grading?.score} / ${attempt.grading?.total}`
                    : `Attempt: ${attempt.status.replace("_", " ")}`}
                </p>
                <p role="status" className="m-0 text-[10px] leading-[1.55] text-[#687572]">
                  {attempt.status === "grading"
                    ? "Grading in progress. Results refresh automatically. If interrupted, retry after ten minutes."
                    : saveStatus}
                </p>
                {attempt.error && (
                  <p className="m-0 border border-[#e1b0b3] bg-[#fdf1f1] px-3.5 py-3 text-[10px] leading-[1.55] text-[#7f3a3e]">
                    {attempt.error}
                  </p>
                )}
                <div>
                  <button
                    type="button"
                    className={examButtonClass()}
                    disabled={!!busy}
                    onClick={() =>
                      void act("Loading history…", async () => {
                        await flush();
                        const { data } = await examApi.get(`/${exam.id}/attempts`);
                        setAttempts(data.attempts);
                        setAttempt(undefined);
                        current.current = undefined;
                      })
                    }
                  >
                    Attempt history / retake
                  </button>
                </div>
              </section>
            )}

            {exam.exam.sections.map((section, si) => (
              <section key={si} className="grid gap-4">
                <h4 className="m-0 border-b border-[#d8e0de] pb-2.5 text-[15px] font-semibold text-[#202a29]">{section.name}</h4>
                <p className="m-0 text-[10px] leading-[1.55] text-[#687572]">
                  <MathText>{section.instructions}</MathText>
                </p>
                {section.questions.map((q) => (
                  <article key={q.id} className={QUESTION_CARD}>
                    <span className="text-[9px] font-bold uppercase tracking-[0.11em] text-teal">Question {q.label}</span>
                    {q.error && (
                      <p role="status" className="m-0 border border-[#e6cf8f] bg-[#fdf6e3] px-3 py-2.5 text-[10px] leading-[1.5] text-[#8a5a00]">
                        <strong>Question unavailable for scoring.</strong> {q.error} Excluded from the score total.
                      </p>
                    )}
                    <p className="m-0 whitespace-pre-wrap text-[13px] font-medium leading-[1.5] text-[#202a29]">
                      <MathText>{q.stem}</MathText>
                    </p>
                    {q.parts.map((p, pi) => {
                      const selected = selectedChoices(answers[p.id]);
                      const grade = attempt?.grading?.results.find((r) => r.part_id === p.id);
                      const choices =
                        p.type === "tf" ? ["True", "False"] : (p.choices ?? []);
                      const isChoicePart = ["mcq", "tf", "binary", "multi_select"].includes(p.type);
                      return (
                        <div key={p.id} className={p.group_label ? "grid gap-3 border-l-2 border-[#cfe6e2] pl-3.5" : undefined}>
                          {p.group_label && p.group_label !== q.parts[pi - 1]?.group_label && (
                            <h6 className="m-0 text-[11px] font-semibold text-[#202a29]">
                              {p.group_label} <MathText>{p.group_instructions}</MathText>
                            </h6>
                          )}
                          <fieldset disabled={!editable || !!q.error} className="group m-0 grid min-w-0 gap-2.5 border-0 p-0">
                            <legend className="mb-2 p-0 text-[11px] font-medium leading-[1.5] whitespace-pre-wrap text-[#263331]">
                              {p.label} <MathText>{p.prompt}</MathText>{" "}
                              <span className="text-[9px] font-normal text-[#687572]">
                                ({p.points} points{q.error ? "; excluded" : ""})
                              </span>
                            </legend>
                            {isChoicePart ? (
                              <div className="grid gap-2">
                                {choices.map((choice, ci) => {
                                  const checked =
                                    p.type === "multi_select"
                                      ? selected.includes(choice)
                                      : answers[p.id] === choice;
                                  return (
                                    <label
                                      key={choice}
                                      className={`${CHOICE_BASE} group-disabled:opacity-75 ${checked ? CHOICE_SELECTED : CHOICE_IDLE}`}
                                    >
                                      <input
                                        className="sr-only"
                                        type={p.type === "multi_select" ? "checkbox" : "radio"}
                                        name={`${attempt?.id ?? "preview"}-${p.id}`}
                                        checked={checked}
                                        onChange={(e) => {
                                          if (p.type !== "multi_select") return changeAnswer(p.id, choice);
                                          changeAnswer(
                                            p.id,
                                            JSON.stringify(
                                              e.target.checked
                                                ? [...selected, choice]
                                                : selected.filter((c) => c !== choice),
                                            ),
                                          );
                                        }}
                                      />
                                      <span className={`${LETTER_BASE} ${checked ? LETTER_SELECTED : LETTER_IDLE}`} aria-hidden="true">
                                        {String.fromCharCode(65 + ci)}
                                      </span>
                                      <span className="min-w-0 whitespace-pre-wrap">
                                        <MathText>{choice}</MathText>
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : p.type === "numeric" ? (
                              <input
                                aria-label={`Answer ${q.label} ${p.label}`}
                                className={examFieldClass}
                                value={answers[p.id] ?? ""}
                                maxLength={20000}
                                placeholder="Answer, including units"
                                onChange={(e) => changeAnswer(p.id, e.target.value)}
                              />
                            ) : (
                              <textarea
                                aria-label={`Answer ${q.label} ${p.label}`}
                                className={examFieldClass}
                                rows={p.type === "long_answer" ? 6 : 3}
                                maxLength={20000}
                                value={answers[p.id] ?? ""}
                                placeholder="Your answer"
                                onChange={(e) => changeAnswer(p.id, e.target.value)}
                              />
                            )}
                            {grade && (
                              <div className={gradeTone(grade.points_earned, grade.points_possible)}>
                                <p className="m-0 text-[11px] font-semibold text-[#202a29]">
                                  {grade.points_earned} / {grade.points_possible} points
                                </p>
                                <p className="m-0 whitespace-pre-wrap text-[#4b5956]">
                                  <MathText>{grade.feedback}</MathText>
                                </p>
                                <p className="m-0 whitespace-pre-wrap text-[#4b5956]">
                                  <strong>Answer:</strong>{" "}
                                  <MathText>
                                    {p.type === "multi_select"
                                      ? selectedChoices(grade.correct_answer).join("; ")
                                      : grade.correct_answer}
                                  </MathText>
                                </p>
                                <p className="m-0 whitespace-pre-wrap text-[#4b5956]">
                                  <MathText>{grade.explanation}</MathText>
                                </p>
                              </div>
                            )}
                          </fieldset>
                        </div>
                      );
                    })}
                  </article>
                ))}
              </section>
            ))}

            {attempt && attempt.status !== "submitted" && (
              <footer className="flex flex-wrap items-center gap-3 border-t border-[#d8e0de] pt-[18px] text-[10px]">
                <span className="mr-auto text-[#687572]">
                  {answeredCount} / {parts.length} parts answered
                </span>
                <button
                  type="button"
                  className={examButtonClass("primary")}
                  disabled={!!busy || blocked}
                  onClick={submitForGrading}
                >
                  {attempt.status === "grading" ? "Retry interrupted grading" : "Submit for grading"}
                </button>
              </footer>
            )}
          </>
        )}
      </div>

      {pending && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-[rgba(30,37,36,0.5)] p-[18px]">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`confirm-title-${chatId}`}
            aria-describedby={`confirm-text-${chatId}`}
            className="grid w-[min(380px,100%)] box-border gap-3 border border-[#c4cfcd] bg-white p-6"
          >
            <span
              className={`grid h-[38px] w-[38px] place-items-center ${
                pending.tone === "warning" ? "bg-[#fbe8e9] text-[#c4474d]" : "bg-[#edf7f5] text-teal"
              }`}
            >
              {pending.tone === "warning" ? <X size={18} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}
            </span>
            <h3 id={`confirm-title-${chatId}`} className="mt-1 mb-0 text-base font-semibold text-[#202a29]">
              {pending.title}
            </h3>
            <p id={`confirm-text-${chatId}`} className="m-0 text-[11px] leading-[1.6] text-[#687572]">
              {pending.message}
            </p>
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" className={examButtonClass()} onClick={() => setPending(null)}>
                Keep working
              </button>
              <button
                type="button"
                className={examButtonClass(pending.tone === "warning" ? "danger" : "primary")}
                onClick={confirmPending}
              >
                {pending.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
