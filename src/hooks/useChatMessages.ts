import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { generateMessageId } from '../lib/messageId';
import type { Chat, Message } from '../types/chat';
import type { SetChats } from './useChatList';

interface UseChatMessagesOptions {
  currentChat: Chat | null;
  currentChatId: string;
  setChats: SetChats;
  focusedConcept: string | null;
  appendErrorMessage: (chatId: string, content: string) => void;
}

/** Sends a user message, gets the assistant reply (graph-grounded or fallback), and keeps the thread scrolled to the latest message */
export function useChatMessages({
  currentChat,
  currentChatId,
  setChats,
  focusedConcept,
  appendErrorMessage,
}: UseChatMessagesOptions) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentChat) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentChat]);

  const appendAiMessage = (chatId: string, content: string) => {
    const aiMessage: Message = {
      id: generateMessageId(),
      content,
      sender: 'ai',
      timestamp: new Date(),
    };
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, messages: [...c.messages, aiMessage] } : c)),
    );
    return aiMessage;
  };

  const handleSendMessage = async (textToSend?: string) => {
    const trimmedInput = (textToSend ?? input).trim();
    if (!trimmedInput) return;

    const userMessage: Message = {
      id: generateMessageId(),
      content: trimmedInput,
      sender: 'user',
      timestamp: new Date(),
    };

    setInput('');

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === currentChatId
          ? { ...chat, timestamp: new Date(), messages: [...chat.messages, userMessage] }
          : chat,
      ),
    );

    try {
      await axios.post(
        `${API_BASE_URL}/chat/message`,
        { chat_id: currentChatId, sender: 'user', text: trimmedInput },
        { withCredentials: true },
      );
    } catch (err) {
      console.error('Error saving user message:', err);
    }

    if (currentChat?.graph_id) {
      try {
        setIsTyping(true);
        const response = await axios.post(
          `${API_BASE_URL}/api/generate-conversation-response`,
          {
            message: trimmedInput,
            graph_id: currentChat.graph_id,
            focused_concept: focusedConcept,
          },
          { withCredentials: true },
        );
        const content = response.data.response || response.data.message || 'I received your message.';
        const aiMessage = appendAiMessage(currentChatId, content);

        await axios.post(
          `${API_BASE_URL}/chat/message`,
          { chat_id: currentChatId, sender: 'ai', text: aiMessage.content },
          { withCredentials: true },
        );
      } catch (error) {
        console.error('Error generating AI response:', error);
        appendErrorMessage(
          currentChatId,
          'Sorry, I could not generate a response. Please retry or rephrase.',
        );
      } finally {
        setIsTyping(false);
      }
    } else {
      try {
        setIsTyping(true);
        const fallbackText = `I received your message about "${trimmedInput}". Please upload course material or notes so I can construct your knowledge graph and assist your studying effectively!`;
        const aiMessage = appendAiMessage(currentChatId, fallbackText);
        await axios.post(
          `${API_BASE_URL}/chat/message`,
          { chat_id: currentChatId, sender: 'ai', text: aiMessage.content },
          { withCredentials: true },
        );
      } catch (err) {
        console.error('Error with fallback reply:', err);
      } finally {
        setIsTyping(false);
      }
    }
  };

  return { input, setInput, isTyping, messagesEndRef, handleSendMessage };
}
