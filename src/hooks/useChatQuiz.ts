import { useState } from 'react';
import { clearQuiz, readQuiz } from '../lib/quizState';
import type { QuizSession } from '../pages/Quiz';
import type { Chat } from '../types/chat';

export type QuizLength = 5 | 10 | 15;
export type QuestionFormat = 'mixed' | 'mcq' | 'true-false' | 'open-ended';

interface UseChatQuizOptions {
  currentChatId: string;
  currentChat: Chat | null;
}

/** Quiz setup modal, the running quiz session for the open chat, and the saved quiz to resume */
export function useChatQuiz({ currentChatId, currentChat }: UseChatQuizOptions) {
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [quizLength, setQuizLength] = useState<QuizLength>(5);
  const [questionFormat, setQuestionFormat] = useState<QuestionFormat>('mixed');
  // Quiz running in the Quiz dock tab; null when the tab is closed
  const [quizSession, setQuizSession] = useState<QuizSession | null>(null);

  const savedQuiz = currentChatId ? readQuiz(currentChatId) : null;
  // A quiz belongs to the chat it was started in, so it is only shown while that chat is open
  const activeQuiz = quizSession?.chatId === currentChatId ? quizSession : null;

  const openQuizSession = (length: string, format: string) => {
    if (!currentChat?.graph_id) return;
    setQuizSession({
      id: String(Date.now()),
      chatId: currentChatId,
      graphId: currentChat.graph_id,
      title: currentChat.title,
      length,
      format,
    });
  };

  const handleStartQuiz = () => {
    if (savedQuiz?.completed) clearQuiz(currentChatId);
    openQuizSession(String(quizLength), questionFormat);
  };

  // Progress is restored from localStorage, so the settings only matter for a brand-new quiz
  const handleResumeQuiz = () => openQuizSession('5', 'mixed');

  return {
    isQuizModalOpen,
    setIsQuizModalOpen,
    quizLength,
    setQuizLength,
    questionFormat,
    setQuestionFormat,
    quizSession,
    setQuizSession,
    activeQuiz,
    savedQuiz,
    handleStartQuiz,
    handleResumeQuiz,
  };
}
