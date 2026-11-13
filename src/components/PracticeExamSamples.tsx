import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Exam, SamplePdf, examApi, errorText } from "./practiceExamApi";
import {
  examButtonClass,
  samplePickerRowClass,
  samplePickerRowSelectedClass,
  setupEmptyClass,
  setupHeaderClass,
  setupNoteClass,
  setupPagerClass,
  setupSectionClass,
} from "./practiceExamClasses";

const PAGE_SIZE = 20;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

/**
 * Setup step of the practice exam modal: upload or choose a sample exam PDF, then generate an exam from it.
 * Errors are reported to the parent so each message has exactly one place on screen.
 */
export default function PracticeExamSamples({
  chatId,
  onGenerated,
  onBusyChange,
  onError,
}: {
  chatId: string;
  onGenerated: (exam: Exam) => void;
  onBusyChange?: (busy: boolean) => void;
  onError: (message: string) => void;
}) {
  const [samples, setSamples] = useState<SamplePdf[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [selected, setSelected] = useState<SamplePdf>();
  const [file, setFile] = useState<File>();
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    onBusyChange?.(working !== "");
  }, [working, onBusyChange]);

  const loadSamples = useCallback(
    async (page = 0) => {
      setListLoading(true);
      try {
        const { data } = await examApi.get("/samples", {
          params: { chat_id: chatId, limit: PAGE_SIZE, offset: page },
        });
        if (!mounted.current) return;
        setSamples(data.samples);
        setTotal(data.total);
        setOffset(page);
        onError("");
      } catch (e) {
        if (mounted.current) onError(errorText(e));
      } finally {
        if (mounted.current) setListLoading(false);
      }
    },
    [chatId, onError],
  );

  useEffect(() => {
    void loadSamples();
  }, [loadSamples]);

  const run = async (label: string, action: () => Promise<void>) => {
    if (working) return;
    setWorking(label);
    onError("");
    try {
      await action();
    } catch (e) {
      if (mounted.current) onError(errorText(e));
    } finally {
      if (mounted.current) setWorking("");
    }
  };

  const savePdf = async (): Promise<SamplePdf> => {
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) throw new Error("Choose a PDF file.");
    if (file.size > MAX_PDF_BYTES) throw new Error("The sample PDF must be at most 10 MB.");
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("practice_exam", file);
    const { data } = await examApi.post("/samples", form);
    const sample: SamplePdf = data.sample;
    setSelected(sample);
    setFile(undefined);
    if (input.current) input.current.value = "";
    setMessage("PDF saved. You can generate an exam now or reuse it later.");
    await loadSamples();
    return sample;
  };

  const chooseFile = (next?: File) => {
    setFile(next);
    if (next) setSelected(undefined);
    setMessage("");
  };

  const chooseSaved = (sample: SamplePdf) => {
    setSelected(sample);
    setFile(undefined);
    setMessage("");
    if (input.current) input.current.value = "";
  };

  const selectionLabel = file
    ? `New PDF: ${file.name}`
    : selected
      ? `Selected PDF: ${selected.filename}`
      : "Choose a PDF above to generate an exam.";

  return (
    <>
      <section className={setupSectionClass} aria-label="Upload a sample exam">
        <label className="grid gap-[7px] text-[11px] font-semibold text-[#3f4d4a]">
          Upload a new sample exam PDF
          <input
            ref={input}
            type="file"
            accept=".pdf,application/pdf"
            disabled={!!working}
            onChange={(e) => chooseFile(e.target.files?.[0])}
            className="h-auto border border-[#c7d2d0] bg-[#f8faf9] p-[7px] text-[10px] text-[#65736f] disabled:opacity-50 file:mr-2.5 file:h-[30px] file:cursor-pointer file:border file:border-[#b7c8c5] file:bg-white file:px-2.5 file:font-semibold file:text-[#40504d]"
          />
        </label>
        <div className={setupPagerClass}>
          <button
            type="button"
            className={examButtonClass("neutral", "compact")}
            disabled={!file || !!working}
            onClick={() => void run("Saving sample PDF…", async () => { await savePdf(); })}
          >
            Save PDF
          </button>
        </div>
        {message && <p role="status" className={setupNoteClass}>{message}</p>}
      </section>

      <section className={setupSectionClass} aria-label="Saved sample PDFs">
        <header className={setupHeaderClass}>
          <strong className="text-[11px] text-[#34423f]">Saved sample PDFs ({total})</strong>
          <button
            type="button"
            className={examButtonClass("neutral", "compact")}
            disabled={!!working || listLoading}
            onClick={() => void loadSamples(offset)}
          >
            Refresh PDFs
          </button>
        </header>
        {listLoading ? (
          <p role="status" className={setupEmptyClass}>Loading sample PDFs…</p>
        ) : samples.length ? (
          <fieldset className="m-0 grid min-w-0 gap-1.5 border-0 p-0" disabled={!!working}>
            <legend className="sr-only">Choose a saved sample PDF</legend>
            {samples.map((sample) => (
              <div
                key={sample.id}
                className={selected?.id === sample.id ? samplePickerRowSelectedClass : samplePickerRowClass}
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name={`sample-pdf-${chatId}`}
                    checked={selected?.id === sample.id}
                    onChange={() => chooseSaved(sample)}
                    className="m-0 h-[15px] w-[15px] accent-[#147d74]"
                  />
                  <span className="grid min-w-0 gap-px">
                    <span className="truncate text-[10px] font-semibold text-[#263330]">{sample.filename}</span>
                    <span className="text-[8px] text-[#7c8986]">
                      {Math.max(1, Math.round(sample.size_bytes / 1024))} KB · {new Date(sample.created_at).toLocaleString()}
                    </span>
                  </span>
                </label>
                <a
                  className="whitespace-nowrap text-[9px] font-semibold text-[#0f655e]"
                  href={`${examApi.defaults.baseURL}/samples/${sample.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`View PDF ${sample.filename}`}
                >
                  View PDF
                </a>
              </div>
            ))}
          </fieldset>
        ) : (
          <p className={setupEmptyClass}>No sample PDFs saved on this page. Upload one to begin.</p>
        )}
        {(offset > 0 || total > PAGE_SIZE) && (
          <div className={setupPagerClass}>
            <button
              type="button"
              className={examButtonClass("neutral", "compact")}
              disabled={offset === 0 || !!working || listLoading}
              onClick={() => void loadSamples(offset - PAGE_SIZE)}
            >
              Previous PDFs
            </button>
            <button
              type="button"
              className={examButtonClass("neutral", "compact")}
              disabled={offset + PAGE_SIZE >= total || !!working || listLoading}
              onClick={() => void loadSamples(offset + PAGE_SIZE)}
            >
              Next PDFs
            </button>
          </div>
        )}
      </section>

      <section className={setupSectionClass} aria-label="Generate exam">
        <p className={setupNoteClass}>{selectionLabel}</p>
        {working && (
          <p role="status" className="m-0 flex items-center gap-2 text-[10px] font-semibold text-[#0f655e]">
            <Loader2 size={14} aria-hidden="true" className="animate-spin" />
            {working}
          </p>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            className="modal-button modal-button-primary"
            disabled={(!file && !selected) || !!working}
            onClick={() =>
              void run("Saving your PDF and generating an exam. This can take several minutes…", async () => {
                const source = file ? await savePdf() : selected;
                if (!source) throw new Error("Choose a sample PDF.");
                try {
                  const { data } = await examApi.post("/", { chat_id: chatId, sample_pdf_id: source.id });
                  if (mounted.current) onGenerated(data);
                } catch (e) {
                  if (mounted.current) {
                    setMessage("Your sample PDF is saved. Refresh the saved exams list before generating again.");
                  }
                  throw e;
                }
              })
            }
          >
            Generate exam
          </button>
        </div>
      </section>
    </>
  );
}
