/**
 * Tailwind class strings shared by the practice exam views (dock panel, sample picker, setup modal).
 * Each colour tone is one complete string. Never add a colour utility on top of a tone, because
 * Tailwind resolves conflicting utilities by stylesheet order, not by className order.
 */

const BUTTON_BASE =
  "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[3px] border font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-not-allowed disabled:opacity-40";

const BUTTON_SIZE = {
  default: "min-h-[31px] px-3 text-[10px]",
  compact: "h-[31px] px-2.5 text-[9px] rounded-[2px]",
} as const;

const BUTTON_TONE = {
  neutral:
    "border-[#c7d1cf] bg-white text-[#4f5e5b] enabled:hover:border-[#8bb8b3] enabled:hover:bg-[#f5faf9] enabled:hover:text-teal-dark",
  primary: "border-teal bg-teal text-white enabled:hover:border-teal-dark enabled:hover:bg-teal-dark",
  danger: "border-[#c4474d] bg-[#c4474d] text-white enabled:hover:border-[#a93a40] enabled:hover:bg-[#a93a40]",
} as const;

export type ExamButtonTone = keyof typeof BUTTON_TONE;
export type ExamButtonSize = keyof typeof BUTTON_SIZE;

export function examButtonClass(tone: ExamButtonTone = "neutral", size: ExamButtonSize = "default") {
  return `${BUTTON_BASE} ${BUTTON_SIZE[size]} ${BUTTON_TONE[tone]}`;
}

export const examFieldClass =
  "box-border w-full resize-y border border-[#c7d1cf] bg-white px-3 py-2.5 text-[11px] leading-[1.5] text-[#263331] focus:border-[#73aaa4] focus:shadow-[0_0_0_2px_rgba(20,125,116,0.15)] focus:outline-none disabled:bg-[#f5f7f6]";

// Setup modal sections
export const setupSectionClass = "mt-4 grid gap-2.5 border-t border-[#d9e2e0] pt-4";
export const setupHeaderClass =
  "flex items-center justify-between gap-3 max-[600px]:flex-col max-[600px]:items-start";
export const setupEmptyClass =
  "m-0 grid min-h-14 place-items-center border border-dashed border-[#c9d4d2] bg-[#fafbfb] p-3.5 text-center text-[9px] text-[#7b8885]";
export const setupNoteClass = "m-0 text-[10px] leading-[1.5] text-[#65736f]";
export const setupErrorClass =
  "m-0 border-l-[3px] border-l-[#c4474d] bg-[#fff1f1] px-2.5 py-[9px] text-[10px] leading-[1.5] text-[#8e383e]";
export const setupPagerClass = "flex gap-2";

// Saved sample PDF and saved exam rows
export const samplePickerRowClass = "flex min-h-10 items-center gap-2.5 border border-[#d0d9d7] bg-[#f8faf9] px-2.5";
export const samplePickerRowSelectedClass =
  "flex min-h-10 items-center gap-2.5 border border-[#147d74] bg-[#edf7f5] px-2.5 text-[#0f655e]";
export const savedExamRowClass = "flex min-h-11 items-center gap-2.5 border border-[#d0d9d7] bg-[#f8faf9] py-1.5 pr-2 pl-[11px]";
