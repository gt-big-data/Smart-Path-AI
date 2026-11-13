import type { Result } from '../../lib/quizState';

const SEGMENT_CLASS: Record<string, string> = {
  current: 'bg-[#8fc8c2]',
  correct: 'bg-[#48a99f]',
  incorrect: 'bg-[#e79095]',
  '': '',
};

interface QuizProgressProps {
  total: number;
  currentIndex: number;
  results: (Result | null)[];
}

/** Segmented progress: one bar per question, coloured by its result */
export default function QuizProgress({ total, currentIndex, results }: QuizProgressProps) {
  const answered = results.filter(Boolean).length;
  const percent = total ? Math.round((answered / total) * 100) : 0;

  return (
    <div className="mx-auto w-[min(1048px,calc(100%_-_40px))] shrink-0 pt-[22px] pb-[17px] max-[600px]:w-[calc(100%_-_24px)]">
      <div className="mb-[9px] flex items-center justify-between text-[9px] font-semibold text-[#52625f]">
        <span>Question {currentIndex + 1} of {total}</span>
        <span>{percent}% complete</span>
      </div>
      <div
        className="grid grid-cols-[repeat(auto-fit,minmax(18px,1fr))] gap-1"
        role="img"
        aria-label={`Question ${currentIndex + 1} of ${total}, ${answered} answered`}
      >
        {results.map((result, step) => {
          const state = result
            ? result.isCorrect ? 'correct' : 'incorrect'
            : step === currentIndex ? 'current' : '';
          return <span key={step} className={`h-1 bg-[#dce5e3] [transition:background_0.18s_ease] ${SEGMENT_CLASS[state]}`} />;
        })}
      </div>
    </div>
  );
}
