import { Check, X } from 'lucide-react';
import type { Question, Result } from '../../lib/quizState';
import { displayAnswer, splitQuestion } from '../../lib/quizQuestions';
import { quizButtonClass, quizCard, quizError, quizNavigation, quizQuestionNumber, quizStage } from './quizClasses';

interface QuizReviewProps {
  questions: Question[];
  results: (Result | null)[];
  error: string;
  onDone: () => void;
}

/** Completed quiz: score summary, then each question with the student's answer and the explanation */
export default function QuizReview({ questions, results, error, onDone }: QuizReviewProps) {
  const correctCount = results.filter(result => result?.isCorrect).length;

  return (
    <div className={quizStage}>
      {error && <p role="alert" className={quizError}>{error}</p>}

      <section className={quizCard}>
        <span className={quizQuestionNumber}>Quiz review</span>
        <h2 className="mt-[9px] mb-1.5 font-heading text-xl font-semibold text-[#202a29]">Quiz complete</h2>
        <p className="m-0 text-[11px] leading-[1.55] text-[#687572]">
          {correctCount} of {questions.length} correct. Review your answers and explanations below.
        </p>
      </section>

      {questions.map((item, itemIndex) => {
        const result = results[itemIndex];
        return (
          <section key={itemIndex} className="border border-[#ccd8d5] bg-paper px-5 py-[18px]">
            <div className="flex items-center gap-[7px] text-[9px] font-bold uppercase tracking-[0.08em] text-[#52625f]">
              {result?.isCorrect
                ? <Check size={13} className="text-teal" aria-label="Correct" />
                : <X size={13} className="text-[#c4474d]" aria-label="Incorrect" />}
              Question {itemIndex + 1}
            </div>
            <h3 className="mt-2 mb-3 text-xs font-medium leading-[1.5] whitespace-pre-wrap text-[#202a29]">
              {splitQuestion(item).prompt}
            </h3>
            <p className="mt-1.5 text-[10px] leading-[1.55] text-[#687572]">
              Your answer: <strong className="font-semibold text-[#263331]">{result?.skipped ? 'Skipped' : result?.answer || 'No answer'}</strong>
            </p>
            <p className="mt-1.5 text-[10px] leading-[1.55] text-[#687572]">
              Correct answer: <strong className="font-semibold text-[#263331]">{displayAnswer(item)}</strong>
            </p>
            <p className="mt-1.5 text-[10px] leading-[1.55] text-[#687572]">
              Explanation: {item.explanation || 'Review the correct answer for this question.'}
            </p>
            {result?.feedback && !result.skipped && (
              <p className="mt-1.5 text-[10px] leading-[1.55] text-[#687572]">Feedback: {result.feedback}</p>
            )}
          </section>
        );
      })}

      <footer className={quizNavigation}>
        <button type="button" className={`${quizButtonClass('primary')}`} onClick={onDone}>Close quiz</button>
      </footer>
    </div>
  );
}
