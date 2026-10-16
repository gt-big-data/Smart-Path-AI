// Quiz progress lives in localStorage per chat so the quiz page and the chat page agree on it.
export type Question = {
  question: string;
  answer: string;
  concept_id: string;
  explanation?: string;
  format?: string;
};

export type Result = { answer: string; isCorrect: boolean; feedback: string; skipped: boolean };
export type ClarifyMessage = { sender: 'user' | 'ai'; text: string };
export type QuizState = {
  quizId: string;
  qaData: Question[];
  currentQuestionIndex: number;
  results: (Result | null)[];
  completed: boolean;
  clarifications?: ClarifyMessage[][];
};

export const quizKey = (chatId: string) => `quizState:${chatId}`;

export const createQuizId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

export function readQuiz(chatId: string): QuizState | null {
  try {
    const raw = localStorage.getItem(quizKey(chatId));
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved.qaData) || !saved.qaData.length) return null;
    const qaData = saved.qaData.map((question: any) => ({
      ...question,
      concept_id: String(question.concept_id || question.topic_id || question.topicID || question.conceptId || question.topicId || '').trim(),
    }));
    const restored = {
      quizId: typeof saved.quizId === 'string' && saved.quizId ? saved.quizId : createQuizId(),
      qaData,
      currentQuestionIndex: Math.min(saved.currentQuestionIndex || 0, qaData.length - 1),
      results: Array.isArray(saved.results) ? saved.results : qaData.map((_: Question, index: number) => {
        if (index >= (saved.currentQuestionIndex || 0)) return null;
        const answer = saved.userAnswers?.[index] || 'SKIPPED';
        return { answer, isCorrect: answer !== 'SKIPPED', feedback: '', skipped: answer === 'SKIPPED' };
      }),
      completed: !!saved.completed,
      clarifications: Array.isArray(saved.clarifications) ? saved.clarifications : undefined,
    };
    if (!saved.quizId) localStorage.setItem(quizKey(chatId), JSON.stringify(restored));
    return restored;
  } catch {
    return null;
  }
}

export function clearQuiz(chatId: string) {
  try {
    localStorage.removeItem(quizKey(chatId));
  } catch {
    // storage unavailable; nothing to clear
  }
}
