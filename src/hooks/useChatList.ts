import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { toneForStoredMessage } from '../lib/chatTone';
import { generateMessageId } from '../lib/messageId';
import type { Chat, Message } from '../types/chat';

export type SetChats = Dispatch<SetStateAction<Chat[]>>;

const WELCOME_MESSAGE =
  'Hello! I am your personal assistant. I will show you the Smart Path to your studies. Please upload a PDF file to get started.';

/** Message as stored by the backend */
interface StoredMessage {
  text: string;
  sender: Message['sender'];
  timestamp: string;
}

/** Chat as returned by /chat/:userId/chats */
interface StoredChat {
  chat_id: string;
  title?: string;
  date_created: string;
  messages?: StoredMessage[];
  graph_id?: string;
  folder_id?: string | null;
}

interface UseChatListOptions {
  showErrorToast: (message: string) => void;
  flashNewItem: (id: string) => void;
}

/** Chat list, the open chat, and the chat-level actions: create, rename, delete, and error replies */
export function useChatList({ showErrorToast, flashNewItem }: UseChatListOptions) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState('');
  const [chatsLoading, setChatsLoading] = useState(true);

  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInFlightRef = useRef<string | null>(null);

  const [chatToDelete, setChatToDelete] = useState<Chat | null>(null);
  const deletingChatRef = useRef<string | null>(null);

  const currentChat = chats.find((chat) => chat.id === currentChatId) ?? null;

  // Adds an error bubble to a chat and raises the same message in the toast
  const appendErrorMessage = useCallback(
    (chatId: string, content: string) => {
      const errorMessage: Message = {
        id: generateMessageId(),
        content,
        sender: 'ai',
        timestamp: new Date(),
        tone: 'error',
      };
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, messages: [...c.messages, errorMessage] } : c)),
      );
      showErrorToast(content);
    },
    [showErrorToast],
  );

  const createChat = useCallback(async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/chat/new`, {}, { withCredentials: true });
      const newChatFromBackend = response.data.chat;

      const newChat: Chat = {
        id: newChatFromBackend.chat_id,
        title: 'New Chat',
        timestamp: new Date(newChatFromBackend.date_created),
        messages: [{ id: 'welcome', content: WELCOME_MESSAGE, sender: 'ai', timestamp: new Date() }],
      };

      setChats((prev) => [newChat, ...prev.filter((c) => c.id !== newChat.id)]);
      setCurrentChatId(newChat.id);
      flashNewItem(newChat.id);

      await axios.post(
        `${API_BASE_URL}/chat/message`,
        { chat_id: newChat.id, sender: 'ai', text: WELCOME_MESSAGE },
        { withCredentials: true },
      );

      return newChat;
    } catch (error) {
      console.error('Error creating new chat:', error);
      showErrorToast('Failed to create a new chat.');
      return undefined;
    }
  }, [flashNewItem, showErrorToast]);

  const fetchUserChats = useCallback(
    async (createIfEmpty = false) => {
      setChatsLoading(true);
      try {
        const resUser = await axios.get(`${API_BASE_URL}/chat/user`, { withCredentials: true });
        const userId = resUser.data;
        if (!userId) {
          setChatsLoading(false);
          return;
        }

        const resChats = await axios.get<StoredChat[]>(`${API_BASE_URL}/chat/${userId}/chats`, { withCredentials: true });
        const userChats = Array.isArray(resChats.data) ? resChats.data : [];

        if (userChats.length === 0) {
          if (createIfEmpty) {
            await createChat();
          } else {
            setChats([]);
            setCurrentChatId('');
          }
          setChatsLoading(false);
          return;
        }

        const formattedChats: Chat[] = userChats.map((chat) => ({
          id: chat.chat_id,
          title: chat.title || 'Chat',
          timestamp: new Date(chat.date_created),
          messages: (chat.messages || []).map((msg, index) => ({
            id: `${chat.chat_id}-${index}`,
            content: msg.text,
            sender: msg.sender,
            timestamp: new Date(msg.timestamp),
            tone: toneForStoredMessage(msg.sender, String(msg.text ?? '')),
          })),
          graph_id: chat.graph_id,
          folder_id: chat.folder_id ?? null,
        }));

        setChats(formattedChats);
        setCurrentChatId((prevId) => {
          if (prevId && formattedChats.some((chat) => chat.id === prevId)) {
            return prevId;
          }
          return formattedChats[0]?.id ?? prevId;
        });
      } catch (err) {
        console.error('Error fetching chats:', err);
      } finally {
        setChatsLoading(false);
      }
    },
    [createChat],
  );

  useEffect(() => {
    void fetchUserChats(true);
  }, [fetchUserChats]);

  // Saves a new title. Shared by the sidebar rename and the workspace header title.
  const saveChatTitle = useCallback(
    async (chatId: string, rawTitle: string) => {
      if (renameInFlightRef.current === chatId) return;
      const trimmed = rawTitle.trim();
      const currentTitle = chats.find((c) => c.id === chatId)?.title ?? '';
      renameInFlightRef.current = chatId;
      if (!trimmed || trimmed === currentTitle) {
        renameInFlightRef.current = null;
        return;
      }

      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, title: trimmed } : c)));
      try {
        await axios.patch(`${API_BASE_URL}/chat/rename/${chatId}`, { title: trimmed }, { withCredentials: true });
      } catch {
        void fetchUserChats(false);
      } finally {
        renameInFlightRef.current = null;
      }
    },
    [chats, fetchUserChats],
  );

  const beginRenameChat = useCallback((chatId: string, title: string) => {
    setRenamingChatId(chatId);
    setRenameValue(title);
  }, []);

  const cancelRenameChat = useCallback(() => setRenamingChatId(null), []);

  // Sidebar rename: the row's input has been open and holds renameValue
  const handleRenameChat = useCallback(
    async (chatId: string) => {
      if (renamingChatId !== chatId || renameInFlightRef.current === chatId) return;
      const value = renameValue;
      setRenamingChatId(null);
      await saveChatTitle(chatId, value);
    },
    [renamingChatId, renameValue, saveChatTitle],
  );

  const requestDeleteChat = useCallback((chat: Chat) => setChatToDelete(chat), []);
  const cancelDeleteChat = useCallback(() => setChatToDelete(null), []);

  const confirmDeleteChat = useCallback(async () => {
    if (!chatToDelete) return;
    const chatId = chatToDelete.id;
    setChatToDelete(null);
    if (deletingChatRef.current === chatId) return;
    deletingChatRef.current = chatId;

    setChats((prev) => prev.filter((c) => c.id !== chatId));
    setCurrentChatId((currentId) => (currentId === chatId ? '' : currentId));

    try {
      await axios.delete(`${API_BASE_URL}/chat/delete/${chatId}`, { withCredentials: true });
      sessionStorage.removeItem('progressPageCache:v2');
    } catch (err) {
      console.error('Error deleting chat:', err);
      showErrorToast('Failed to delete chat.');
      void fetchUserChats(false);
    } finally {
      deletingChatRef.current = null;
    }
  }, [chatToDelete, fetchUserChats, showErrorToast]);

  return {
    chats,
    setChats,
    currentChatId,
    setCurrentChatId,
    currentChat,
    chatsLoading,
    createChat,
    appendErrorMessage,
    saveChatTitle,
    renamingChatId,
    renameValue,
    setRenameValue,
    beginRenameChat,
    cancelRenameChat,
    handleRenameChat,
    chatToDelete,
    requestDeleteChat,
    cancelDeleteChat,
    confirmDeleteChat,
  };
}
