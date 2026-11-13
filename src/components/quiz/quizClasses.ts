/** Tailwind class strings shared by the quiz components. Colours follow the quiz palette in the design tokens. */

export const quizStage =
  "mx-auto mb-[22px] grid w-[min(980px,calc(100%_-_40px))] content-start gap-[18px] max-[600px]:w-[calc(100%_-_24px)]";

export const quizCard =
  "border border-[#ccd8d5] bg-paper p-[clamp(22px,4vw,34px)] max-[600px]:px-3.5 max-[600px]:py-[18px]";

export const quizQuestionNumber = "block text-[9px] font-bold uppercase tracking-[0.12em] text-teal";

export const quizError = "mt-3.5 text-[10px] text-[#c4474d]";

export const quizNavigation =
  "mt-[26px] flex flex-wrap items-center justify-between gap-2.5 border-t border-[#e0e6e4] pt-5";

export const quizStatus = "m-auto grid justify-items-center gap-3.5 p-6 text-center text-xs text-[#687572]";

const QUIZ_BUTTON_BASE =
  "inline-flex h-9 cursor-pointer items-center gap-[7px] border px-3.5 text-[10px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-not-allowed disabled:opacity-[0.38]";

// Each variant is a complete class string. Never combine variants, so the cascade stays predictable.
const QUIZ_BUTTON_VARIANTS = {
  default:
    "border-[#c7d1cf] bg-white text-[#596764] enabled:hover:border-[#8bb8b3] enabled:hover:bg-[#f5faf9] enabled:hover:text-[#116d65]",
  primary:
    "ml-auto border-teal bg-teal text-white enabled:hover:border-teal-dark enabled:hover:bg-teal-dark enabled:hover:text-white",
  assistant:
    "border-[#8bb8b3] bg-[#f4faf9] text-[#116d65] enabled:hover:border-teal enabled:hover:bg-[#e8f4f2] enabled:hover:text-[#116d65]",
} as const;

export type QuizButtonVariant = keyof typeof QUIZ_BUTTON_VARIANTS;

export function quizButtonClass(variant: QuizButtonVariant = "default") {
  return `${QUIZ_BUTTON_BASE} ${QUIZ_BUTTON_VARIANTS[variant]}`;
}
