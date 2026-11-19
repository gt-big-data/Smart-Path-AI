// Browser cache for the current quiz. New runs and verified results also persist on the server.
export type Question = {
  question: string;
  answer: string;
  conceptId: string;
  /** Topic the question tests; saved with progress so the Progress page can always label it */
  conceptName?: string;
  explanation?: string;
  format?: string;
};

export type Result = { answer: string; isCorrect: boolean | null; feedback: string; skipped: boolean };
export type ClarifyMessage = { sender: 'user' | 'ai'; text: string };
export type QuizState = {
  quizId?: string;
  scoreAvailable?: boolean;
  attemptId: string;
  qaData: Question[];
  currentQuestionIndex: number;
  results: (Result | null)[];
  completed: boolean;
  clarifications?: ClarifyMessage[][];
};

export const quizKey = (chatId: string) => `quizState:${chatId}`;

export function readQuiz(chatId: string): QuizState | null {
  try {
    const raw = localStorage.getItem(quizKey(chatId));
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved.qaData) || !saved.qaData.length) return null;
    const attemptId = saved.attemptId || crypto.randomUUID();
    if (!saved.attemptId) {
      localStorage.setItem(quizKey(chatId), JSON.stringify({ ...saved, attemptId }));
    }
    return {
      quizId: saved.quizId,
      scoreAvailable: saved.scoreAvailable,
      attemptId,
      qaData: saved.qaData,
      currentQuestionIndex: Math.min(saved.currentQuestionIndex || 0, saved.qaData.length - 1),
      results: Array.isArray(saved.results) ? saved.results : saved.qaData.map((_: Question, index: number) => {
        if (index >= (saved.currentQuestionIndex || 0)) return null;
        const answer = saved.userAnswers?.[index] || 'SKIPPED';
        return { answer, isCorrect: answer !== 'SKIPPED', feedback: '', skipped: answer === 'SKIPPED' };
      }),
      completed: !!saved.completed,
      clarifications: Array.isArray(saved.clarifications) ? saved.clarifications : undefined,
    };
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
