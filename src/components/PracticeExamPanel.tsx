import { useCallback, useEffect, useRef, useState } from "react";
import { X, FileText, Loader2 } from "lucide-react";
import { Answer, Attempt, Exam, examApi, errorText } from "./practiceExamApi";

const button =
  "rounded-lg border border-teal-600 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed";
const primary = `${button} bg-teal-600 text-white hover:bg-teal-700`;
export default function PracticeExamPanel({
  chatId,
  title,
  open,
  onClose,
}: {
  chatId: string;
  title: string;
  open: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [exam, setExam] = useState<Exam>();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [attempt, setAttempt] = useState<Attempt>();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [blocked, setBlocked] = useState(false);
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

  const loadExams = useCallback(
    async (page = 0) => {
      const { data } = await examApi.get("/", {
        params: { chat_id: chatId, limit: 20, offset: page },
      });
      if (mounted.current) {
        setExams(data.exams);
        setTotal(data.total);
        setOffset(page);
      }
    },
    [chatId],
  );
  useEffect(() => {
    if (open) {
      dialog.current?.showModal();
      void loadExams().catch((e) => setError(errorText(e)));
    } else dialog.current?.close();
  }, [open, loadExams]);

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
      await flush();
      onClose();
    });
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
    if (!open || attempt?.status !== "grading" || !exam) return;
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
  }, [open, attempt?.id, attempt?.status, exam]);

  const selectExam = async (id: string) => {
    await flush();
    const [detail, history] = await Promise.all([
      examApi.get(`/${id}`),
      examApi.get(`/${id}/attempts`),
    ]);
    setExam(detail.data);
    setAttempts(history.data.attempts);
    setAttempt(undefined);
    current.current = undefined;
    setAnswers({});
    latest.current = {};
    requestId.current = undefined;
    setSaveStatus("");
  };
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
    exam?.exam.sections.flatMap((s) => s.questions.flatMap((q) => q.parts)) ??
    [];

  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-labelledby={`exam-title-${chatId}`}
      className="m-auto h-[92vh] w-[min(1100px,96vw)] max-w-none rounded-2xl p-0 text-slate-800 shadow-2xl backdrop:bg-slate-900/50"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b p-5">
          <div>
            <h2 id={`exam-title-${chatId}`} className="text-xl font-semibold">
              Practice exams
            </h2>
            <p className="text-sm text-slate-500">{title}</p>
          </div>
          <button
            className={button}
            disabled={!!busy}
            onClick={close}
            aria-label="Save and close practice exams"
          >
            <X size={20} />
          </button>
        </header>
        <div className="overflow-y-auto p-5 space-y-5">
          {busy && (
            <p role="status" className="flex items-center gap-2 text-teal-700">
              <Loader2 className="animate-spin" size={18} />
              {busy}
            </p>
          )}
          {error && (
            <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
              {error}
            </div>
          )}
          {blocked && (
            <div className="rounded-lg border border-amber-300 p-4">
              <p>
                Your local answers are still visible. Reloading replaces them
                with the last saved answers; copy anything you want to keep
                first.
              </p>
              <button
                className={button}
                disabled={!!busy}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Replace your visible answers with the saved version?",
                    )
                  )
                    return;
                  void act("Reloading saved attempt…", async () => {
                    const { data } = await examApi.get(
                      `/${exam!.id}/attempts/${current.current!.id}`,
                    );
                    adopt(data.attempt);
                  });
                }}
              >
                Reload saved answers
              </button>
            </div>
          )}
          {!exam ? (
            <>
              <section className="rounded-xl border bg-teal-50/50 p-5 space-y-3">
                <h3 className="font-semibold">Generate from a sample exam</h3>
                <p className="text-sm">
                  Your chat’s course material supplies the content. Upload only
                  a sample exam PDF (up to 10 MB). Generation may take several
                  minutes.
                </p>
                <label className="block text-sm font-medium">
                  Sample exam PDF
                  <input
                    className="mt-2 block w-full"
                    type="file"
                    accept=".pdf,application/pdf"
                    disabled={!!busy}
                    onChange={(e) => {
                      setFile(e.target.files?.[0]);
                      setError("");
                    }}
                  />
                </label>
                <button
                  className={primary}
                  disabled={!file || !!busy}
                  onClick={() =>
                    void act(
                      "Generating your exam. This can take several minutes…",
                      async () => {
                        if (!file || !file.name.toLowerCase().endsWith(".pdf"))
                          throw new Error("Choose a PDF file.");
                        if (file.size > 10 * 1024 * 1024)
                          throw new Error(
                            "The sample PDF must be at most 10 MB.",
                          );
                        const form = new FormData();
                        form.append("chat_id", chatId);
                        form.append("practice_exam", file);
                        try {
                          const { data } = await examApi.post("/", form);
                          setExam(data);
                          setAttempts([]);
                          setFile(undefined);
                        } catch (e) {
                          await loadExams().catch(() => {});
                          throw e;
                        }
                      },
                    )
                  }
                >
                  Generate exam
                </button>
              </section>
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Saved exams ({total})</h3>
                <button
                  className={button}
                  disabled={!!busy}
                  onClick={() =>
                    void act("Refreshing exams…", () => loadExams(offset))
                  }
                >
                  Refresh
                </button>
              </div>
              <p className="text-xs text-slate-500">
                After a connection timeout, refresh this list before generating
                again.
              </p>
              {!exams.length && (
                <p className="py-6 text-center text-slate-500">
                  No saved exams on this page. Generate an exam to begin.
                </p>
              )}
              {exams.map((item) => (
                <button
                  key={item.id}
                  disabled={!!busy}
                  onClick={() =>
                    void act("Opening exam…", () => selectExam(item.id))
                  }
                  className="flex w-full items-center gap-3 rounded-xl border p-4 text-left hover:border-teal-500"
                >
                  <FileText className="text-teal-600" />
                  <span className="flex-1">
                    <span className="block font-medium">{item.title}</span>
                    <span className="text-sm text-slate-500">
                      {item.total_points} points ·{" "}
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </span>
                  <span>Open →</span>
                </button>
              ))}
              <div className="flex gap-2">
                <button
                  className={button}
                  disabled={!offset || !!busy}
                  onClick={() =>
                    void act("Loading exams…", () => loadExams(offset - 20))
                  }
                >
                  Previous
                </button>
                <button
                  className={button}
                  disabled={offset + 20 >= total || !!busy}
                  onClick={() =>
                    void act("Loading exams…", () => loadExams(offset + 20))
                  }
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                className={button}
                disabled={!!busy}
                onClick={() =>
                  void act("Saving…", async () => {
                    await flush();
                    setExam(undefined);
                    setAttempt(undefined);
                    current.current = undefined;
                    await loadExams();
                  })
                }
              >
                ← Saved exams
              </button>
              <div>
                <h3 className="text-2xl font-semibold">{exam.title}</h3>
                <p className="text-sm text-slate-500">
                  {exam.total_points} points
                  {exam.exam.time_limit_minutes
                    ? ` · Suggested time: ${exam.exam.time_limit_minutes} minutes (not enforced)`
                    : ""}
                </p>
                <p className="mt-3 whitespace-pre-wrap">
                  {exam.exam.instructions}
                </p>
              </div>
              {!attempt ? (
                <section className="rounded-xl border p-4 space-y-3">
                  <button
                    className={primary}
                    disabled={!!busy}
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
                  <h4 className="font-medium">Attempt history</h4>
                  {!attempts.length && (
                    <p className="text-sm text-slate-500">No attempts yet.</p>
                  )}
                  {attempts.map((a) => (
                    <button
                      key={a.id}
                      className="block w-full rounded-lg border p-3 text-left hover:bg-slate-50"
                      disabled={!!busy}
                      onClick={() =>
                        void act("Loading attempt…", async () => {
                          const { data } = await examApi.get(
                            `/${exam.id}/attempts/${a.id}`,
                          );
                          adopt(data.attempt);
                        })
                      }
                    >
                      {new Date(a.created_at).toLocaleString()} ·{" "}
                      {a.status.replace("_", " ")}{" "}
                      {a.grading
                        ? `· ${a.grading.score}/${a.grading.total}`
                        : ""}
                    </button>
                  ))}
                </section>
              ) : (
                <section className="rounded-xl bg-teal-50 p-4 space-y-2">
                  <p className="font-medium">
                    {attempt.status === "submitted"
                      ? `Score: ${attempt.grading?.score} / ${attempt.grading?.total}`
                      : `Attempt: ${attempt.status.replace("_", " ")}`}
                  </p>
                  <p role="status" className="text-sm">
                    {attempt.status === "grading"
                      ? "Grading in progress. Results refresh automatically. If interrupted, retry after ten minutes."
                      : saveStatus}
                  </p>
                  {attempt.error && (
                    <p className="text-sm text-red-700">{attempt.error}</p>
                  )}
                  <button
                    className={button}
                    disabled={!!busy}
                    onClick={() =>
                      void act("Loading history…", async () => {
                        await flush();
                        const { data } = await examApi.get(
                          `/${exam.id}/attempts`,
                        );
                        setAttempts(data.attempts);
                        setAttempt(undefined);
                        current.current = undefined;
                      })
                    }
                  >
                    Attempt history / retake
                  </button>
                </section>
              )}
              {exam.exam.sections.map((section, si) => (
                <section key={si} className="space-y-4">
                  <h4 className="border-b pb-2 text-lg font-semibold">
                    {section.name}
                  </h4>
                  <p className="whitespace-pre-wrap text-sm">
                    {section.instructions}
                  </p>
                  {section.questions.map((q) => (
                    <article
                      key={q.id}
                      className="rounded-xl border p-5 space-y-4"
                    >
                      <h5 className="font-semibold">Question {q.label}</h5>
                      <p className="whitespace-pre-wrap">{q.stem}</p>
                      {q.parts.map((p) => {
                        const grade = attempt?.grading?.results.find(
                          (r) => r.part_id === p.id,
                        );
                        return (
                          <fieldset
                            key={p.id}
                            disabled={!editable}
                            className="space-y-2"
                          >
                            <legend className="whitespace-pre-wrap font-medium">
                              {p.label} {p.prompt}{" "}
                              <span className="text-sm text-slate-500">
                                ({p.points} points)
                              </span>
                            </legend>
                            {p.type === "mcq" || p.type === "tf" ? (
                              (p.type === "tf"
                                ? ["True", "False"]
                                : (p.choices ?? [])
                              ).map((choice) => (
                                <label
                                  key={choice}
                                  className="flex items-start gap-3 rounded-lg border p-3"
                                >
                                  <input
                                    className="mt-1 accent-teal-600"
                                    type="radio"
                                    name={`${attempt?.id ?? "preview"}-${p.id}`}
                                    checked={answers[p.id] === choice}
                                    onChange={() => changeAnswer(p.id, choice)}
                                  />
                                  <span className="whitespace-pre-wrap">
                                    {choice}
                                  </span>
                                </label>
                              ))
                            ) : p.type === "numeric" ? (
                              <input
                                aria-label={`Answer ${q.label} ${p.label}`}
                                className="w-full rounded-lg border p-3 disabled:bg-slate-50"
                                value={answers[p.id] ?? ""}
                                maxLength={20000}
                                placeholder="Answer, including units"
                                onChange={(e) =>
                                  changeAnswer(p.id, e.target.value)
                                }
                              />
                            ) : (
                              <textarea
                                aria-label={`Answer ${q.label} ${p.label}`}
                                className="w-full rounded-lg border p-3 disabled:bg-slate-50"
                                rows={p.type === "long_answer" ? 6 : 3}
                                maxLength={20000}
                                value={answers[p.id] ?? ""}
                                placeholder="Your answer"
                                onChange={(e) =>
                                  changeAnswer(p.id, e.target.value)
                                }
                              />
                            )}
                            {grade && (
                              <div className="rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-wrap">
                                <p className="font-semibold">
                                  {grade.points_earned} /{" "}
                                  {grade.points_possible} points
                                </p>
                                <p>{grade.feedback}</p>
                                <p className="mt-2">
                                  <strong>Answer:</strong>{" "}
                                  {grade.correct_answer}
                                </p>
                                <p>{grade.explanation}</p>
                              </div>
                            )}
                          </fieldset>
                        );
                      })}
                    </article>
                  ))}
                </section>
              ))}
              {attempt && attempt.status !== "submitted" && (
                <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                  <p className="text-sm">
                    {parts.filter((p) => answers[p.id]?.trim()).length} /{" "}
                    {parts.length} parts answered
                  </p>
                  <button
                    className={primary}
                    disabled={!!busy || blocked}
                    onClick={() => {
                      if (
                        !window.confirm(
                          "Submit the saved answers for grading? Unanswered parts receive zero points.",
                        )
                      )
                        return;
                      void act("Saving answers and grading…", async () => {
                        await flush();
                        try {
                          const { data } = await examApi.post(
                            `/${exam.id}/attempts/${current.current!.id}/submit`,
                            { revision: current.current!.revision },
                            { timeout: 300_000 },
                          );
                          adopt(data.attempt);
                        } catch (e) {
                          try {
                            const { data } = await examApi.get(
                              `/${exam.id}/attempts/${current.current!.id}`,
                            );
                            adopt(data.attempt);
                          } catch {
                            paused.current = true;
                            setBlocked(true);
                          }
                          throw e;
                        }
                      });
                    }}
                  >
                    {attempt.status === "grading"
                      ? "Retry interrupted grading"
                      : "Submit for grading"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
