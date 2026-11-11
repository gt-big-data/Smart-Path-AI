import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, ChevronLeft, ChevronRight, HelpCircle, Send, XCircle } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { quizKey, readQuiz, type ClarifyMessage, type Question, type QuizState, type Result } from '../lib/quizState';

// The AI server isn't consistent about the concept id field name
type RawPair = { question?: string; answer?: string; conceptId?: string; concept_id?: string; topicId?: string; topic_id?: string; id?: string; conceptName?: string; explanation?: string; format?: string };

function splitQuestion(question: Question) {
  const lines = question.question.split('\n');
  const choices = lines.map(line => line.trim()).filter(line => /^[A-D][).]\s*\S/.test(line));
  if (choices.length >= 2) return { prompt: lines.filter(line => !choices.includes(line.trim())).join('\n').trim(), choices };
  const inline = [...question.question.matchAll(/(?:^|\s)([A-D][).]\s*.*?)(?=\s+[A-D][).]\s*|$)/g)].map(match => match[1].trim());
  if (inline.length >= 2) return { prompt: question.question.slice(0, question.question.indexOf(inline[0])).trim(), choices: inline };
  if (question.format === 'tf' || /^true or false:/i.test(question.question)) {
    return { prompt: question.question, choices: ['True', 'False'] };
  }
  return { prompt: question.question, choices: [] };
}

const choiceLetter = (answer: string) => answer.match(/^([A-D])[).]/)?.[1] ?? answer;

function displayAnswer(question: Question) {
  const letter = question.answer.trim().match(/^[A-D]$/i)?.[0].toUpperCase();
  return letter ? splitQuestion(question).choices.find(choice => choice.startsWith(`${letter})`) || choice.startsWith(`${letter}.`)) || question.answer : question.answer;
}

