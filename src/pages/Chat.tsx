import React, {
  useState,
  useEffect,
  useRef,
  ChangeEvent,
  useCallback,
} from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { clearQuiz, readQuiz } from '../lib/quizState';
import { buildAskAssistantPrompt } from '../lib/quizQuestions';
import { centerNodeName } from '../lib/graphTree';
import { toneForStoredMessage } from '../lib/chatTone';
import { getSourceFileNames, getSourceFileUrl } from '../lib/sourceFiles';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/common/Icon';
import Sidebar from '../components/sidebar/Sidebar';
import WorkspaceHeader from '../components/workspace/WorkspaceHeader';
import WorkspaceDock, { type DockTab } from '../components/workspace/WorkspaceDock';
import GraphPanel from '../components/workspace/GraphPanel';
import AssistantPanel from '../components/workspace/AssistantPanel';
import DeleteConfirmModal from '../components/modals/DeleteConfirmModal';
import QuizModal from '../components/modals/QuizModal';
import Quiz, { type QuizSession } from './Quiz';
import MoveChatModal from '../components/modals/MoveChatModal';
import PracticeExamPanel from '../components/PracticeExamPanel';
import PracticeExamSetupModal from '../components/modals/PracticeExamSetupModal';
import ProgressPage from './ProgressPage';
import { Chat, Folder, Message, ConceptProgress } from '../types/chat';
import '../components/workspace/workspace.css';

// How long the graph loader stays up after a chat switch (matches the prototype timing)
const CHAT_SWITCH_LOADER_MS = 650;
// How long error toasts stay up before they dismiss themselves
const ERROR_TOAST_MS = 10000;
// How long a newly created chat or folder row stays highlighted
const NEW_ITEM_SHINE_MS = 1000;

interface ChatPageProps {
  /** 'progress' shows the progress page in the workspace area, with the same sidebar */
  view?: 'workspace' | 'progress';
}

