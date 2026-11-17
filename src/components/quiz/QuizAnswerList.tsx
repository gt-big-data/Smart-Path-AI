import { Check, X } from 'lucide-react';
import type { Result } from '../../lib/quizState';

interface QuizAnswerListProps {
  choices: string[];
  /** The choice the student has picked, before or after checking */
  selected: string;
  /** Lower-cased full text of the correct choice */
  correctChoice: string;
  result: Result | null;
  onSelect: (choice: string) => void;
}

const LETTER_PREFIX = /^[A-D][).]\s*/;

const CARD_STATE_CLASS: Record<string, string> = {
  selected: 'border-[#55a99f] bg-[#edf8f6] text-[#116d65]',
  correct: 'border-[#55a99f] bg-[#edf8f6] text-[#116d65]',
  incorrect: 'border-[#c75a61] bg-[#fdf1f1] text-[#9b363d]',
  '': '',
};

const LETTER_STATE_CLASS: Record<string, string> = {
  selected: 'border-teal bg-teal text-white',
  correct: 'border-teal bg-teal text-white',
  incorrect: 'border-[#c4474d] bg-[#c4474d] text-white',
  '': '',
};

/** Lettered answer cards for multiple choice and true/false questions */
export default function QuizAnswerList({ choices, selected, correctChoice, result, onSelect }: QuizAnswerListProps) {
  return (
    <div className="grid gap-2.25" role="radiogroup" aria-label="Answer choices">
      {choices.map((choice, index) => {
        const letter = choice.match(/^([A-D])[).]/)?.[1] ?? String.fromCharCode(65 + index);
        const text = choice.replace(LETTER_PREFIX, '');
        const picked = selected === choice;
        const isRight = choice.toLowerCase() === correctChoice;
        const state = !result
          ? picked ? 'selected' : ''
          : isRight ? 'correct' : picked ? 'incorrect' : '';

        return (
          <button
            key={choice}
            type="button"
            role="radio"
            aria-checked={picked}
            disabled={!!result}
            onClick={() => onSelect(choice)}
            className={`grid min-h-11.75 w-full cursor-pointer grid-cols-[25px_minmax(0,1fr)_23px] items-center gap-2.5 border border-[#d8e0de] bg-white px-3 py-1.75 text-left text-[#53615e] [transition:border-color_0.15s_ease,background_0.15s_ease] enabled:hover:border-[#73aaa4] enabled:hover:bg-[#f5faf9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-default ${CARD_STATE_CLASS[state]}`}
          >
            <span
              className={`grid h-6.25 w-6.25 place-items-center border border-[#c5d0ce] text-[9px] ${LETTER_STATE_CLASS[state]}`}
              aria-hidden="true"
            >
              {letter}
            </span>
            <span className="min-w-0 text-[11px] font-medium">{text}</span>
            {result && isRight && (
              <span className="grid h-5 w-5 place-items-center rounded-full border border-current">
                <Check size={13} aria-hidden="true" />
                <span className="sr-only">Correct answer</span>
              </span>
            )}
            {result && picked && !isRight && (
              <span className="grid h-5 w-5 place-items-center rounded-full border border-current">
                <X size={13} aria-hidden="true" />
                <span className="sr-only">Your answer</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