function QuizRunner() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const chatId = params.get('chatId') || '';
  const graphId = params.get('graphId') || '';
  const title = params.get('title') || '';
  const [quiz, setQuiz] = useState<QuizState | null>(() => readQuiz(chatId));
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!readQuiz(chatId));
  const [error, setError] = useState('');
  const [clarifyDraft, setClarifyDraft] = useState('');
  const [clarifyBusy, setClarifyBusy] = useState(false);
  const [clarifyError, setClarifyError] = useState('');
  const clarifyInput = useRef<HTMLInputElement>(null);
  const clarifyEnd = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!chatId || !graphId || quiz || started.current) {
      if (!chatId || !graphId) { setLoading(false); setError('This quiz is missing its document. Return to chat and start it again.'); }
      return;
    }
    started.current = true;
    const length = params.get('length') || '5';
    const format = params.get('format') || 'mixed';
    axios.get(`${API_BASE_URL}/api/generate-questions-with-answers`, {
      params: { graph_id: graphId, chat_id: chatId, length, format }, withCredentials: true,
    }).then(response => {
      const pairs = response.data?.qa_pairs;
      if (response.data?.status !== 'success' || !Array.isArray(pairs) || !pairs.length) {
        throw new Error('No questions were generated for this document.');
      }
      const qaData: Question[] = pairs.map((pair: RawPair) => ({
        question: pair.question || '',
        answer: pair.answer === 'T' ? 'True' : pair.answer === 'F' ? 'False' : String(pair.answer || ''),
        conceptId: String(pair.conceptId || pair.concept_id || pair.topicId || pair.topic_id || pair.id || ''),
        conceptName: pair.conceptName || undefined,
        explanation: pair.explanation,
        format: pair.format,
      }));
      const next = { attemptId: crypto.randomUUID(), qaData, currentQuestionIndex: 0, results: qaData.map(() => null), completed: false };
      localStorage.setItem(quizKey(chatId), JSON.stringify(next));
      setQuiz(next);
    }).catch(err => setError(err.message || 'Could not generate the quiz.')).finally(() => setLoading(false));
  }, [chatId, graphId, params, quiz]);

  const thread = quiz?.clarifications?.[quiz.currentQuestionIndex] ?? [];
  useEffect(() => { clarifyEnd.current?.scrollIntoView({ block: 'nearest' }); }, [thread.length, clarifyBusy]);

  // Clarifications are only changed by updateThread, so keep the latest ones when saving answers.
  const save = (next: QuizState) => setQuiz(prev => {
    const merged = { ...next, clarifications: prev?.clarifications ?? next.clarifications };
    localStorage.setItem(quizKey(chatId), JSON.stringify(merged));
    return merged;
  });

  const updateThread = (index: number, change: (thread: ClarifyMessage[]) => ClarifyMessage[]) => setQuiz(prev => {
    if (!prev) return prev;
    const clarifications = prev.qaData.map((_, i) => prev.clarifications?.[i] ?? []);
    clarifications[index] = change(clarifications[index]);
    const next = { ...prev, clarifications };
    localStorage.setItem(quizKey(chatId), JSON.stringify(next));
    return next;
  });

  const goTo = (index: number) => {
    if (!quiz) return;
    save({ ...quiz, currentQuestionIndex: index });
    setDraft(quiz.results[index]?.answer || '');
    setClarifyDraft('');
    setError('');
    setClarifyError('');
  };

  const finish = async (next: QuizState) => {
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
        skipped: skip,
      };
      const results = [...quiz.results];
      results[index] = result;
      // Stay on this question so the student sees whether they got it right; Next / See results moves on.
      save({ ...quiz, results });
      setClarifyDraft('');
      setClarifyError('');
    } catch (err) {
      console.error('Could not verify answer', err);
      setError('Could not submit this answer. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const askClarify = async () => {
    const text = clarifyDraft.trim();
    if (!quiz || clarifyBusy) return;
    if (!text) { setClarifyError('Type a question first.'); return; }
    const index = quiz.currentQuestionIndex;
    updateThread(index, thread => [...thread, { sender: 'user', text }]);
    setClarifyDraft('');
    setClarifyError('');
    setClarifyBusy(true);
    try {
      // The server gets the correct answer so it can steer away from it and block replies that contain it.
      const response = await axios.post(`${API_BASE_URL}/api/clarify-quiz-question`, {
        question: quiz.qaData[index].question,
        studentQuestion: text,
        correctAnswer: displayAnswer(quiz.qaData[index]),
      }, { withCredentials: true });
      updateThread(index, thread => [...thread, { sender: 'ai', text: response.data?.message || 'No answer came back. Try rephrasing.' }]);
    } catch (err) {
      console.error('Could not get clarification', err);
      // Take the unanswered question back out of the thread so retrying is one click
      updateThread(index, thread => thread.slice(0, -1));
      setClarifyDraft(text);
      setClarifyError("Couldn't get an answer. Try again.");
    } finally {
      setClarifyBusy(false);
    }
  };

  const askAbout = (choice: string) => {
    setClarifyDraft(`What does "${choice.replace(/^[A-D][).]\s*/, '')}" mean here?`);
    setClarifyError('');
    clarifyInput.current?.focus();
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-600">Generating your quiz...</div>;
  if (!quiz) return <div className="min-h-screen flex flex-col gap-4 items-center justify-center text-slate-700"><p>{error}</p><button onClick={() => navigate('/chat')} className="px-4 py-2 rounded-lg bg-teal-600 text-white">Back to chat</button></div>;

  const index = quiz.currentQuestionIndex;
  const question = quiz.qaData[index];
  const { prompt, choices } = splitQuestion(question);
  const completedCount = quiz.results.filter(Boolean).length;
  const heading = quiz.completed ? 'Quiz review' : 'Quiz';
  const result = quiz.results[index];
  const correctChoice = displayAnswer(question).toLowerCase();
  const isLast = index === quiz.qaData.length - 1;

  return (
    <main className="min-h-screen bg-gradient-to-br from-teal-50/50 via-slate-50 to-blue-50/50 text-slate-800">
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 px-4 sm:px-8 py-4 flex items-center justify-between gap-4">
        <button onClick={() => navigate('/chat')} className="flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-700 flex-shrink-0"><ArrowLeft size={18} /> {quiz.completed ? 'Back to chat' : 'Save and exit'}</button>
        <h1 className="text-xl font-semibold text-slate-800 truncate">{title ? `${heading} · ${title}` : heading}</h1>
        <span className="text-sm text-slate-600 flex-shrink-0">{completedCount} of {quiz.qaData.length} answered</span>
      </header>
      {quiz.completed ? (
        <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
          {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 mb-6">
            <h2 className="text-2xl font-semibold text-slate-800">Quiz complete</h2>
            <p className="mt-2 text-slate-600">{quiz.results.filter(result => result?.isCorrect).length} of {quiz.qaData.length} correct. Review your answers and explanations below.</p>
          </div>
          <div className="space-y-4">
            {quiz.qaData.map((item, itemIndex) => {
              const result = quiz.results[itemIndex];
              return <section key={itemIndex} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">{result?.isCorrect ? <CheckCircle2 size={18} className="text-teal-600" /> : <Circle size={18} className="text-slate-400" />} Question {itemIndex + 1}</div>
                <h3 className="font-semibold text-slate-800 whitespace-pre-wrap">{splitQuestion(item).prompt}</h3>
                <p className="mt-4 text-sm text-slate-600">Your answer: <span className="text-slate-800">{result?.skipped ? 'Skipped' : result?.answer || 'No answer'}</span></p>
                <p className="mt-2 text-sm text-slate-600">Correct answer: <span className="text-slate-800">{displayAnswer(item)}</span></p>
                <p className="mt-3 text-sm text-slate-600">Explanation: {item.explanation || 'Review the correct answer for this question.'}</p>
                {result?.feedback && !result.skipped && <p className="mt-3 text-sm text-slate-600">Feedback: {result.feedback}</p>}
              </section>;
            })}
          </div>
          <button onClick={() => navigate('/chat')} className="mt-6 px-5 py-2.5 rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 text-white font-medium">Back to chat</button>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
          <div className="mb-6">
            <div className="flex justify-between text-sm font-medium text-slate-600 mb-3"><span>Question {index + 1} of {quiz.qaData.length}</span><span>{Math.round(completedCount / quiz.qaData.length * 100)}% complete</span></div>
            <div className="flex gap-1" aria-label="Quiz progress">{quiz.qaData.map((_, step) => <div key={step} className={`h-1.5 flex-1 rounded-full ${quiz.results[step] ? (quiz.results[step]?.isCorrect ? 'bg-teal-500' : 'bg-red-300') : step === index ? 'bg-teal-400' : 'bg-slate-200'}`} />)}</div>
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] items-start">
            <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 sm:p-8">
              <p className="text-sm font-medium text-teal-600 mb-3">Question {index + 1}</p>
              <h2 className="text-xl font-semibold text-slate-800 whitespace-pre-wrap leading-relaxed">{prompt}</h2>
              {choices.length ? <div className="mt-6 space-y-3" role="radiogroup" aria-label="Answer choices">{choices.map(choice => {
                const picked = (result?.answer || draft) === choice;
                const isRight = choice.toLowerCase() === correctChoice;
                const style = !result
                  ? (picked ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-white hover:border-teal-400')
                  : isRight ? 'border-teal-500 bg-teal-50' : picked ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white opacity-70';
                return <div key={choice} className="flex items-stretch gap-2">
                  <button type="button" role="radio" aria-checked={picked} disabled={!!result} onClick={() => setDraft(choice)} className={`flex-1 text-left px-4 py-3 rounded-lg border text-slate-800 transition-colors flex items-center justify-between gap-3 ${style}`}>
                    <span>{choice}</span>
                    {result && isRight && <CheckCircle2 size={18} className="text-teal-600 flex-shrink-0" aria-label="Correct answer" />}
                    {result && picked && !isRight && <XCircle size={18} className="text-red-500 flex-shrink-0" aria-label="Your answer" />}
                  </button>
                  {/^[A-D][).]/.test(choice) && <button type="button" onClick={() => askAbout(choice)} title="Ask about this choice" aria-label={`Ask about ${choice}`} className="px-3 rounded-lg border border-teal-200 bg-white text-teal-600 text-xs font-medium hover:bg-teal-50 transition-colors flex items-center gap-1"><HelpCircle size={14} /> Ask</button>}
                </div>;
              })}</div> : <textarea value={quiz.results[index]?.answer || draft} onChange={event => setDraft(event.target.value)} disabled={!!quiz.results[index]} rows={5} placeholder="Write your answer..." aria-label="Your answer" className="mt-6 w-full px-4 py-3 bg-white text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 placeholder-slate-400" />}
              {result && <div role="status" className={`mt-6 rounded-xl border p-4 ${result.isCorrect ? 'border-teal-200 bg-teal-50' : 'border-red-200 bg-red-50'}`}>
                <p className={`font-semibold flex items-center gap-2 ${result.isCorrect ? 'text-teal-700' : 'text-red-700'}`}>
                  {result.isCorrect ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                  {result.isCorrect ? 'Correct' : result.skipped ? 'Skipped' : 'Not quite'}
                </p>
                {!result.isCorrect && <p className="mt-2 text-sm text-slate-700">Correct answer: <span className="font-medium text-slate-900">{displayAnswer(question)}</span></p>}
                {result.feedback && !result.skipped && <p className="mt-2 text-sm text-slate-700">{result.feedback}</p>}
                {question.explanation && <p className="mt-2 text-sm text-slate-600"><span className="font-medium">Why:</span> {question.explanation}</p>}
              </div>}
              {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button type="button" disabled={index === 0 || busy} onClick={() => goTo(index - 1)} className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 font-medium disabled:opacity-50 flex items-center gap-1"><ChevronLeft size={16} /> Back</button>
                <div className="flex-1" />
                {result ? (
                  isLast
                    ? <button type="button" disabled={busy} onClick={() => void retryFinish()} className="px-5 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 text-white font-medium shadow-md shadow-teal-500/20 disabled:opacity-50">{busy ? 'Saving...' : 'See results'}</button>
                    : <button type="button" disabled={busy} onClick={() => goTo(index + 1)} className="px-5 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 text-white font-medium shadow-md shadow-teal-500/20 flex items-center gap-1">Next <ChevronRight size={16} /></button>
                ) : <>
                  <button type="button" disabled={busy} onClick={() => submit(true)} className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 font-medium disabled:opacity-50">Skip</button>
                  <button type="button" disabled={busy || !draft.trim()} onClick={() => submit()} className="px-5 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 text-white font-medium shadow-md shadow-teal-500/20 disabled:opacity-50">{busy ? 'Checking...' : 'Check answer'}</button>
                </>}
              </div>
            </section>
            <aside aria-label="Ask about this question" className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex flex-col lg:sticky lg:top-6">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2"><HelpCircle size={18} className="text-teal-600" /> Ask about this question</h2>
              <p className="mt-1 text-xs text-slate-500">Clarifies wording and terms. Won't give away the answer.</p>
              <div className="mt-4 space-y-2 max-h-80 overflow-y-auto" aria-live="polite">
                {!thread.length && !clarifyBusy && <p className="text-sm text-slate-500">Not sure what a term or choice means? Ask here. This stays out of your chat.</p>}
                {thread.map((message, i) => <div key={i} className={`text-sm leading-relaxed whitespace-pre-wrap px-3 py-2 rounded-xl ${message.sender === 'user' ? 'ml-6 bg-teal-50 text-teal-900' : 'mr-2 bg-slate-100 text-slate-700'}`}>{message.text}</div>)}
                {clarifyBusy && <div className="inline-flex items-center gap-1 px-3 py-3 rounded-xl bg-slate-100"><span className="w-2 h-2 bg-slate-400 rounded-full typing-dot" /><span className="w-2 h-2 bg-slate-400 rounded-full typing-dot" /><span className="w-2 h-2 bg-slate-400 rounded-full typing-dot" /></div>}
                <div ref={clarifyEnd} />
              </div>
              <form onSubmit={event => { event.preventDefault(); void askClarify(); }} className="mt-4 flex gap-2">
                <input ref={clarifyInput} value={clarifyDraft} onChange={event => { setClarifyDraft(event.target.value); setClarifyError(''); }} placeholder="What does ATP stand for?" aria-label="Clarifying question" className="flex-1 min-w-0 px-3 py-2 text-sm bg-white text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 placeholder-slate-400" />
                <button type="submit" disabled={clarifyBusy} aria-label="Send clarifying question" className="px-3 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 text-white disabled:opacity-50"><Send size={16} /></button>
              </form>
              {clarifyError && <p role="alert" className="mt-2 text-xs text-red-600">{clarifyError}</p>}
            </aside>
          </div>
        </div>
      )}
    </main>
  );
}

type QuizChat = { chat_id: string; title?: string; graph_id?: string };

function QuizLanding() {
  const navigate = useNavigate();
  const [chats, setChats] = useState<QuizChat[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [length, setLength] = useState<5 | 10 | 15>(5);
  const [format, setFormat] = useState('mixed');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const user = await axios.get(`${API_BASE_URL}/chat/user`, { withCredentials: true });
        const response = await axios.get(`${API_BASE_URL}/chat/${user.data}/chats`, { withCredentials: true });
        const available = (Array.isArray(response.data) ? response.data : []).filter((chat: QuizChat) => !!chat.graph_id);
        if (active) {
          setChats(available);
          setSelectedId(available[0]?.chat_id || '');
        }
      } catch (err) {
        console.error('Could not load quiz documents', err);
        if (active) setError('Could not load your documents. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const selected = chats.find(chat => chat.chat_id === selectedId);
  const saved = selected ? readQuiz(selected.chat_id) : null;
  const resume = !!saved && !saved.completed;
  const openQuiz = () => {
    if (!selected?.graph_id) return;
    if (saved?.completed) localStorage.removeItem(quizKey(selected.chat_id));
    const query = new URLSearchParams({ chatId: selected.chat_id, graphId: selected.graph_id, title: selected.title || '', length: String(length), format });
    navigate(`/quiz?${query.toString()}`);
  };

  return <main className="min-h-screen bg-gradient-to-br from-teal-50/50 via-slate-50 to-blue-50/50 text-slate-800">
    <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 px-4 sm:px-8 py-4 flex items-center gap-4">
      <button onClick={() => navigate('/chat')} className="flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-700"><ArrowLeft size={18} /> Dashboard</button>
      <h1 className="text-xl font-semibold text-slate-800">Quizzes</h1>
    </header>
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <section className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 sm:p-8">
        <h2 className="text-2xl font-semibold text-slate-800">Start a quiz</h2>
        <p className="mt-2 text-slate-600">Choose a document you uploaded, then answer one question at a time.</p>
        {loading ? <p className="mt-8 text-slate-600">Loading your documents...</p> : error ? <p role="alert" className="mt-8 text-red-600">{error}</p> : !chats.length ? <div className="mt-8"><p className="text-slate-600">No uploaded documents are ready for a quiz yet.</p><button onClick={() => navigate('/chat')} className="mt-4 px-4 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 text-white font-medium">Go to Dashboard</button></div> : <>
          <label htmlFor="quiz-document" className="block mt-8 text-sm font-medium text-slate-600">Document</label>
          <select id="quiz-document" value={selectedId} onChange={event => setSelectedId(event.target.value)} className="mt-2 w-full px-4 py-3 bg-white text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400">
            {chats.map(chat => <option key={chat.chat_id} value={chat.chat_id}>{chat.title || 'Untitled document'}</option>)}
          </select>
          <div className="mt-5 grid sm:grid-cols-2 gap-4">
            <div><label htmlFor="quiz-length" className="block text-sm font-medium text-slate-600">Quiz length</label><select id="quiz-length" value={length} onChange={event => setLength(Number(event.target.value) as 5 | 10 | 15)} disabled={resume} className="mt-2 w-full px-4 py-3 bg-white text-slate-900 border border-slate-200 rounded-lg disabled:opacity-50"><option value={5}>5 questions</option><option value={10}>10 questions</option><option value={15}>15 questions</option></select></div>
            <div><label htmlFor="quiz-format" className="block text-sm font-medium text-slate-600">Question type</label><select id="quiz-format" value={format} onChange={event => setFormat(event.target.value)} disabled={resume} className="mt-2 w-full px-4 py-3 bg-white text-slate-900 border border-slate-200 rounded-lg disabled:opacity-50"><option value="mixed">Mixed (Random)</option><option value="mcq">Multiple Choice</option><option value="true-false">True/False</option><option value="open-ended">Open-Ended</option></select></div>
          </div>
          {resume && <p className="mt-4 text-sm text-slate-600">You have a quiz in progress for this document.</p>}
          <button onClick={openQuiz} className="mt-8 px-5 py-2.5 rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 text-white font-medium shadow-md shadow-teal-500/20">{resume ? 'Resume Quiz' : 'Start Quiz'}</button>
        </>}
      </section>
    </div>
  </main>;
}

export default function Quiz() {
  const [params] = useSearchParams();
  return params.get('chatId') && params.get('graphId') ? <QuizRunner /> : <QuizLanding />;
}