export default function ChatPage({ view = 'workspace' }: ChatPageProps) {
  const { userName, logout } = useAuth();
  const navigate = useNavigate();

  // Sidebar & Layout State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // Practice exam taking over the chat area; null when it is closed
  const [examTab, setExamTab] = useState<{ id: string; chatId: string; examId: string } | null>(null);
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(244);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const sidebarResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Chat & Navigation State
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState('');
  const [chatsLoading, setChatsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Folders State
  const [folders, setFolders] = useState<Folder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [folderRenameValue, setFolderRenameValue] = useState('');
  const folderRenameInFlightRef = useRef<string | null>(null);

  // Renaming & Drag/Drop State
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInFlightRef = useRef<string | null>(null);
  const [draggedChatId, setDraggedChatId] = useState<string | null>(null);
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // Inline folder actions & Modals
  const [inlineFolderAction, setInlineFolderAction] = useState<{
    type: 'chat' | 'folder';
    id: string;
  } | null>(null);
  const [inlineFolderValue, setInlineFolderValue] = useState('');
  const [inlineFolderDestination, setInlineFolderDestination] = useState('');

  const [chatToDelete, setChatToDelete] = useState<Chat | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const deletingChatRef = useRef<string | null>(null);

  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [quizLength, setQuizLength] = useState<5 | 10 | 15>(5);
  const [questionFormat, setQuestionFormat] = useState<
    'mixed' | 'mcq' | 'true-false' | 'open-ended'
  >('mixed');
  // Quiz running in the Quiz dock tab; null when the tab is closed
  const [quizSession, setQuizSession] = useState<QuizSession | null>(null);

  const [moveModalChatId, setMoveModalChatId] = useState<string | null>(null);

  // Graph & Document Processing State
  const [graphData, setGraphData] = useState<any>(null);
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  // Shown for a fixed moment after every chat switch, so the graph loader is visible even when the graph is cached
  const [isChatSwitching, setIsChatSwitching] = useState(false);
  const switchedChatIdRef = useRef(currentChatId);
  const latestGraphRequestRef = useRef<string | null>(null);
  const [conceptProgress, setConceptProgress] = useState<ConceptProgress[]>([]);
  const [focusedConcept, setFocusedConcept] = useState<string | null>(null);
  const [focusClearToken, setFocusClearToken] = useState(0);

  // Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const uploadAbortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Messaging & Typing State
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Toasts
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const errorToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sidebar row highlighted after a chat or folder is created
  const [shiningId, setShiningId] = useState<string | null>(null);
  const shiningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showErrorToast = (message: string) => {
    if (errorToastTimeoutRef.current) clearTimeout(errorToastTimeoutRef.current);
    setErrorToast(message);
    errorToastTimeoutRef.current = setTimeout(() => setErrorToast(null), ERROR_TOAST_MS);
  };

  // Adds an error bubble to a chat and raises the same message in the toast
  const appendErrorMessage = (chatId: string, content: string) => {
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
  };

  const flashNewItem = (id: string) => {
    if (shiningTimeoutRef.current) clearTimeout(shiningTimeoutRef.current);
    setShiningId(id);
    shiningTimeoutRef.current = setTimeout(() => setShiningId(null), NEW_ITEM_SHINE_MS);
  };

  const currentChat = chats.find((chat) => chat.id === currentChatId) ?? null;
  const savedQuiz = currentChatId ? readQuiz(currentChatId) : null;
  // A quiz belongs to the chat it was started in, so it is only shown while that chat is open
  const activeQuiz = quizSession?.chatId === currentChatId ? quizSession : null;

  const getFolderPath = (folderId: string | null | undefined): string[] => {
    if (!folderId) return [];
    const folder = folders.find((item) => item.folder_id === folderId);
    if (!folder) return [];
    return [...getFolderPath(folder.parent_folder_id), folder.name];
  };
  const currentFolderPath = getFolderPath(currentChat?.folder_id);

  const generateMessageId = () => {
    try {
      if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return (crypto as any).randomUUID();
      }
    } catch (_) {
      // fallback below
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (currentChat) {
      scrollToBottom();
    }
  }, [currentChat]);

  // Sidebar Resizing
  const handleStartSidebarResize = (event: React.MouseEvent) => {
    event.preventDefault();
    setIsResizingSidebar(true);
    sidebarResizeRef.current = {
      startX: event.clientX,
      startWidth: sidebarWidth,
    };
  };

  useEffect(() => {
    if (!isResizingSidebar) return;
    const handleMouseMove = (event: MouseEvent) => {
      const resizeStart = sidebarResizeRef.current;
      if (!resizeStart) return;
      setSidebarWidth(
        Math.min(420, Math.max(210, resizeStart.startWidth + event.clientX - resizeStart.startX)),
      );
    };
    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      sidebarResizeRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar, sidebarWidth]);

  // Fetch Folders
  const fetchFolders = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/chat/folders`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setFolders(data);
    } catch (err) {
      console.error('Error fetching folders:', err);
    }
  };

  useEffect(() => {
    void fetchFolders();
  }, []);

  // Fetch Concept Progress
  const fetchConceptProgress = useCallback(async (chatId = currentChatId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/concept-progress`, {
        params: chatId ? { chat_id: chatId } : undefined,
        withCredentials: true,
      });
      setConceptProgress(response.data);
    } catch (error) {
      console.error('Error fetching concept progress:', error);
      setConceptProgress([]);
    }
  }, [currentChatId]);

  const isPlaceholderGraph = (payload: any): boolean => {
    const nodes = payload?.graph?.nodes;
    if (!Array.isArray(nodes) || nodes.length === 0) return true;
    if (nodes.length > 1) return false;
    const node = nodes[0] || {};
    const labels: string[] = Array.isArray(node.labels)
      ? node.labels.map((l: string) => String(l).toLowerCase())
      : [];
    const propSubject = String(node?.properties?.subject ?? '').toLowerCase();
    const topSubject = String(payload?.subject ?? '').toLowerCase();
    if (labels.some((l) => l.includes('graphmetadata')) && (propSubject === 'default' || topSubject === 'default')) {
      return true;
    }
    const id = String(node.id || '').toLowerCase();
    const label = String(node?.labels?.[0] || '').toLowerCase();
    const name = String(node?.properties?.name || '').toLowerCase();
    const text = String(node?.properties?.text || '').toLowerCase();
    return [id, label, name, text].some((value) => value === 'default' || value.includes('placeholder'));
  };

  // Fetch Graph Data
  const fetchGraphData = async (graphId?: string, expectedChatId?: string) => {
    if (!graphId) return;
    const requestKey = `${graphId}:${expectedChatId ?? ''}:${Date.now()}`;
    latestGraphRequestRef.current = requestKey;
    setIsGraphLoading(true);

    try {
      const maxAttempts = 20;
      let selectedData: any = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        if (latestGraphRequestRef.current !== requestKey) return;

        const response = await axios.get(`${API_BASE_URL}/api/view-graph`, {
          params: { graph_id: graphId, t: Date.now() },
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
          withCredentials: true,
        });

        const payload = response.data;
        const placeholder = isPlaceholderGraph(payload);

        if (!placeholder || attempt === maxAttempts) {
          selectedData = payload;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      if (!selectedData) throw new Error('Failed to load graph data');
      if (latestGraphRequestRef.current !== requestKey) return;

      setCurrentChatId((currentId) => {
        if (!expectedChatId || currentId === expectedChatId) {
          setGraphData({ ...selectedData, graph_id: graphId });
          void fetchConceptProgress(expectedChatId || currentChatId);
        }
        return currentId;
      });
    } catch (error) {
      console.error('Error fetching graph:', error);
      setCurrentChatId((currentId) => {
        if (!expectedChatId || currentId === expectedChatId) {
          setGraphData({ error: 'Failed to load graph data' });
        }
        return currentId;
      });
    } finally {
      if (latestGraphRequestRef.current === requestKey) {
        setIsGraphLoading(false);
      }
    }
  };

  // Fetch Chats
  const handleNewChat = useCallback(async () => {
    try {
      setGraphData(null);
      const response = await axios.post(`${API_BASE_URL}/chat/new`, {}, { withCredentials: true });
      const newChatFromBackend = response.data.chat;
      const welcomeMessage =
        'Hello! I am your personal assistant. I will show you the Smart Path to your studies. Please upload a PDF file to get started.';

      const newChat: Chat = {
        id: newChatFromBackend.chat_id,
        title: 'New Chat',
        timestamp: new Date(newChatFromBackend.date_created),
        messages: [
          {
            id: 'welcome',
            content: welcomeMessage,
            sender: 'ai',
            timestamp: new Date(),
          },
        ],
      };

      setChats((prev) => [newChat, ...prev.filter((c) => c.id !== newChat.id)]);
      setCurrentChatId(newChat.id);
      flashNewItem(newChat.id);

      await axios.post(
        `${API_BASE_URL}/chat/message`,
        {
          chat_id: newChat.id,
          sender: 'ai',
          text: welcomeMessage,
        },
        { withCredentials: true },
      );

      return newChat;
    } catch (error) {
      console.error('Error creating new chat:', error);
      showErrorToast('Failed to create a new chat.');
      return undefined;
    }
  }, []);

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

        const resChats = await axios.get(`${API_BASE_URL}/chat/${userId}/chats`, { withCredentials: true });
        const userChats = Array.isArray(resChats.data) ? resChats.data : [];

        if (userChats.length === 0) {
          if (createIfEmpty) {
            await handleNewChat();
          } else {
            setChats([]);
            setCurrentChatId('');
          }
          setChatsLoading(false);
          return;
        }

        const formattedChats: Chat[] = userChats.map((chat: any) => ({
          id: chat.chat_id,
          title: chat.title || 'Chat',
          timestamp: new Date(chat.date_created),
          messages: (chat.messages || []).map((msg: any, index: number) => ({
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
    [handleNewChat],
  );

  useEffect(() => {
    void fetchUserChats(true);
  }, [fetchUserChats]);

  // Hold the graph loader for a moment after each chat switch
  useEffect(() => {
    if (switchedChatIdRef.current === currentChatId) return;
    switchedChatIdRef.current = currentChatId;
    setIsChatSwitching(true);
    const timer = window.setTimeout(() => setIsChatSwitching(false), CHAT_SWITCH_LOADER_MS);
    return () => window.clearTimeout(timer);
  }, [currentChatId]);

  // Load graph when current chat changes
  useEffect(() => {
    const chat = chats.find((c) => c.id === currentChatId);
    if (chat?.graph_id) {
      setGraphData(null);
      setIsGraphLoading(true);
      void fetchGraphData(chat.graph_id, currentChatId);
    } else {
      latestGraphRequestRef.current = null;
      setIsGraphLoading(false);
      setGraphData(null);
    }
  }, [currentChatId, currentChat?.graph_id]);

  // Auto-name chat after its graph center
  useEffect(() => {
    if (!currentChat || currentChat.title !== 'New Chat' || !graphData?.graph || isPlaceholderGraph(graphData)) return;
    if (graphData.graph_id !== currentChat.graph_id) return;
    const title = centerNodeName(graphData.graph);
    if (!title) return;
    const chatId = currentChat.id;
    setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, title } : chat)));
    axios
      .patch(`${API_BASE_URL}/chat/rename/${chatId}`, { title }, { withCredentials: true })
      .catch((err) => {
        console.error('Could not auto-name chat', err);
        setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, title: 'New Chat' } : chat)));
      });
  }, [graphData, currentChat]);

  // Folder Actions
  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newFolderName.trim();
    if (!name) {
      setIsCreatingFolder(false);
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/chat/folder/new`,
        { name, parent_folder_id: newFolderParentId },
        { withCredentials: true },
      );
      if (response.status === 201 || response.status === 200) {
        const newFolder = response.data;
        setFolders((prev) => [...prev, newFolder]);
        flashNewItem(newFolder.folder_id);
        setExpandedFolders((prev) => ({
          ...prev,
          [newFolder.folder_id]: true,
          ...(newFolder.parent_folder_id ? { [newFolder.parent_folder_id]: true } : {}),
        }));
      }
    } catch (err: any) {
      console.error('Error creating folder:', err);
      showErrorToast(`Could not create folder: ${err.response?.data?.message || 'Server error'}`);
    } finally {
      setNewFolderName('');
      setNewFolderParentId(null);
      setIsCreatingFolder(false);
    }
  };

  const handleRenameFolder = async (folderId: string) => {
    if (renamingFolderId !== folderId || folderRenameInFlightRef.current === folderId) return;
    const trimmed = folderRenameValue.trim();
    const currentName = folders.find((f) => f.folder_id === folderId)?.name || '';
    setRenamingFolderId(null);
    if (!trimmed || trimmed === currentName) return;

    folderRenameInFlightRef.current = folderId;
    setFolders((prev) =>
      prev.map((folder) => (folder.folder_id === folderId ? { ...folder, name: trimmed } : folder)),
    );

    try {
      await axios.patch(
        `${API_BASE_URL}/chat/folder/${folderId}/rename`,
        { name: trimmed },
        { withCredentials: true },
      );
    } catch (err: any) {
      console.error('Error renaming folder:', err);
      void fetchFolders();
      showErrorToast(`Could not rename folder: ${err.response?.data?.message || 'Server error'}`);
    } finally {
      folderRenameInFlightRef.current = null;
    }
  };

  const handleDeleteFolder = async () => {
    if (!folderToDelete) return;
    const { folder_id: folderId, parent_folder_id: parentFolderId } = folderToDelete;
    setFolderToDelete(null);

    try {
      await axios.delete(`${API_BASE_URL}/chat/folder/${folderId}`, { withCredentials: true });
      setFolders((prev) =>
        prev
          .filter((item) => item.folder_id !== folderId)
          .map((item) =>
            item.parent_folder_id === folderId ? { ...item, parent_folder_id: parentFolderId || null } : item,
          ),
      );
      setChats((prev) =>
        prev.map((chat) => (chat.folder_id === folderId ? { ...chat, folder_id: null } : chat)),
      );
      setExpandedFolders((prev) => {
        const next = { ...prev };
        delete next[folderId];
        return next;
      });
    } catch (err: any) {
      console.error('Error deleting folder:', err);
      showErrorToast(`Failed to delete folder: ${err.response?.data?.message || 'Server error'}`);
    }
  };

  const handleMoveChat = async (chatId: string, folderId: string | null) => {
    try {
      const res = await fetch(`${API_BASE_URL}/chat/move-to-folder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ chat_id: chatId, folder_id: folderId }),
      });
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, folder_id: folderId } : chat)));
    } catch (err) {
      console.error('Error moving chat:', err);
      showErrorToast('Could not move chat to folder.');
    }
  };

  const handleMoveFolder = async (folderId: string, parentFolderId: string | null) => {
    try {
      const res = await fetch(`${API_BASE_URL}/chat/folder/${folderId}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ parent_folder_id: parentFolderId }),
      });
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      setFolders((prev) =>
        prev.map((folder) =>
          folder.folder_id === folderId ? { ...folder, parent_folder_id: parentFolderId } : folder,
        ),
      );
    } catch (err) {
      console.error('Error moving folder:', err);
      showErrorToast('Could not move folder.');
    }
  };

  const handleConfirmInlineFolderAction = async () => {
    if (!inlineFolderAction) return;
    if (inlineFolderAction.type === 'chat') {
      if (!inlineFolderDestination) return;
      if (inlineFolderDestination === 'new') {
        const name = inlineFolderValue.trim();
        if (!name) return;
        try {
          const res = await axios.post(
            `${API_BASE_URL}/chat/folder/new`,
            { name, parent_folder_id: null },
            { withCredentials: true },
          );
          const newFolder = res.data;
          setFolders((prev) => [...prev, newFolder]);
          await handleMoveChat(inlineFolderAction.id, newFolder.folder_id);
        } catch {
          showErrorToast('Could not create folder for chat.');
        }
      } else {
        await handleMoveChat(
          inlineFolderAction.id,
          inlineFolderDestination === 'root' ? null : inlineFolderDestination,
        );
      }
    } else {
      const name = inlineFolderValue.trim();
      if (!name) return;
      try {
        const res = await axios.post(
          `${API_BASE_URL}/chat/folder/new`,
          { name, parent_folder_id: inlineFolderAction.id },
          { withCredentials: true },
        );
        const newFolder = res.data;
        setFolders((prev) => [...prev, newFolder]);
        flashNewItem(newFolder.folder_id);
        setExpandedFolders((prev) => ({
          ...prev,
          [inlineFolderAction.id]: true,
          [newFolder.folder_id]: true,
        }));
      } catch {
        showErrorToast('Could not create subfolder.');
      }
    }
    setInlineFolderAction(null);
    setInlineFolderValue('');
    setInlineFolderDestination('');
  };

  // Chat Actions
  // Saves a new title for a chat. Shared by the sidebar rename and the workspace header title.
  const saveChatTitle = async (chatId: string, rawTitle: string) => {
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
      await axios.patch(
        `${API_BASE_URL}/chat/rename/${chatId}`,
        { title: trimmed },
        { withCredentials: true },
      );
    } catch {
      void fetchUserChats(false);
    } finally {
      renameInFlightRef.current = null;
    }
  };

  // Sidebar rename: the row's input has been open and holds renameValue
  const handleRenameChat = async (chatId: string) => {
    if (renamingChatId !== chatId || renameInFlightRef.current === chatId) return;
    const value = renameValue;
    setRenamingChatId(null);
    await saveChatTitle(chatId, value);
  };

  const confirmDeleteChat = async () => {
    if (!chatToDelete) return;
    const chatId = chatToDelete.id;
    setChatToDelete(null);
    if (deletingChatRef.current === chatId) return;
    deletingChatRef.current = chatId;

    setChats((prev) => prev.filter((c) => c.id !== chatId));
    if (currentChatId === chatId) setCurrentChatId('');

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
  };

  // Drag and drop handlers
  const handleFolderDragStart = (e: React.DragEvent, folderId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-smartpath-folder', folderId);
    setDraggedFolderId(folderId);
  };

  const handleFolderDrop = async (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const folderId = e.dataTransfer.getData('application/x-smartpath-folder') || draggedFolderId;
    const chatId = e.dataTransfer.getData('text/plain') || draggedChatId;
    setDragOverFolderId(null);
    setDraggedChatId(null);
    setDraggedFolderId(null);

    if (folderId && folderId !== targetFolderId) {
      await handleMoveFolder(folderId, targetFolderId);
    } else if (chatId) {
      await handleMoveChat(chatId, targetFolderId);
    }
  };

  const handleChatDragStart = (e: React.DragEvent, chatId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', chatId);
    setDraggedChatId(chatId);
  };

  const handleChatDropOnChat = async (e: React.DragEvent, targetChatId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceChatId = e.dataTransfer.getData('text/plain') || draggedChatId;
    setDragOverFolderId(null);
    setDraggedChatId(null);
    if (!sourceChatId || sourceChatId === targetChatId) return;

    const targetChat = chats.find((c) => c.id === targetChatId);
    if (targetChat?.folder_id) {
      await handleMoveChat(sourceChatId, targetChat.folder_id);
    } else {
      try {
        const res = await axios.post(
          `${API_BASE_URL}/chat/folder/new`,
          { name: 'New folder', parent_folder_id: null },
          { withCredentials: true },
        );
        const newFolder = res.data;
        setFolders((prev) => [...prev, newFolder]);
        await handleMoveChat(targetChatId, newFolder.folder_id);
        await handleMoveChat(sourceChatId, newFolder.folder_id);
      } catch {
        showErrorToast('Could not create folder for chats.');
      }
    }
  };

  const handleRootDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const chatId = e.dataTransfer.getData('text/plain') || draggedChatId;
    const folderId = e.dataTransfer.getData('application/x-smartpath-folder') || draggedFolderId;
    setDragOverFolderId(null);
    setDraggedChatId(null);
    setDraggedFolderId(null);

    if (chatId) {
      await handleMoveChat(chatId, null);
    } else if (folderId) {
      await handleMoveFolder(folderId, null);
    }
  };

  // Upload PDF Handler
  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      showErrorToast('Please upload a PDF file');
      return;
    }

    setSelectedFile(file);
    setGraphData(null);
    try {
      setIsProcessingFile(true);
      const formData = new FormData();
      formData.append('file', file);

      const url = `${API_BASE_URL}/upload/process-pdf`;
      setUploadProgress(0);
      setProgressMessage('Uploading PDF...');

      const abortController = new AbortController();
      uploadAbortRef.current = abortController;

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        signal: abortController.signal,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let responseData: any = null;
      let buffer = '';

      if (!reader) throw new Error('Failed to read response stream');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'progress') {
                setUploadProgress(event.percent);
                setProgressMessage(event.message);
              } else if (event.type === 'complete') {
                responseData = event.data;
                setUploadProgress(100);
                setProgressMessage('Processing complete!');
              } else if (event.type === 'error') {
                throw new Error(event.error || 'Failed to process file');
              }
            } catch (parseErr) {
              if (!(parseErr instanceof SyntaxError)) throw parseErr;
            }
          }
        }
      }

      if (!responseData) throw new Error('No response data received from server');

      const fileUploadMessage: Message = {
        id: generateMessageId(),
        content: `Uploaded file: ${file.name}`,
        sender: 'user',
        tone: 'success',
        timestamp: new Date(),
        file: {
          name: file.name,
          type: file.type,
          url: URL.createObjectURL(file),
        },
      };

      await axios.post(
        `${API_BASE_URL}/chat/message`,
        {
          chat_id: currentChatId,
          sender: 'user',
          text: fileUploadMessage.content,
        },
        { withCredentials: true },
      );

      setChats((prev) =>
        prev.map((c) =>
          c.id === currentChatId
            ? {
                ...c,
                timestamp: new Date(),
                messages: [...c.messages, fileUploadMessage],
                source_files: [...(c.source_files || []), file.name],
              }
            : c,
        ),
      );

      if (responseData.graph_id) {
        await axios.post(
          `${API_BASE_URL}/chat/message`,
          {
            chat_id: currentChatId,
            graph_id: responseData.graph_id,
          },
          { withCredentials: true },
        );

        setChats((prev) =>
          prev.map((c) =>
            c.id === currentChatId ? { ...c, graph_id: responseData.graph_id } : c,
          ),
        );
      }

      const uploadIncludesGraph = responseData?.graph && !isPlaceholderGraph(responseData);
      if (uploadIncludesGraph) {
        setCurrentChatId((currentId) => {
          if (currentId === currentChatId) {
            setGraphData({ ...responseData, graph_id: responseData.graph_id });
            void fetchConceptProgress(currentChatId);
          }
          return currentId;
        });
      } else {
        await fetchGraphData(responseData.graph_id, currentChatId);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      const message = error instanceof Error ? error.message : 'Upload failed. Please try again.';
      appendErrorMessage(currentChatId, `Error processing PDF: ${message}`);
    } finally {
      uploadAbortRef.current = null;
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsProcessingFile(false);
      setUploadProgress(0);
      setProgressMessage('');
    }
  };

  const handleCancelUpload = async () => {
    uploadAbortRef.current?.abort();
    try {
      await fetch(`${API_BASE_URL}/upload/cancel-processing`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Best-effort
    }
    setIsProcessingFile(false);
    setSelectedFile(null);
    setUploadProgress(0);
    setProgressMessage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Submit Chat Message
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
          ? {
              ...chat,
              timestamp: new Date(),
              messages: [...chat.messages, userMessage],
            }
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
        const aiMessage: Message = {
          id: generateMessageId(),
          content: response.data.response || response.data.message || 'I received your message.',
          sender: 'ai',
          timestamp: new Date(),
        };

        setChats((prev) =>
          prev.map((c) =>
            c.id === currentChatId ? { ...c, messages: [...c.messages, aiMessage] } : c,
          ),
        );

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
        const aiMessage: Message = {
          id: generateMessageId(),
          content: fallbackText,
          sender: 'ai',
          timestamp: new Date(),
        };
        setChats((prev) =>
          prev.map((c) =>
            c.id === currentChatId ? { ...c, messages: [...c.messages, aiMessage] } : c,
          ),
        );
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

  // Side tabs in the workspace dock. Each is shown only while its chat is open.
  const dockTabs: DockTab[] = [];
  if (activeQuiz) {
    dockTabs.push({
      id: 'tab-quiz',
      name: 'Quiz',
      sessionKey: activeQuiz.id,
      onRequestClose: () => setQuizSession(null),
      content: (
        <Quiz
          key={activeQuiz.id}
          session={activeQuiz}
          onClose={() => setQuizSession(null)}
          onAskAssistant={(question) => void handleSendMessage(buildAskAssistantPrompt(question))}
        />
      ),
    });
  }
  // The exam replaces the workspace (header and dock) while it is open, and is only shown for its own chat
  const activeExam = examTab && examTab.chatId === currentChatId && currentChat ? examTab : null;

  if (chatsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#fbfaf8]">
        <div className="text-center space-y-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#147d74]" />
          <p className="text-slate-500 text-sm">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="smartpath-workspace flex h-screen overflow-hidden bg-[#edf1f0] font-['Helvetica_Neue',Arial,sans-serif]">
      {errorToast && (
        <div
          role="alert"
          className="fixed bottom-5 right-5 z-[200] flex max-w-sm items-start gap-3 rounded border border-red-400/40 bg-[#1c1b2d] px-4 py-3 text-sm text-red-100 shadow-xl"
        >
          <span className="flex-1">{errorToast}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setErrorToast(null)}
            className="shrink-0 p-0.5 text-red-200 hover:text-white"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      )}

      {/* Modals */}
      {(folderToDelete || chatToDelete) && (
        <DeleteConfirmModal
          type={chatToDelete ? 'chat' : 'folder'}
          name={chatToDelete ? chatToDelete.title : folderToDelete?.name || ''}
          onClose={() => {
            setChatToDelete(null);
            setFolderToDelete(null);
          }}
          onConfirm={() => {
            if (chatToDelete) void confirmDeleteChat();
            else void handleDeleteFolder();
          }}
        />
      )}

      {isExamModalOpen && currentChat && (
        <PracticeExamSetupModal
          chatId={currentChatId}
          onClose={() => setIsExamModalOpen(false)}
          onOpenExam={(examId) => {
            setIsExamModalOpen(false);
            setExamTab({ id: String(Date.now()), chatId: currentChatId, examId });
          }}
        />
      )}

      {isQuizModalOpen && (
        <QuizModal
          quizLength={quizLength}
          questionFormat={questionFormat}
          conceptCount={graphData?.graph?.nodes?.length}
          onLengthChange={setQuizLength}
          onFormatChange={setQuestionFormat}
          onClose={() => setIsQuizModalOpen(false)}
          onGenerate={() => {
            setIsQuizModalOpen(false);
            handleStartQuiz();
          }}
        />
      )}

      {moveModalChatId && (
        <MoveChatModal
          folders={folders}
          currentFolderId={chats.find((c) => c.id === moveModalChatId)?.folder_id}
          onClose={() => setMoveModalChatId(null)}
          onMove={async (destFolderId, newName) => {
            if (newName) {
              try {
                const res = await axios.post(
                  `${API_BASE_URL}/chat/folder/new`,
                  { name: newName, parent_folder_id: null },
                  { withCredentials: true },
                );
                const newFolder = res.data;
                setFolders((prev) => [...prev, newFolder]);
                await handleMoveChat(moveModalChatId, newFolder.folder_id);
              } catch {
                showErrorToast('Could not create folder.');
              }
            } else {
              await handleMoveChat(moveModalChatId, destFolderId);
            }
            setMoveModalChatId(null);
          }}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        sidebarWidth={sidebarWidth}
        isResizing={isResizingSidebar}
        userName={userName}
        folders={folders}
        chats={chats}
        currentChatId={currentChatId}
        searchQuery={searchQuery}
        searchInputRef={searchInputRef}
        expandedFolders={expandedFolders}
        isCreatingFolder={isCreatingFolder}
        newFolderName={newFolderName}
        newFolderParentId={newFolderParentId}
        renamingFolderId={renamingFolderId}
        folderRenameValue={folderRenameValue}
        renamingChatId={renamingChatId}
        chatRenameValue={renameValue}
        dragOverFolderId={dragOverFolderId}
        draggedChatId={draggedChatId}
        draggedFolderId={draggedFolderId}
        inlineFolderAction={inlineFolderAction}
        inlineFolderValue={inlineFolderValue}
        inlineFolderDestination={inlineFolderDestination}
        shiningId={shiningId}
        onToggleCollapse={() => setIsSidebarCollapsed(true)}
        onOpenSidebar={() => setIsSidebarCollapsed(false)}
        onSearchChange={setSearchQuery}
        onClearSearch={() => setSearchQuery('')}
        onNewChat={() => void handleNewChat()}
        onStartCreateFolder={() => {
          setIsSidebarCollapsed(false);
          setNewFolderParentId(null);
          setIsCreatingFolder(true);
        }}
        onNewFolderNameChange={setNewFolderName}
        onCreateFolderSubmit={handleCreateFolderSubmit}
        onCancelCreateFolder={() => {
          setIsCreatingFolder(false);
          setNewFolderName('');
          setNewFolderParentId(null);
        }}
        onToggleExpandFolder={(fId) =>
          setExpandedFolders((prev) => ({ ...prev, [fId]: !prev[fId] }))
        }
        onBeginRenameFolder={(fId, name) => {
          setRenamingFolderId(fId);
          setFolderRenameValue(name);
        }}
        onRenameFolderChange={setFolderRenameValue}
        onRenameFolderSave={handleRenameFolder}
        onRenameFolderCancel={() => setRenamingFolderId(null)}
        onRequestDeleteFolder={(f, e) => {
          e.stopPropagation();
          setFolderToDelete(f);
        }}
        onOpenInlineSubfolder={(fId) => {
          setInlineFolderAction({ type: 'folder', id: fId });
          setInlineFolderValue('');
          setExpandedFolders((prev) => ({ ...prev, [fId]: true }));
        }}
        onCloseInlineAction={() => setInlineFolderAction(null)}
        onInlineValueChange={setInlineFolderValue}
        onInlineDestinationChange={setInlineFolderDestination}
        onConfirmInlineAction={handleConfirmInlineFolderAction}
        onFolderDragStart={handleFolderDragStart}
        onFolderDragEnd={() => {
          setDraggedFolderId(null);
          setDragOverFolderId(null);
        }}
        onFolderDragOver={(e, fId) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOverFolderId(fId);
        }}
        onFolderDragLeave={() => setDragOverFolderId(null)}
        onFolderDrop={handleFolderDrop}
        onSelectChat={(cId) => {
          // Picking a chat from the progress page returns to the workspace
          if (view === 'progress') navigate('/chat');
          // Re-selecting the open chat keeps its graph and open tabs
          if (cId === currentChatId) return;
          setGraphData(null);
          setQuizSession(null);
          setExamTab(null);
          setIsExamModalOpen(false);
          setCurrentChatId(cId);
        }}
        onBeginRenameChat={(cId, title) => {
          setRenamingChatId(cId);
          setRenameValue(title);
        }}
        onRenameChatChange={setRenameValue}
        onRenameChatSave={handleRenameChat}
        onRenameChatCancel={() => setRenamingChatId(null)}
        onRequestDeleteChat={(c, e) => {
          e.stopPropagation();
          setChatToDelete(c);
        }}
        onToggleMoveFolder={(cId) => {
          setInlineFolderAction((prev) =>
            prev?.type === 'chat' && prev.id === cId
              ? null
              : { type: 'chat', id: cId },
          );
          setInlineFolderDestination('root');
          setInlineFolderValue('');
        }}
        onChatDragStart={handleChatDragStart}
        onChatDragEnd={() => {
          setDraggedChatId(null);
          setDragOverFolderId(null);
        }}
        onChatDragOver={(e, cId) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOverFolderId(`chat-${cId}`);
        }}
        onChatDragLeave={() => setDragOverFolderId(null)}
        onChatDrop={handleChatDropOnChat}
        onRootDropOver={(e) => {
          e.preventDefault();
          setDragOverFolderId('root');
        }}
        onRootDropLeave={() => setDragOverFolderId(null)}
        onRootDrop={handleRootDrop}
        onStartSidebarResize={handleStartSidebarResize}
        onHome={() => navigate('/')}
        onProgress={() => navigate('/progress')}
        isProgressActive={view === 'progress'}
        onSettings={() => navigate('/profile')}
        onLogout={() => void logout()}
      />

      {/* Workspace Area */}
      <div
        className={`group flex min-w-0 flex-1 flex-col bg-[#edf1f0]${isSidebarCollapsed ? ' sidebar-is-collapsed' : ''}`}
      >
        {view === 'progress' ? (
          <ProgressPage />
        ) : activeExam && currentChat ? (
          <PracticeExamPanel
            key={activeExam.id}
            chatId={activeExam.chatId}
            examId={activeExam.examId}
            title={currentChat.title}
            onClose={() => setExamTab(null)}
          />
        ) : (
        <>
        <WorkspaceHeader
          title={currentChat?.title || 'Untitled chat'}
          breadcrumb={`Workspace${currentFolderPath.length ? ` / ${currentFolderPath.join(' / ')}` : ''}`}
          hasGraph={Boolean(currentChat?.graph_id)}
          onProgress={() =>
            currentChat?.graph_id
              ? navigate('/progress')
              : showErrorToast('Please upload a document to view progress.')
          }
          onRenameTitle={currentChat ? (title) => void saveChatTitle(currentChat.id, title) : undefined}
          onQuiz={() => setIsQuizModalOpen(true)}
          onExam={() => setIsExamModalOpen(true)}
          onUnavailable={() => showErrorToast('Please upload a document before starting this action.')}
        />

        <WorkspaceDock modelKey={currentChatId} tabs={dockTabs}>
          {/* Panel 0: Knowledge Graph */}
          <GraphPanel
            graphData={graphData}
            conceptProgress={conceptProgress}
            isGraphLoading={isGraphLoading || isChatSwitching}
            isProcessingFile={isProcessingFile}
            uploadProgress={uploadProgress}
            progressMessage={progressMessage}
            focusedConcept={focusedConcept}
            focusClearToken={focusClearToken}
            sourceFiles={getSourceFileNames(currentChat)}
            sourceFileUrl={getSourceFileUrl(currentChat)}
            onFocusChange={setFocusedConcept}
            onClearFocus={() => {
              setFocusedConcept(null);
              setFocusClearToken((t) => t + 1);
            }}
            onChooseFile={() => fileInputRef.current?.click()}
            onCancelUpload={handleCancelUpload}
          />

          {/* Panel 1: Study Assistant */}
          <AssistantPanel
            messages={currentChat?.messages || []}
            input={input}
            isTyping={isTyping}
            isProcessingFile={isProcessingFile}
            uploadProgress={uploadProgress}
            progressMessage={progressMessage}
            selectedFile={selectedFile}
            focusedConcept={focusedConcept}
            fileInputRef={fileInputRef}
            messagesEndRef={messagesEndRef}
            resumeQuiz={
              savedQuiz && !savedQuiz.completed && currentChat?.graph_id
                ? {
                    answered: savedQuiz.results.filter(Boolean).length,
                    total: savedQuiz.qaData.length,
                  }
                : null
            }
            onInputChange={setInput}
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendMessage();
            }}
            onSendMessageText={(text) => void handleSendMessage(text)}
            onAttach={() => fileInputRef.current?.click()}
            onFileSelect={handleFileSelect}
            onRemoveFile={() => {
              setSelectedFile(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            onClearFocus={() => {
              setFocusedConcept(null);
              setFocusClearToken((t) => t + 1);
            }}
            onResumeQuiz={handleResumeQuiz}
            fileIcon={() => <Icon name="file" size={16} />}
          />
        </WorkspaceDock>
        </>
        )}
      </div>

    </div>
  );
}
