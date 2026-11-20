import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bot, Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { quizKey, readQuiz, type QuizState, type Result } from '../lib/quizState';
import { invalidateProgressCache } from '../lib/progressCache';
import { choiceLetter, displayAnswer, splitQuestion } from '../lib/quizQuestions';
import QuizProgress from '../components/quiz/QuizProgress';
import QuizAnswerList from '../components/quiz/QuizAnswerList';
import QuizReview from '../components/quiz/QuizReview';
import {
  quizButtonClass,
  quizCard,
  quizError,
  quizNavigation,
  quizQuestionNumber,
  quizStage,
  quizStatus,
} from '../components/quiz/quizClasses';

/** One quiz run; quizId opens a durable server snapshot, including legacy read-only reviews. */
export interface QuizSession {
  quizId?: string;
  id: string;
  chatId: string;
  graphId: string;
  title: string;
  length: string;
  format: string;
}

interface QuizProps {
  session: QuizSession;
  onClose: () => void;
  onAskAssistant: (question: string) => void;
}

const QUIZ_PAGE =
  'flex h-full min-h-0 w-full flex-col overflow-y-auto bg-[#f3f7f6] font-brand text-[#263331] antialiased [font-synthesis:none]';

/** Quiz dock tab: generates or resumes a quiz, checks answers and saves history */
export default function Quiz({ session, onClose, onAskAssistant }: QuizProps) {
  const { chatId, graphId, title, length, format } = session;
  const [quiz, setQuiz] = useState<QuizState | null>(() => session.quizId ? null : readQuiz(chatId));
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(() => !!session.quizId || !readQuiz(chatId));
  const [error, setError] = useState('');
  const [loadVersion, setLoadVersion] = useState(0);
  const started = useRef<Promise<QuizState>>();

  useEffect(() => {
    if (quiz) return;
    if (!chatId || !graphId) {
      setLoading(false);
      setError('This quiz is missing its document. Close it and start again.');
      return;
    }
    let active = true;
    if (!started.current) started.current = (session.quizId
      ? axios.get(`${API_BASE_URL}/api/quiz-history/runs/${session.quizId}`, { withCredentials: true })
      : axios.get(`${API_BASE_URL}/api/generate-questions-with-answers`, {
        params: { graph_id: graphId, chat_id: chatId, length, format, persist: true, attempt_id: session.id },
        withCredentials: true,
      })).then(response => {
        if (response.data?.quiz) return response.data.quiz as QuizState;
        throw new Error('Could not load the saved quiz. Please retry.');
      });
    started.current.then(next => {
      if (!active) return;
      if (!session.quizId || !next.completed) localStorage.setItem(quizKey(chatId), JSON.stringify(next));
      setLoading(false);
      setQuiz(next);
      if (!session.quizId) invalidateProgressCache(chatId);
    }).catch(err => { if (active) setError(err.response?.data?.error || err.message || 'Could not load the quiz.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [chatId, graphId, length, format, quiz, session.id, session.quizId, loadVersion]);

  const save = (next: QuizState) => {
    localStorage.setItem(quizKey(chatId), JSON.stringify(next));
    setQuiz(next);
  };

  const goTo = (index: number) => {
    if (!quiz) return;
    save({ ...quiz, currentQuestionIndex: index });
    setDraft(quiz.results[index]?.answer || '');
    setError('');
  };

  const finish = async (next: QuizState) => {
    if (next.quizId) {
      try {
        const response = await axios.post(`${API_BASE_URL}/api/quiz-history/runs/${next.quizId}/complete`, {}, { withCredentials: true });
        save(response.data.quiz);
        invalidateProgressCache(chatId);
      } catch (err) {
        console.error('Could not complete saved quiz', err);
        setError('Your answers are saved, but completion failed. Please retry.');
      }
      return;
    }
    const valid = next.qaData
      .map((question, index) => ({ question, result: next.results[index], index }))
      .filter(item => item.question.conceptId.trim());
    if (valid.length) {
      try {
        await axios.post(`${API_BASE_URL}/api/quiz-history`, {
          chat_id: chatId,
          concepts: valid.map(({ question, index }) => ({ conceptID: question.conceptId, name: question.conceptName || `Question ${index + 1} Concept` })),
          questions: valid.map(({ question, result }) => ({
            questionText: question.question,
            // Quiz history compares exact strings against the stored letter, so send "A" rather than "A) ATP"
            userAnswer: choiceLetter(result?.answer || 'No answer provided'),
            correctAnswer: question.answer,
            explanation: question.explanation || 'Review the correct answer for this question.',
            timestamp: new Date().toISOString(),
          })),
        }, { withCredentials: true });
      } catch (err) {
        console.error('Could not save quiz history', err);
        save({ ...next, completed: false });
        setError('Your final answer was saved, but quiz history could not be saved. Please retry.');
        return;
      }
    }
    save({ ...next, completed: true });
    invalidateProgressCache(chatId);
  };

  const retryFinish = async () => {
    if (!quiz || busy || quiz.completed) return;
    setBusy(true);
    setError('');
    try {
      await finish(quiz);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (skip = false) => {
    if (!quiz || busy || quiz.completed) return;
    const index = quiz.currentQuestionIndex;
    const question = quiz.qaData[index];
    const answer = skip ? 'SKIPPED' : draft.trim();
    if (!answer) { setError('Choose or write an answer before submitting.'); return; }
    setBusy(true);
    setError('');
    try {
      const response = await axios.post(`${API_BASE_URL}/api/verify-answer`, {
        ...(quiz.quizId ? { quiz_id: quiz.quizId, question_index: index } : {}),
        question: question.question,
        userAnswer: answer,
        correctAnswer: question.answer,
        conceptId: question.conceptId,
        chat_id: chatId,
        submission_id: `${quiz.attemptId}:${index}`,
        isRetry: false,
        graph_id: graphId,
      }, { withCredentials: true });
      const result: Result = {
        answer,
        isCorrect: !skip && response.data?.isCorrect === true,
        feedback: response.data?.feedback || '',
        skipped: response.data?.skipped ?? skip,
      };
      const results = [...quiz.results];
      results[index] = result;
      const qaData = [...quiz.qaData];
      if (quiz.quizId) qaData[index] = { ...question, answer: response.data.correctAnswer || '',
        explanation: response.data.explanation || question.explanation };
      // Stay on this question so the student sees whether they got it right; Next / See results moves on.
      save({ ...quiz, qaData, results });
    } catch (err) {
      console.error('Could not verify answer', err);
      setError('Could not submit this answer. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <main className={QUIZ_PAGE}><p className={quizStatus} role="status">Generating your quiz...</p></main>;
  if (!quiz) return (
    <main className={QUIZ_PAGE}>
      <div className={quizStatus}>
        <p role="alert">{error}</p>
        <div className="flex flex-wrap justify-center gap-2.5">
          <button type="button" className={quizButtonClass('primary')} onClick={() => {
            started.current = undefined; setError(''); setLoading(true); setLoadVersion(v => v + 1);
          }}>Retry</button>
          <button type="button" className={quizButtonClass('primary')} onClick={onClose}>Close quiz</button>
        </div>
      </div>
    </main>
  );

  const index = quiz.currentQuestionIndex;
  const question = quiz.qaData[index];
  const { prompt, choices } = splitQuestion(question);
  const completedCount = quiz.results.filter(Boolean).length;
  const heading = quiz.completed ? 'Quiz review' : 'Quiz';
  const result = quiz.results[index];
  const correctChoice = displayAnswer(question).toLowerCase();
  const isLast = index === quiz.qaData.length - 1;

  return (
    <main className={QUIZ_PAGE}>
      <header className="grid min-h-12.5 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3.5 border-b border-[#d6e0de] bg-paper px-4.5 max-[600px]:grid-cols-[auto_1fr] max-[600px]:px-3">
        <button
          type="button"
          className="inline-flex cursor-pointer items-center justify-self-start gap-1.5 border-0 bg-transparent py-1.25 text-[10px] font-semibold text-teal hover:text-teal-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          onClick={onClose}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          {quiz.completed ? 'Close quiz' : 'Save and exit'}
        </button>
        <h1 className="m-0 min-w-0 truncate text-[13px] font-semibold text-[#263331] max-[600px]:text-right">
          {title ? <>{heading}<span className="text-[#8d9996]"> {title}</span></> : heading}
        </h1>
        <span className="justify-self-end whitespace-nowrap text-[9px] text-[#65736f] max-[600px]:hidden">
          {completedCount} of {quiz.qaData.length} answered
        </span>
      </header>

      {quiz.completed ? (
        <QuizReview
            scoreAvailable={quiz.scoreAvailable !== false}
          questions={quiz.qaData}
          results={quiz.results}
          error={error}
          onDone={onClose}
        />
      ) : (
        <>
          <QuizProgress total={quiz.qaData.length} currentIndex={index} results={quiz.results} />

          <div className={quizStage}>
            <section className={quizCard} aria-label={`Question ${index + 1}`}>
              <span className={quizQuestionNumber}>Question {index + 1}</span>
              <h2 className="mt-2.75 mb-5.5 max-w-180 text-[clamp(16px,2vw,20px)] font-medium leading-[1.48] whitespace-pre-wrap text-[#202a29]">
                {prompt}
              </h2>

              {choices.length ? (
                <QuizAnswerList
                  choices={choices}
                  selected={result?.answer || draft}
                  correctChoice={correctChoice}
                  result={result}
                  onSelect={setDraft}
                />
              ) : (
                <textarea
                  className="box-border min-h-30 w-full resize-y border border-[#d8e0de] bg-white px-3.5 py-3 text-[11px] leading-[1.55] text-[#263331] outline-none focus:border-[#73aaa4] focus:shadow-[0_0_0_2px_rgba(20,125,116,0.15)] disabled:bg-[#f5f7f6]"
                  value={result?.answer || draft}
                  onChange={event => setDraft(event.target.value)}
                  disabled={!!result}
                  rows={5}
                  placeholder="Write your answer..."
                  aria-label="Your answer"
                />
              )}

              {result && (
                <div
                  role="status"
                  className={`mt-5 border p-3.75 ${result.isCorrect
                    ? 'border-[#a9d9d2] bg-[#edf8f6] text-[#295e58]'
                    : 'border-[#e1b0b3] bg-[#fdf1f1] text-[#7f3a3e]'}`}
                >
                  <p className="mt-2 flex items-center gap-1.75 text-[10px] leading-[1.55] font-semibold">
                    {result.isCorrect ? <Check size={15} aria-hidden="true" /> : <X size={15} aria-hidden="true" />}
                    {result.isCorrect ? 'Correct' : result.skipped ? 'Skipped' : 'Not quite'}
                  </p>
                  {!result.isCorrect && <p className="mt-2 text-[10px] leading-[1.55]">Correct answer: <strong>{displayAnswer(question)}</strong></p>}
                  {result.feedback && !result.skipped && <p className="mt-2 text-[10px] leading-[1.55]">{result.feedback}</p>}
                  {question.explanation && <p className="mt-2 text-[10px] leading-[1.55]"><strong>Why:</strong> {question.explanation}</p>}
                </div>
              )}

              {error && <p role="alert" className={quizError}>{error}</p>}

              <footer className={quizNavigation}>
                <button type="button" className={quizButtonClass()} disabled={index === 0 || busy} onClick={() => goTo(index - 1)}>
                  <ChevronLeft size={14} aria-hidden="true" /> Back
                </button>

                <button
                  type="button"
                  className={quizButtonClass('assistant')}
                  onClick={() => onAskAssistant(question.question)}
                >
                  <Bot size={14} aria-hidden="true" /> Ask Study Assistant
                </button>

                {result ? (
                  isLast ? (
                    <button type="button" className={quizButtonClass('primary')} disabled={busy} onClick={() => void retryFinish()}>
                      {busy ? 'Saving...' : 'See results'}
                    </button>
                  ) : (
                    <button type="button" className={quizButtonClass('primary')} disabled={busy} onClick={() => goTo(index + 1)}>
                      Next <ChevronRight size={14} aria-hidden="true" />
                    </button>
                  )
                ) : (
                  <div className="ml-auto flex gap-2">
                    <button type="button" className={quizButtonClass()} disabled={busy} onClick={() => submit(true)}>Skip</button>
                    <button type="button" className={quizButtonClass('primary')} disabled={busy || !draft.trim()} onClick={() => submit()}>
                      {busy ? 'Checking...' : 'Check answer'}
                    </button>
                  </div>
                )}
              </footer>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
