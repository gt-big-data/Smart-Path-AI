import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { isPlaceholderGraph } from '../lib/graphPlaceholder';
import { centerNodeName } from '../lib/graphTree';
import type { Chat, ConceptProgress } from '../types/chat';
import type { SetChats } from './useChatList';

// How long the graph loader stays up after a chat switch (matches the prototype timing)
const CHAT_SWITCH_LOADER_MS = 650;
// Polling while the backend still returns a placeholder graph
const GRAPH_MAX_ATTEMPTS = 20;
const GRAPH_POLL_INTERVAL_MS = 2000;

interface UseChatGraphOptions {
  currentChatId: string;
  currentChat: Chat | null;
  setChats: SetChats;
}

/**
 * Knowledge graph of the open chat: loading and polling, concept progress,
 * the chat-switch loader, graph focus, and auto-naming a new chat after its graph center.
 */
export function useChatGraph({ currentChatId, currentChat, setChats }: UseChatGraphOptions) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- graph payload shape is owned by the backend
  const [graphData, setGraphData] = useState<any>(null);
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const [conceptProgress, setConceptProgress] = useState<ConceptProgress[]>([]);
  const [focusedConcept, setFocusedConcept] = useState<string | null>(null);
  const [focusClearToken, setFocusClearToken] = useState(0);

  // Shown for a fixed moment after every chat switch, so the loader is visible even when the graph is cached
  const [isChatSwitching, setIsChatSwitching] = useState(false);
  const switchedChatIdRef = useRef(currentChatId);
  const latestGraphRequestRef = useRef<string | null>(null);

  // Async graph results check this to drop responses for a chat the user already left
  const currentChatIdRef = useRef(currentChatId);
  currentChatIdRef.current = currentChatId;

  const fetchConceptProgress = useCallback(async (chatId: string) => {
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
  }, []);

  // Shows a loaded graph, unless it belongs to a chat that is no longer open
  const showGraph = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (payload: any, graphId: string | undefined, chatId?: string) => {
      if (chatId && currentChatIdRef.current !== chatId) return;
      setGraphData({ ...payload, graph_id: graphId });
      void fetchConceptProgress(chatId || currentChatIdRef.current);
    },
    [fetchConceptProgress],
  );

  // Polls /view-graph until the graph is no longer a placeholder
  const fetchGraphData = useCallback(
    async (graphId?: string, expectedChatId?: string) => {
      if (!graphId) return;
      const requestKey = `${graphId}:${expectedChatId ?? ''}:${Date.now()}`;
      latestGraphRequestRef.current = requestKey;
      setIsGraphLoading(true);

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let selectedData: any = null;

        for (let attempt = 1; attempt <= GRAPH_MAX_ATTEMPTS; attempt += 1) {
          if (latestGraphRequestRef.current !== requestKey) return;

          const response = await axios.get(`${API_BASE_URL}/api/view-graph`, {
            params: { graph_id: graphId, t: Date.now() },
            headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
            withCredentials: true,
          });

          const payload = response.data;
          if (!isPlaceholderGraph(payload) || attempt === GRAPH_MAX_ATTEMPTS) {
            selectedData = payload;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, GRAPH_POLL_INTERVAL_MS));
        }

        if (!selectedData) throw new Error('Failed to load graph data');
        if (latestGraphRequestRef.current !== requestKey) return;

        if (!expectedChatId || currentChatIdRef.current === expectedChatId) {
          showGraph(selectedData, graphId, expectedChatId);
        }
      } catch (error) {
        console.error('Error fetching graph:', error);
        if (!expectedChatId || currentChatIdRef.current === expectedChatId) {
          setGraphData({ error: 'Failed to load graph data' });
        }
      } finally {
        if (latestGraphRequestRef.current === requestKey) {
          setIsGraphLoading(false);
        }
      }
    },
    [showGraph],
  );

  const clearGraphData = useCallback(() => setGraphData(null), []);

  const clearFocus = useCallback(() => {
    setFocusedConcept(null);
    setFocusClearToken((token) => token + 1);
  }, []);

  // Hold the graph loader for a moment after each chat switch
  useEffect(() => {
    if (switchedChatIdRef.current === currentChatId) return;
    switchedChatIdRef.current = currentChatId;
    setIsChatSwitching(true);
    const timer = window.setTimeout(() => setIsChatSwitching(false), CHAT_SWITCH_LOADER_MS);
    return () => window.clearTimeout(timer);
  }, [currentChatId]);

  // Load the graph when the open chat (or its graph) changes
  const currentGraphId = currentChat?.graph_id;
  useEffect(() => {
    if (currentGraphId) {
      setGraphData(null);
      setIsGraphLoading(true);
      void fetchGraphData(currentGraphId, currentChatId);
    } else {
      latestGraphRequestRef.current = null;
      setIsGraphLoading(false);
      setGraphData(null);
    }
  }, [currentChatId, currentGraphId, fetchGraphData]);

  // Auto-name a new chat after its graph center
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
  }, [graphData, currentChat, setChats]);

  return {
    graphData,
    isGraphLoading,
    isChatSwitching,
    conceptProgress,
    focusedConcept,
    setFocusedConcept,
    focusClearToken,
    clearFocus,
    clearGraphData,
    fetchGraphData,
    showGraph,
  };
}
