//Chat.tsx
import React, { useState, useEffect, useRef, ChangeEvent, useCallback } from 'react';
import { Send, Bot, User, MessageSquare, ChevronLeft, ChevronRight, Plus, Paperclip, X, FileText, Image, File, Trash2, Pencil, Check, Home, Settings, UserCircle, ClipboardList } from 'lucide-react';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import GraphVisualization from '../components/GraphVisualization';
import { API_BASE_URL } from '../config/api';
import { clearQuiz, readQuiz } from '../lib/quizState';
import { centerNodeName } from '../lib/graphTree';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  file?: {
    name: string;
    type: string;
    url: string;
  };
}

interface Chat {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messages: Message[];
  graph_id?: string;
}

// Add interface for concept progress
interface ConceptProgress {
  conceptId: string;
  confidenceScore: number;
  lastAttempted?: Date;
}


function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentChatId, setCurrentChatId] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [graphData, setGraphData] = useState<any>(null);
  const [conceptProgress, setConceptProgress] = useState<ConceptProgress[]>([]); // Add state for concept progress
  const [quizLength, setQuizLength] = useState<5 | 10 | 15>(5);
  const [questionFormat, setQuestionFormat] = useState<'mixed' | 'mcq' | 'true-false' | 'open-ended'>('mixed');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const deletingChatRef = useRef<string | null>(null);
  const renameInFlightRef = useRef<string | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const latestGraphRequestRef = useRef<string | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [loadingDots, setLoadingDots] = useState('');

  const navigate = useNavigate();
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);

  const currentChat = chats.find(chat => chat.id === currentChatId) ?? null;
  const savedQuiz = currentChatId ? readQuiz(currentChatId) : null;
  const [input, setInput] = useState('');
  const [isGraphLoading, setIsGraphLoading] = useState(false);

  // Generate robust unique IDs to avoid duplicate keys when multiple messages are created in the same millisecond
  const generateMessageId = () => {
    try {
      if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return (crypto as any).randomUUID();
      }
    } catch (_) {
      // ignore and fallback
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

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessingFile) {
      interval = setInterval(() => {
        setLoadingDots(dots => dots.length >= 3 ? '' : dots + '.');
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isProcessingFile]);

  // Add function to fetch concept progress
  const fetchConceptProgress = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/concept-progress`, {
        withCredentials: true
      });
      setConceptProgress(response.data);
      console.log('Fetched concept progress:', response.data);
    } catch (error) {
      console.error('Error fetching concept progress:', error);
      // Set empty array on error to avoid breaking the UI
      setConceptProgress([]);
    }
  }, []);

  const generateAIResponse = async (userMessage: string, fileType?: string) => {
    let aiResponse = '';

    if (fileType) {
      if (fileType.startsWith('image/')) {
        aiResponse = 'I see you\'ve shared an image. What would you like me to help you with regarding this image?';
      } else if (fileType.includes('document') || fileType.includes('pdf')) {
        aiResponse = 'I\'ve received your document. What aspects would you like me to review or analyze?';
      } else {
        aiResponse = 'I\'ve received your file. How can I help you with it?';
      }
    } else {
      const lowerMessage = userMessage.toLowerCase();
      if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
        aiResponse = 'Hello! It\'s great to meet you. How can I assist you today?';
      } else if (lowerMessage.includes('help')) {
        aiResponse = 'I\'d be happy to help! Could you please provide more details about what you need assistance with?';
      } else if (lowerMessage.includes('thank')) {
        aiResponse = 'You\'re welcome! Is there anything else you\'d like to know?';
      } else if (lowerMessage.includes('bye')) {
        aiResponse = 'Goodbye! Feel free to return if you have more questions!';
      } else {
        aiResponse = 'That\'s an interesting point! Could you tell me more about what you\'re thinking?';
      }
    }

    return {
      id: generateMessageId(),
      content: aiResponse,
      sender: 'ai' as const,
      timestamp: new Date(),
    };
  };

  const isPlaceholderGraph = (payload: any): boolean => {
    const nodes = payload?.graph?.nodes;
    if (!Array.isArray(nodes) || nodes.length === 0) {
      return true;
    }
    if (nodes.length > 1) {
      return false;
    }

    const node = nodes[0] || {};
    const labels = Array.isArray(node.labels) ? node.labels.map((l: string) => String(l).toLowerCase()) : [];
    const propSubject = String(node?.properties?.subject ?? '').toLowerCase();
    const topSubject = String(payload?.subject ?? '').toLowerCase();
    if (
      labels.some((l) => l.includes('graphmetadata')) &&
      (propSubject === 'default' || topSubject === 'default')
    ) {
      return true;
    }

    const id = String(node.id || '').toLowerCase();
    const label = String(node?.labels?.[0] || '').toLowerCase();
    const name = String(node?.properties?.name || '').toLowerCase();
    const text = String(node?.properties?.text || '').toLowerCase();
    return [id, label, name, text].some((value) => value === 'default' || value.includes('placeholder'));
  };

  const fetchGraphData = async (graphId?: string, expectedChatId?: string) => {
    if (!graphId) return;
    const requestKey = `${graphId}:${expectedChatId ?? ''}:${Date.now()}`;
    latestGraphRequestRef.current = requestKey;
    setIsGraphLoading(true);

    try {
      const maxAttempts = 20;
      let selectedData: any = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        // Abort stale retries if a newer graph request has been issued.
        if (latestGraphRequestRef.current !== requestKey) {
          return;
        }

        const response = await axios.get(`${API_BASE_URL}/api/view-graph`, {
          params: {
            graph_id: graphId,
            t: Date.now(), // cache buster to avoid stale graph responses
          },
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
          withCredentials: true,
        });

        const payload = response.data;
        const placeholder = isPlaceholderGraph(payload);
        console.log(`[Graph] Fetch attempt ${attempt}/${maxAttempts} for ${graphId} placeholder=${placeholder}`);

        if (!placeholder || attempt === maxAttempts) {
          selectedData = payload;
          break;
        }

        // Delay allows backend graph persistence/indexing to complete.
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      if (!selectedData) {
        throw new Error('Failed to load graph data');
      }

      if (latestGraphRequestRef.current !== requestKey) {
        return;
      }

      setCurrentChatId((currentId) => {
        if (!expectedChatId || currentId === expectedChatId) {
          setGraphData({ ...selectedData, graph_id: graphId });
          void fetchConceptProgress();
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

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert('Please upload a PDF file');
        return;
      }

      setSelectedFile(file);
      setGraphData(null);
      try {
        setIsProcessingFile(true);
        const formData = new FormData();
        formData.append('file', file);

        console.log('Uploading file:', {
          name: file.name,
          type: file.type,
          size: file.size
        });

        // Always create a fresh graph for each uploaded document.
        // Reusing old graph_id can cause stale/default graph carry-over.
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

        // Read the SSE stream for progress updates
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let responseData: any = null;
        let buffer = '';

        if (!reader) {
          throw new Error('Failed to read response stream');
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          // Keep the last potentially incomplete line in the buffer
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
                  const baseError = event.error || 'Failed to process file';
                  throw new Error(event.details ? `${baseError} (${event.details})` : baseError);
                }
              } catch (parseErr) {
                if (parseErr instanceof SyntaxError) {
                  console.warn('[Upload] Skipping malformed SSE line:', line);
                } else {
                  throw parseErr;
                }
              }
            }
          }
        }

        console.log('[Upload] Parsed response data:', responseData);

        if (!responseData) {
          throw new Error('No response data received from server');
        }

        const processed = responseData.processed_chunks;
        const uploadStatus = responseData.status;
        if (
          typeof processed === 'number' &&
          processed < 1 &&
          uploadStatus !== 'cancelled'
        ) {
          const firstFail =
            Array.isArray(responseData.failed_chunks) && responseData.failed_chunks.length > 0
              ? String((responseData.failed_chunks[0] as { error?: string })?.error || '')
              : '';
          throw new Error(
            firstFail ||
              'No concepts were written to the graph (0 chunks processed). On GCP, verify OPENAI_API_KEY / LLM config and Neo4j env on the AI service, and PYTHON_SERVICE_URL on the Node service.'
          );
        }

        const fileUploadMessage: Message = {
          id: generateMessageId(),
          content: `Uploaded file: ${file.name}`,
          sender: 'user',
          timestamp: new Date(),
          file: {
            name: file.name,
            type: file.type,
            url: URL.createObjectURL(file)
          }
        };

        await axios.post(`${API_BASE_URL}/chat/message`, {
          chat_id: currentChatId,
          sender: 'user',
          text: fileUploadMessage.content,
        }, { withCredentials: true });

        setChats(prevChats => prevChats.map(chat =>
          chat.id === currentChatId
            ? {
                ...chat,
                lastMessage: fileUploadMessage.content,
                timestamp: new Date(),
                messages: [...chat.messages, fileUploadMessage],
              }
            : chat
        ));

        if (responseData.graph_id) {
          await axios.post(`${API_BASE_URL}/chat/message`, {
            chat_id: currentChatId,
            graph_id: responseData.graph_id,
          }, { withCredentials: true });

          setChats(prevChats => prevChats.map(chat => 
            chat.id === currentChatId
              ? { ...chat, graph_id: responseData.graph_id }
              : chat
          ));
        }

        const uploadIncludesGraph = responseData?.graph && !isPlaceholderGraph(responseData);
        if (uploadIncludesGraph) {
          // Prefer graph data returned by process-pdf when available.
          // This avoids a second fetch race where view-graph can briefly return placeholder data.
          setCurrentChatId((currentId) => {
            if (currentId === currentChatId) {
              setGraphData({ ...responseData, graph_id: responseData.graph_id });
              void fetchConceptProgress();
            }
            return currentId;
          });
        } else {
          await fetchGraphData(responseData.graph_id, currentChatId);
        }
        

      } catch (error) {
        // If the user cancelled, just silently exit — no error message needed
        if (error instanceof DOMException && error.name === 'AbortError') {
          console.log('PDF upload cancelled by user');
          const cancelMsg: Message = {
            id: generateMessageId(),
            content: 'Upload cancelled.',
            sender: 'ai',
            timestamp: new Date(),
          };
          setChats(prevChats => prevChats.map(chat =>
            chat.id === currentChatId
              ? { ...chat, lastMessage: cancelMsg.content, timestamp: new Date(), messages: [...chat.messages, cancelMsg] }
              : chat
          ));
          return;
        }

        console.error('Detailed upload error:', error);
        let errorMessage = 'Failed to upload file. Please try again.';
        
        if (error instanceof Error) {
          console.error('Error details:', {
            message: error.message,
            stack: error.stack
          });
          errorMessage = error.message;
        }
        
        const errorMsg: Message = {
          id: generateMessageId(),
          content: errorMessage,
          sender: 'ai',
          timestamp: new Date(),
        };

        setChats(prevChats => prevChats.map(chat =>
          chat.id === currentChatId
            ? {
                ...chat,
                lastMessage: errorMessage,
                timestamp: new Date(),
                messages: [...chat.messages, errorMsg],
              }
            : chat
        ));

        await axios.post(`${API_BASE_URL}/chat/message`, {
          chat_id: currentChatId,
          sender: 'ai',
          text: errorMessage,
        }, { withCredentials: true });
        
        alert(errorMessage);
      } finally {
        uploadAbortRef.current = null;
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setIsProcessingFile(false);
        setUploadProgress(0);
        setProgressMessage('');
      }
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    // 2. Create the user message object.
    const userMessage: Message = {
      id: generateMessageId(),
      content: trimmedInput,
      sender: 'user',
      timestamp: new Date(),
    };

    // 3. Clear the input field.
    setInput('');

    // 4. Update the chat state with the new user message.
    // This is asynchronous, but that's okay because we've already captured the last question.
    setChats(prevChats => prevChats.map(chat => 
      chat.id === currentChatId
        ? {
            ...chat,
            lastMessage: trimmedInput,
            timestamp: new Date(),
            messages: [...chat.messages, userMessage],
          }
        : chat
    ));

    // 5. Save the user message to the backend.
    try {
      await axios.post(`${API_BASE_URL}/chat/message`, {
        chat_id: currentChatId,
        sender: 'user',
        text: trimmedInput,
      }, { withCredentials: true });
    } catch (error) {
      console.error('Error saving message:', error);
    }

    if (currentChat?.graph_id) {
    try {
      setIsTyping(true);
        console.log('[Conversation] Sending request', { message: trimmedInput, graph_id: currentChat.graph_id });
      const response = await axios.post(
          `${API_BASE_URL}/api/generate-conversation-response`,
          { message: trimmedInput, graph_id: currentChat.graph_id },
        { withCredentials: true }
      );
        console.log('[Conversation] Raw response', response.data);
      const aiMessage: Message = {
          id: generateMessageId(),
          content: response.data.response || response.data.message || 'I received your message.',
        sender: 'ai',
        timestamp: new Date(),
      };

      setChats(prevChats => prevChats.map(chat =>
        chat.id === currentChatId
          ? {
              ...chat,
              lastMessage: aiMessage.content,
              timestamp: new Date(),
              messages: [...chat.messages, aiMessage],
            }
          : chat
      ));

      // Save AI response to backend
      await axios.post(`${API_BASE_URL}/chat/message`, {
        chat_id: currentChatId,
        sender: 'ai',
        text: aiMessage.content,
      }, { withCredentials: true });
    } catch (error) {
        console.error('Error generating conversation response:', error);
        const errorMessage: Message = {
          id: generateMessageId(),
          content: 'Sorry, I could not generate a response. Please retry or rephrase.',
          sender: 'ai',
          timestamp: new Date(),
        };
        setChats(prevChats => prevChats.map(chat =>
          chat.id === currentChatId
            ? { ...chat, messages: [...chat.messages, errorMessage] }
            : chat
        ));
        try {
          await axios.post(`${API_BASE_URL}/chat/message`, {
            chat_id: currentChatId,
            sender: 'ai',
            text: errorMessage.content,
          }, { withCredentials: true });
        } catch (persistErr) {
          console.error('Failed to persist AI error message', persistErr);
        }
    } finally {
      setIsTyping(false);
    }    
    } else {
      try {
        setIsTyping(true);
        const aiMessage = await generateAIResponse(input);
        
        setChats(prevChats => prevChats.map(chat => 
          chat.id === currentChatId
            ? {
                ...chat,
                lastMessage: aiMessage.content,
                timestamp: new Date(),
                messages: [...chat.messages, aiMessage],
              }
            : chat
        ));

        await axios.post(`${API_BASE_URL}/chat/message`, {
          chat_id: currentChatId,
          sender: 'ai',
          text: aiMessage.content,
        }, { withCredentials: true });
      } catch (error) {
        console.error('Error generating AI response:', error);
        const errorMessage: Message = {
          id: generateMessageId(),
          content: "Sorry, I encountered an error while generating a response. Please try again.",
          sender: 'ai',
          timestamp: new Date(),
        };

        setChats(prevChats => prevChats.map(chat =>
          chat.id === currentChatId
            ? {
                ...chat,
                messages: [...chat.messages, errorMessage],
              }
            : chat
        ));

        await axios.post(`${API_BASE_URL}/chat/message`, {
          chat_id: currentChatId,
          sender: 'ai',
          text: errorMessage.content,
        }, { withCredentials: true });
      } finally {
        setIsTyping(false);
      }
    }
  };

  const handleChatSelect = (chatId: string) => {
    // Clear graph data immediately when switching chats to prevent showing wrong graph
    setGraphData(null);
    setCurrentChatId(chatId);
  };

  const handleNewChat = useCallback(async () => {
    try {
      console.log('Creating new chat...');
      
      // Clear graph state immediately when creating new chat
      setGraphData(null);
  
      const response = await axios.post(`${API_BASE_URL}/chat/new`, {}, { withCredentials: true });

      console.log('Create chat response:', response.data);
  
      const newChatFromBackend = response.data.chat;
  
      const newChat: Chat = {
        id: newChatFromBackend.chat_id,
        title: 'New Chat',
        lastMessage: 'Hello! I am your personal assistant. I will show you the Smart Path to your studies. Please upload a PDF file to get started.',
        timestamp: new Date(newChatFromBackend.date_created),
        messages: [
          {
            id: 'welcome',
            content: 'Hello! I am your personal assistant. I will show you the Smart Path to your studies. Please upload a PDF file to get started.',
            sender: 'ai',
            timestamp: new Date(),
          },
        ],
      };
  
      console.log('New chat object to add to state:', newChat);
  
      setChats(prev => [newChat, ...prev.filter(chat => chat.id !== newChat.id)]);
      setCurrentChatId(newChat.id);

      const welcomeMessage = 'Hello! I am your personal assistant. I will show you the Smart Path to your studies. Please upload a PDF file to get started.';

      await axios.post(`${API_BASE_URL}/chat/message`, {
        chat_id: newChat.id,
        sender: 'ai',
        text: welcomeMessage,
      }, { withCredentials: true });
 
      return newChat;

    } catch (error: any) {
      console.error('Error creating new chat:', error);
      if (error.response) {
        console.error('Backend error response:', error.response.data);
      }
      alert('Failed to create a new chat.');
      return undefined;
    }
  }, []);

  const fetchUserChats = useCallback(async (createIfEmpty = false) => {
    setChatsLoading(true);
    try {
      const resUser = await axios.get(`${API_BASE_URL}/chat/user`, {
        withCredentials: true
      });
      const userId = resUser.data;

      if (!userId) {
        console.warn('No user ID returned while fetching chats');
        setChatsLoading(false);
        return;
      }

      const resChats = await axios.get(`${API_BASE_URL}/chat/${userId}/chats`, {
        withCredentials: true
      });
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
        lastMessage: chat.messages?.at?.(-1)?.text || 'No messages yet',
        timestamp: new Date(chat.date_created),
        messages: (chat.messages || []).map((msg: any, index: number) => ({
          id: `${chat.chat_id}-${index}`,
          content: msg.text,
          sender: msg.sender,
          timestamp: new Date(msg.timestamp),
        })),
        graph_id: chat.graph_id,
      }));

      setChats(formattedChats);
      setCurrentChatId(prevId => {
        if (prevId && formattedChats.some(chat => chat.id === prevId)) {
          return prevId;
        }
        return formattedChats[0]?.id ?? prevId;
      });
    } catch (err) {
      console.error('Error fetching chats:', err);
    } finally {
      setChatsLoading(false);
    }
  }, [handleNewChat]);

  useEffect(() => {
    fetchUserChats(true);
  }, [fetchUserChats]);

  useEffect(() => {
    if (!currentChatId && chats.length > 0) {
      setCurrentChatId(chats[0].id);
    }
  }, [chats, currentChatId]);

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return <Image className="w-5 h-5" />;
    } else if (type.includes('document') || type.includes('pdf')) {
      return <FileText className="w-5 h-5" />;
    }
    return <File className="w-5 h-5" />;
  };

  const handleRenameChat = async (chatId: string) => {
    if (renamingChatId !== chatId) return;
    if (renameInFlightRef.current === chatId) return;

    const trimmed = renameValue.trim();
    const currentTitle = chats.find(c => c.id === chatId)?.title ?? '';
    renameInFlightRef.current = chatId;
    setRenamingChatId(null);
    if (!trimmed || trimmed === currentTitle) {
      renameInFlightRef.current = null;
      return;
    }

    // Optimistic update
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: trimmed } : c));
    try {
      await axios.patch(`${API_BASE_URL}/chat/rename/${chatId}`, { title: trimmed }, { withCredentials: true });
    } catch (err) {
      console.error('Error renaming chat:', err);
      // Revert on failure by refetching
      fetchUserChats(false);
    } finally {
      renameInFlightRef.current = null;
    }
  };

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (deletingChatRef.current === chatId) {
      console.log('⚠️ Delete already in progress for chat:', chatId);
      return;
    }

    console.log('🗑️ Delete button clicked for chat:', chatId);
    console.log('Current chats:', chats.map(c => c.id));

    deletingChatRef.current = chatId;

    console.log('✅ Proceeding with delete...');
    console.log('Sending DELETE request to:', `${API_BASE_URL}/chat/delete/${chatId}`);

    console.log('Updating local state optimistically...');
    setChats(prev => {
      const beforeCount = prev.length;
      const filtered = prev.filter(chat => chat.id !== chatId);
      console.log(`Chats: ${beforeCount} -> ${filtered.length} (removed ${beforeCount - filtered.length})`);
      return filtered;
    });
    
    if (currentChatId === chatId) {
      console.log('Clearing current chat ID because it was deleted');
      setCurrentChatId('');
    }

    try {
      const response = await axios.delete(`${API_BASE_URL}/chat/delete/${chatId}`, {
        withCredentials: true,
      });

      console.log('✅ Delete response received:', response.data);
      console.log('Response status:', response.status);
      console.log('✅ Chat deleted successfully on server');
      
      deletingChatRef.current = null;
      
    } catch (error: any) {
      console.error('❌ Error deleting chat on server:', error);
      
      deletingChatRef.current = null;
      console.error('Error details:', {
        message: error?.message,
        response: error?.response,
        status: error?.response?.status,
        data: error?.response?.data
      });
      
      console.log('Restoring chat in UI since server deletion failed...');
      await fetchUserChats(false);
      
      if (error?.response) {
        console.error('Backend error status:', error.response.status);
        console.error('Backend error response:', error.response.data);
        alert(`Failed to delete chat: ${error.response.data?.message || error.response.statusText || 'Unknown error'}`);
      } else if (error?.request) {
        console.error('No response received from server');
        alert('Failed to delete chat: No response from server. Is the server running?');
      } else {
        console.error('Request setup error:', error.message);
        alert(`Failed to delete chat: ${error.message}`);
      }
    }
  };

  const ResizeHandle = ({ className = '' }) => (
    <PanelResizeHandle className={`w-2 hover:bg-teal-500/20 transition-colors duration-150 ${className}`}>
      <div className="h-full w-[2px] bg-gray-200 mx-auto" />
    </PanelResizeHandle>
  );

  const startQuiz = () => {
    if (!currentChat?.graph_id) return;
    if (savedQuiz?.completed) clearQuiz(currentChatId);
    const query = new URLSearchParams({
      chatId: currentChatId,
      graphId: currentChat.graph_id,
      title: currentChat.title,
      length: String(quizLength),
      format: questionFormat,
    });
    navigate(`/quiz?${query.toString()}`);
  };

  // Load the graph when the chat changes
  useEffect(() => {
      const currentChat = chats.find(chat => chat.id === currentChatId);
    if (currentChat?.graph_id) {
      setGraphData(null);
      setIsGraphLoading(true);
      fetchGraphData(currentChat.graph_id, currentChatId);
    } else {
      // This is a chat without a document/graph, so reset everything.
      latestGraphRequestRef.current = null;
      setIsGraphLoading(false);
      setGraphData(null);
    }
  }, [currentChatId, currentChat?.graph_id]); // Dependency array ensures this runs when the chat changes

  // Name untitled chats after their graph's center topic. Only touches the default "New Chat"
  // title, so chats the user renamed are left alone.
  useEffect(() => {
    if (!currentChat || currentChat.title !== 'New Chat' || !graphData?.graph || isPlaceholderGraph(graphData)) return;
    if (graphData.graph_id !== currentChat.graph_id) return; // graph still belongs to the previous chat
    const title = centerNodeName(graphData.graph);
    if (!title) return;
    const chatId = currentChat.id;
    setChats(prev => prev.map(chat => chat.id === chatId ? { ...chat, title } : chat));
    axios.patch(`${API_BASE_URL}/chat/rename/${chatId}`, { title }, { withCredentials: true }).catch(err => {
      console.error('Could not auto-name chat', err);
      setChats(prev => prev.map(chat => chat.id === chatId && chat.title === title ? { ...chat, title: 'New Chat' } : chat));
    });
  }, [graphData, currentChat]);

  // Show loading state while fetching chats
  if (chatsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-teal-50 via-slate-50 to-blue-50">
        <div className="text-center space-y-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
          <p className="text-slate-500">Loading chats...</p>
        </div>
      </div>
    );
  }

  // Only show "No chats yet" if loading is complete and there are no chats
  if (!currentChat && chats.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-teal-50 via-slate-50 to-blue-50">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-semibold text-slate-800">No chats yet</h2>
          <p className="text-slate-500">Start a new conversation to begin chatting with your study assistant.</p>
          <button
            onClick={() => void handleNewChat()}
            className="px-6 py-2.5 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all duration-200 shadow-md shadow-teal-500/20 btn-lift"
          >
            Start a New Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-teal-50/50 via-slate-50 to-blue-50/50">
      <div
        className={`${
          isSidebarCollapsed ? 'w-12' : 'w-64'
        } bg-slate-900 flex flex-col transition-all duration-300`}
      >
        <div className="p-4 border-b border-slate-700/50 flex justify-between items-center">
          {!isSidebarCollapsed && (
            <h2 className="text-lg font-semibold text-slate-100">Chat History</h2>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1 hover:bg-slate-700/50 rounded-lg transition-colors duration-150"
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-slate-400" />
            )}
          </button>
        </div>
        
        <button
          onClick={() => void handleNewChat()}
          className={`m-4 p-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all duration-200 flex items-center justify-center gap-2 shadow-md shadow-teal-500/20 btn-lift ${
            isSidebarCollapsed ? 'p-2' : ''
          }`}
        >
          <Plus className="w-5 h-5" />
          {!isSidebarCollapsed && <span>New Chat</span>}
        </button>

        {!isSidebarCollapsed && (
          <div className="flex-1 overflow-y-auto">
            {chats
              .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
              .map((chat) => (
              <div
                key={chat.id}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button[title="Delete chat"]') || (e.target as HTMLElement).closest('button[title="Rename chat"]') || renamingChatId === chat.id) {
                    return;
                  }
                  handleChatSelect(chat.id);
                }}
                className={`p-3 hover:bg-slate-800/70 cursor-pointer border-b border-slate-700/30 transition-colors duration-150 relative group ${
                  currentChatId === chat.id ? 'bg-slate-800 border-l-2 border-l-teal-400' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <MessageSquare className="w-5 h-5 text-teal-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    {renamingChatId === chat.id ? (
                      <form
                        onSubmit={(e) => { e.preventDefault(); handleRenameChat(chat.id); }}
                        className="flex items-center gap-1"
                      >
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => handleRenameChat(chat.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setRenamingChatId(null);
                              setRenameValue(chat.title);
                            }
                          }}
                          className="w-full bg-slate-700 text-slate-200 text-sm rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-teal-400"
                        />
                        <button type="submit" className="p-0.5 hover:bg-teal-500/20 rounded flex-shrink-0" title="Confirm rename">
                          <Check className="w-3.5 h-3.5 text-teal-400" />
                        </button>
                      </form>
                    ) : (
                      <>
                        <h3 className="text-sm font-medium text-slate-200 truncate">
                          {chat.title}
                        </h3>
                        <p className="text-xs text-slate-500 truncate">{chat.lastMessage}</p>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setRenamingChatId(chat.id);
                        setRenameValue(chat.title);
                      }}
                      className="opacity-0 group-hover:opacity-70 hover:!opacity-100 p-1.5 hover:bg-teal-500/20 rounded transition-all duration-150 z-50 relative flex-shrink-0"
                      title="Rename chat"
                      type="button"
                    >
                      <Pencil className="w-3.5 h-3.5 text-teal-400 hover:text-teal-300" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        console.log('Delete button onClick triggered for chat:', chat.id);
                        handleDeleteChat(chat.id, e);
                      }}
                      className="opacity-0 group-hover:opacity-70 hover:!opacity-100 p-1.5 hover:bg-red-500/20 rounded transition-all duration-150 z-50 relative flex-shrink-0"
                      title="Delete chat"
                      type="button"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-300" />
                    </button>
                  </div>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {(() => {
                    const now = new Date();
                    const diff = now.getTime() - chat.timestamp.getTime();
                    const mins = Math.floor(diff / 60000);
                    const hrs = Math.floor(diff / 3600000);
                    const days = Math.floor(diff / 86400000);
                    if (mins < 1) return 'Just now';
                    if (mins < 60) return `${mins}m ago`;
                    if (hrs < 24) return `${hrs}h ago`;
                    if (days === 1) return 'Yesterday';
                    if (days < 7) return `${days}d ago`;
                    return chat.timestamp.toLocaleDateString();
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="p-4 border-t border-slate-700/50 flex flex-col gap-2">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors flex items-center gap-2 text-slate-400 hover:text-slate-200" title="Home">
            <Home className="w-5 h-5" />
            {!isSidebarCollapsed && <span className="text-sm">Home</span>}
          </button>
          <button onClick={() => navigate('/quiz')} className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors flex items-center gap-2 text-slate-400 hover:text-slate-200" title="Quizzes">
            <ClipboardList className="w-5 h-5" />
            {!isSidebarCollapsed && <span className="text-sm">Quizzes</span>}
          </button>
          <button onClick={() => navigate('/profile')} className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors flex items-center gap-2 text-slate-400 hover:text-slate-200" title="Profile">
            <User className="w-5 h-5" />
            {!isSidebarCollapsed && <span className="text-sm">Profile</span>}
          </button>
          <button className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors flex items-center gap-2 text-slate-400 hover:text-slate-200 opacity-50 cursor-not-allowed" title="Settings (coming soon)">
            <Settings className="w-5 h-5" />
            {!isSidebarCollapsed && <span className="text-sm">Settings</span>}
          </button>
        </div>
      </div>

      <PanelGroup direction="horizontal" className="flex-1">
        <Panel defaultSize={40} minSize={20}>
          <div className="h-full p-4 bg-transparent">
            <div className="h-full rounded-xl bg-white/80 backdrop-blur-sm border border-slate-200/60 shadow-sm">
              {isProcessingFile ? (
                <div className="h-full flex flex-col items-center justify-center px-8">
                  <FileText className="w-12 h-12 text-teal-500 mb-4 animate-pulse" />
                  <p className="text-gray-800 text-lg font-semibold mb-1">
                    Processing your PDF{loadingDots}
                  </p>
                  <p className="text-gray-500 text-sm mb-6">
                    {progressMessage || 'Extracting concepts and building your knowledge graph'}
                  </p>
                  <div className="w-full max-w-xs">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-center text-xs text-gray-400 mt-2">{uploadProgress}%</p>
                  </div>
                  <button
                    onClick={async () => {
                      // 1. Abort the client-side fetch (closes SSE connection)
                      uploadAbortRef.current?.abort();
                      // 2. Tell the server to cancel the AI processing
                      try {
                        await fetch(`${API_BASE_URL}/upload/cancel-processing`, { method: 'POST', credentials: 'include' });
                      } catch {
                        // Best-effort — server may already have cleaned up
                      }
                      // 3. Reset client UI state
                      setIsProcessingFile(false);
                      setSelectedFile(null);
                      setUploadProgress(0);
                      setProgressMessage('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="mt-6 px-4 py-2 text-sm text-red-500 border border-red-300 rounded-lg hover:bg-red-50 transition-colors duration-150"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <GraphVisualization data={graphData} conceptProgress={conceptProgress} isLoading={isGraphLoading} />
              )}
            </div>
          </div>
        </Panel>

        <ResizeHandle className="w-2 hover:bg-teal-400/20 transition-colors duration-150" />

        <Panel minSize={30}>
          <div className="h-full flex flex-col">
            <div className="bg-white/80 backdrop-blur-sm p-4 border-b border-slate-200/60 flex justify-between items-center" style={{ zIndex: 1000, position: 'relative' }}>
              <h1 className="text-xl font-semibold text-slate-800 flex-1 min-w-0 truncate">{currentChat?.title || 'Loading...'}</h1>
              <div className="flex items-center gap-4 flex-wrap max-w-full flex-shrink-0" style={{ zIndex: 100, position: 'relative' }}>
                {/* Quiz Length Control */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-slate-600">Quiz Length:</label>
                  <select
                    value={quizLength}
                    onChange={(e) => setQuizLength(Number(e.target.value) as 5 | 10 | 15)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 cursor-pointer bg-white hover:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all max-w-[9rem]"
                    style={{ zIndex: 101, position: 'relative', pointerEvents: 'auto' }}
                  >
                    <option value={5}>5 questions</option>
                    <option value={10}>10 questions</option>
                    <option value={15}>15 questions</option>
                  </select>
                </div>
                
                {/* Question Type Control */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-600">Question Type:</label>
                  <select
                    value={questionFormat}
                    onChange={(e) => setQuestionFormat(e.target.value as 'mixed' | 'mcq' | 'true-false' | 'open-ended')}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 cursor-pointer bg-white hover:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all max-w-[11rem]"
                    style={{ zIndex: 101, position: 'relative', pointerEvents: 'auto' }}
                  >
                    <option value="mixed">Mixed (Random)</option>
                    <option value="mcq">Multiple Choice</option>
                    <option value="true-false">True/False</option>
                    <option value="open-ended">Open-Ended</option>
                  </select>
                </div>
                
                {/* Divider */}
                <div className="h-8 w-px bg-slate-200"></div>
                
                <button
                  onClick={() => {
                    if (currentChat?.graph_id) {
                      navigate('/progress');
                    } else {
                      alert("Please upload a document to view progress.");
                    }
                  }}
                  className="px-4 py-2 bg-white text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50 hover:border-teal-300 transition-all duration-200 flex items-center justify-center gap-2 font-medium shadow-sm btn-lift"
                >
                  View Progress
                </button>
                
                
                
                {currentChat?.graph_id && (
                  <button
                    onClick={startQuiz}
                    className="px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white hover:from-teal-600 hover:to-teal-700 shadow-md shadow-teal-500/20 animate-gentle-pulse rounded-lg transition-all duration-200 flex items-center gap-2 font-medium btn-lift"
                    title="Start quiz based on this document"
                  >
                    {savedQuiz && !savedQuiz.completed ? 'Resume Quiz' : savedQuiz?.completed ? 'Start New Quiz' : 'Start Quiz'}
                  </button>
                )}
              </div>
            </div>

            {/* Quiz lives on /quiz; chat only links back to it */}
            {savedQuiz && !savedQuiz.completed && currentChat?.graph_id && (
              <div className="mx-4 mt-3 px-4 py-2.5 bg-teal-50 border border-teal-200 rounded-lg flex items-center gap-3 text-sm text-teal-800">
                <ClipboardList className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">Quiz in progress · {savedQuiz.results.filter(Boolean).length} of {savedQuiz.qaData.length} answered</span>
                <button
                  onClick={startQuiz}
                  className="px-3 py-1.5 bg-gradient-to-r from-teal-500 to-teal-600 text-white hover:from-teal-600 hover:to-teal-700 rounded-lg font-medium transition-all duration-200"
                >
                  Resume quiz
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-slate-50/80 to-slate-100/50">
              {currentChat?.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} ${message.sender === 'user' ? 'animate-slide-in-right' : 'animate-slide-in-left'} group/msg`}
                >
                  <div
                    className={`flex items-end gap-2 max-w-[75%] ${
                      message.sender === 'user' ? 'flex-row-reverse' : ''
                    }`}
                  >
                    {/* Avatar */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.sender === 'user'
                        ? 'bg-gradient-to-br from-teal-400 to-teal-600'
                        : 'bg-gradient-to-br from-slate-200 to-slate-300'
                    }`}>
                      {message.sender === 'user' ? (
                        <User className="w-3.5 h-3.5 text-white" />
                      ) : (
                        <Bot className="w-3.5 h-3.5 text-slate-600" />
                      )}
                    </div>
                    {/* Bubble */}
                    <div
                      className={`px-3.5 py-2.5 ${
                        message.sender === 'user'
                          ? 'bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-2xl rounded-br-md shadow-md shadow-teal-500/15'
                          : 'bg-white text-slate-800 rounded-2xl rounded-bl-md border border-slate-200/60 shadow-sm'
                      }`}
                    >
                      <div className="text-sm whitespace-pre-wrap leading-relaxed">
                        {message.content}
                      </div>
                      {message.file && (
                        <div className={`mt-2 p-2 rounded-lg ${
                          message.sender === 'user' ? 'bg-white/20' : 'bg-slate-100'
                        }`}>
                          <div className="flex items-center space-x-2">
                            {getFileIcon(message.file.type)}
                            <a
                              href={message.file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`text-sm truncate underline ${
                                message.sender === 'user' ? 'text-white hover:text-teal-100' : 'text-teal-600 hover:text-teal-500'
                              }`}
                            >
                              {message.file.name}
                            </a>
                          </div>
                          {message.file.type.startsWith('image/') && (
                            <img
                              src={message.file.url}
                              alt={message.file.name}
                              className="mt-2 max-w-full h-auto rounded-lg"
                            />
                          )}
                        </div>
                      )}
                      {/* Hover timestamp */}
                      <div className={`text-[10px] mt-1 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-200 ${
                        message.sender === 'user' ? 'text-teal-100' : 'text-slate-400'
                      }`}>
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start animate-slide-in-left">
                  <div className="flex items-end gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 flex-shrink-0">
                      <Bot className="w-3.5 h-3.5 text-slate-600" />
                    </div>
                    <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-md border border-slate-200/60 shadow-sm">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-slate-400 rounded-full typing-dot"></span>
                        <span className="w-2 h-2 bg-slate-400 rounded-full typing-dot"></span>
                        <span className="w-2 h-2 bg-slate-400 rounded-full typing-dot"></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="p-4 bg-white/80 backdrop-blur-sm border-t border-slate-200/60">
              {isProcessingFile && (
                <div className="mb-2 p-3 bg-teal-50 border border-teal-200 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-teal-700">
                      {progressMessage || 'Processing PDF...'}
                    </span>
                    <span className="text-xs font-semibold text-teal-600">{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 bg-teal-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              {selectedFile && !isProcessingFile && (
                <div className="mb-2 p-2 bg-slate-50 rounded-lg flex items-center justify-between border border-slate-200/60">
                  <div className="flex items-center space-x-2">
                    {getFileIcon(selectedFile.type)}
                    <span className="text-sm text-slate-600 truncate">{selectedFile.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2 bg-white text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 placeholder-slate-400 transition-all"
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingFile}
                  className="px-4 py-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/30 flex items-center transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <button
                  type="submit"
                  disabled={isTyping}
                  className="px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/30 flex items-center transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-teal-500/20 btn-lift"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

export default App;
