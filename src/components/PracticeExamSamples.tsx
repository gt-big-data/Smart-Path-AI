import { useCallback, useEffect, useRef, useState } from "react";
import { Exam, SamplePdf, examApi, errorText } from "./practiceExamApi";

const button = "rounded-lg border border-teal-600 px-4 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed";
const primary = `${button} bg-teal-600 text-white hover:bg-teal-700`;

export default function PracticeExamSamples({ chatId, busy, act, onGenerated, refreshExams }: {
  chatId: string;
  busy: boolean;
  act: (label: string, action: () => Promise<void>) => Promise<void>;
  onGenerated: (exam: Exam) => void;
  refreshExams: () => Promise<void>;
}) {
  const [samples, setSamples] = useState<SamplePdf[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<SamplePdf>();
  const [file, setFile] = useState<File>();
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const loadSamples = useCallback(async (page = 0) => {
    setLoading(true);
    try {
      const { data } = await examApi.get("/samples", { params: { chat_id: chatId, limit: 20, offset: page } });
      if (!mounted.current) return;
      setSamples(data.samples);
      setTotal(data.total);
      setOffset(page);
      setLoadError("");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [chatId]);
  useEffect(() => {
    mounted.current = true;
    void loadSamples().catch(e => { if (mounted.current) setLoadError(errorText(e)); });
    return () => { mounted.current = false; };
  }, [loadSamples]);

  const savePdf = async (): Promise<SamplePdf> => {
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) throw new Error("Choose a PDF file.");
    if (file.size > 10 * 1024 * 1024) throw new Error("The sample PDF must be at most 10 MB.");
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("practice_exam", file);
    const { data } = await examApi.post("/samples", form);
    const sample: SamplePdf = data.sample;
    setSelected(sample);
    setFile(undefined);
    if (input.current) input.current.value = "";
    setMessage("PDF saved. You can generate an exam now or reuse it later.");
    await loadSamples().catch(e => setLoadError(errorText(e)));
    return sample;
  };

  return (
    <section className="rounded-xl border bg-teal-50/50 p-5 space-y-4">
      <h3 className="font-semibold">Generate from a sample exam</h3>
      <p className="text-sm">
        Upload a sample exam PDF (up to 10 MB) or choose one saved in this chat.
        Your chat’s course material supplies the content. Generation may take several minutes.
      </p>
      <label className="block text-sm font-medium">
        Upload a new sample exam PDF
        <input ref={input} className="mt-2 block w-full" type="file" accept=".pdf,application/pdf"
          disabled={busy} onChange={e => {
            const next = e.target.files?.[0];
            setFile(next);
            if (next) setSelected(undefined);
            setMessage("");
          }} />
      </label>
      <button className={button} disabled={!file || busy}
        onClick={() => void act("Saving sample PDF…", async () => { await savePdf(); })}>
        Save PDF
      </button>
      {message && <p role="status" className="text-sm text-teal-800">{message}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-medium">Saved sample PDFs ({total})</h4>
        <button className={button} disabled={busy || loading}
          onClick={() => void act("Loading sample PDFs…", () => loadSamples(offset))}>Refresh PDFs</button>
      </div>
      {loadError && <p role="alert" className="text-sm text-red-800">{loadError}</p>}
      {loading && <p role="status" className="text-sm text-slate-500">Loading sample PDFs…</p>}
      {!loading && !loadError && !samples.length && <p className="text-sm text-slate-500">No sample PDFs saved on this page. Upload one to begin.</p>}
      <fieldset disabled={busy} className="space-y-2">
        <legend className="sr-only">Choose a saved sample PDF</legend>
        {samples.map(sample => (
          <div key={sample.id} className={`flex flex-wrap items-center gap-3 rounded-lg border bg-white p-3 ${selected?.id === sample.id ? "border-teal-600" : ""}`}>
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
              <input type="radio" name={`sample-pdf-${chatId}`} checked={selected?.id === sample.id}
                onChange={() => {
                  setSelected(sample); setFile(undefined); setMessage("");
                  if (input.current) input.current.value = "";
                }} />
              <span className="min-w-0">
                <span className="block break-words font-medium">{sample.filename}</span>
                <span className="text-xs text-slate-500">
                  {Math.max(1, Math.round(sample.size_bytes / 1024))} KB · {new Date(sample.created_at).toLocaleString()}
                </span>
              </span>
            </label>
            <a className="text-sm text-teal-800 underline" href={`${examApi.defaults.baseURL}/samples/${sample.id}/file`}
              target="_blank" rel="noopener noreferrer" aria-label={`View PDF ${sample.filename}`}>View PDF</a>
          </div>
        ))}
      </fieldset>
      {(offset > 0 || total > 20) && <div className="flex gap-2">
        <button className={button} disabled={offset === 0 || busy || loading}
          onClick={() => void act("Loading sample PDFs…", () => loadSamples(offset - 20))}>Previous PDFs</button>
        <button className={button} disabled={offset + 20 >= total || busy || loading}
          onClick={() => void act("Loading sample PDFs…", () => loadSamples(offset + 20))}>Next PDFs</button>
      </div>}
      <div className="space-y-3 border-t pt-4">
        <p className="text-sm">{file ? `New PDF: ${file.name}` : selected ? `Selected PDF: ${selected.filename}` : "Choose a PDF above to generate an exam."}</p>
        <button className={primary} disabled={(!file && !selected) || busy}
          onClick={() => void act("Saving your PDF and generating an exam. This can take several minutes…", async () => {
            const source = file ? await savePdf() : selected;
            if (!source) throw new Error("Choose a sample PDF.");
            try {
              const { data } = await examApi.post("/", { chat_id: chatId, sample_pdf_id: source.id });
              onGenerated(data);
            } catch (e) {
              setMessage("Your sample PDF is saved. You can select it and try generating again.");
              await refreshExams().catch(() => {});
              throw e;
            }
          })}>Generate exam</button>
      </div>
    </section>
  );
}
