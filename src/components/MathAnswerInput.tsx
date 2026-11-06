import { useEffect, useRef, useState } from "react";
import { MathfieldElement } from "mathlive";
import "mathlive/fonts.css";
import MathText from "./MathText";

MathfieldElement.fontsDirectory = null;
MathfieldElement.soundsDirectory = null;

const button = "rounded-lg border px-3 py-1 text-sm hover:bg-teal-50 disabled:opacity-50";

function EquationEditor({ initialValue, label, onChange }: {
  initialValue: string;
  label: string;
  onChange: (latex: string) => boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const keyboard = useRef<HTMLDivElement>(null);
  const field = useRef<MathfieldElement>();
  const change = useRef(onChange);
  change.current = onChange;
  useEffect(() => {
    const mf = new MathfieldElement();
    field.current = mf;
    mf.value = initialValue;
    mf.setAttribute("aria-label", `Equation for ${label}`);
    mf.className = "block w-full rounded-lg border bg-white p-3 text-xl";
    mf.mathVirtualKeyboardPolicy = "manual";
    // Keep the keyboard in the scrollable editor, inside the modal's top layer.
    const container = keyboard.current!;
    const focus = () => {
      if (window.mathVirtualKeyboard.container !== container) {
        window.mathVirtualKeyboard.hide();
        window.mathVirtualKeyboard.container = container;
      }
    };
    const input = () => {
      const latex = mf.value;
      if (change.current(latex)) saved = latex;
      else mf.value = saved;
    };
    let saved = initialValue;
    mf.addEventListener("input", input);
    mf.addEventListener("focus", focus);
    host.current!.append(mf);
    const frame = requestAnimationFrame(() => mf.focus());
    return () => {
      cancelAnimationFrame(frame);
      mf.removeEventListener("input", input);
      mf.removeEventListener("focus", focus);
      if (window.mathVirtualKeyboard.container === container) {
        window.mathVirtualKeyboard.hide();
        window.mathVirtualKeyboard.container = null;
      }
      mf.remove();
    };
  }, [initialValue, label]);
  return (
    <div className="space-y-2 rounded-lg bg-teal-50 p-3">
      <div className="flex flex-wrap gap-2" aria-label="Equation symbols">
        {[["Square root", "√", "\\sqrt{#0}"], ["Exponent", "xⁿ", "#@^{#?}"],
          ["Fraction", "a/b", "\\frac{#0}{#?}"]].map(([name, symbol, latex]) => (
          <button key={name} type="button" className={button} aria-label={name}
            onClick={() => { field.current?.focus(); field.current?.insert(latex); }}>
            {symbol}
          </button>
        ))}
        <button type="button" className={button} onClick={() => {
          field.current?.focus();
          window.mathVirtualKeyboard.show();
        }}>More symbols</button>
      </div>
      <div ref={host} />
      <div ref={keyboard} className="relative h-[320px] empty:hidden" />
      <p className="text-xs text-slate-500">Equation edits save automatically. Use arrow keys to move between slots.</p>
    </div>
  );
}

export default function MathAnswerInput({ value, onChange, label, rows, disabled }: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  rows: number;
  disabled: boolean;
}) {
  const text = useRef<HTMLTextAreaElement>(null);
  const range = useRef({ start: 0, end: 0 });
  const [equation, setEquation] = useState<string | null>(null);
  useEffect(() => {
    if (disabled) setEquation(null);
  }, [disabled]);
  const editing = equation !== null && !disabled;
  return (
    <div className="space-y-2">
      <textarea
        ref={text}
        aria-label={label}
        className="w-full rounded-lg border p-3 disabled:bg-slate-50"
        rows={rows}
        maxLength={20000}
        value={value}
        disabled={disabled}
        readOnly={editing}
        placeholder="Type your answer, including units or an explanation"
        onChange={(e) => onChange(e.target.value)}
      />
      {!disabled && <>
        <p className="text-xs text-slate-500">Plain text is fine, including “sqrt(9)” or “x squared”. The grader interprets your notation.</p>
        <button type="button" className={button} aria-expanded={editing} onClick={() => {
          if (editing) {
            setEquation(null);
            text.current?.focus();
            text.current?.setSelectionRange(range.current.end, range.current.end);
          } else {
            const start = text.current!.selectionStart;
            const end = text.current!.selectionEnd;
            range.current = { start, end };
            const selected = value.slice(start, end);
            setEquation(selected.startsWith("\\(") && selected.endsWith("\\)")
              ? selected.slice(2, -2) : selected);
          }
        }}>{editing ? "Done editing equation" : "Insert / edit equation"}</button>
        {editing && <EquationEditor initialValue={equation} label={label} onChange={(latex) => {
          const { start, end } = range.current;
          const inserted = latex ? `\\(${latex}\\)` : "";
          const answer = value.slice(0, start) + inserted + value.slice(end);
          if (answer.length > 20000) return false;
          range.current.end = start + inserted.length;
          onChange(answer);
          return true;
        }} />}
        <p className="text-xs text-slate-500">To edit an existing equation, select its notation in the answer box first.</p>
      </>}
      {value.includes("\\(") && <div className="rounded-lg border bg-slate-50 p-3">
        <p className="mb-1 text-xs text-slate-500">Answer preview</p>
        <MathText>{value}</MathText>
      </div>}
    </div>
  );
}
