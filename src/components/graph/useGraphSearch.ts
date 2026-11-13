import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../../config/api';
import type { GraphData } from '../../types/graph';

export type SearchMode = 'keyword' | 'semantic';

export interface SearchContext {
  graph: GraphData['graph'] | undefined;
  graphId: string | undefined;
  query: string;
  mode: SearchMode;
}

interface SearchResponse {
  context: SearchContext;
  nodeIds: string[];
}

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Keyword or semantic search over the loaded graph. Requests are debounced, and a response
 * only counts while the query, mode and graph it was made for are still the current ones.
 */
export function useGraphSearch(data: GraphData | null) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('keyword');
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [pendingSearchNavigation, setPendingSearchNavigation] = useState<SearchContext | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const searchContext = useMemo<SearchContext>(() => ({
    graph: data?.graph,
    graphId: data?.graph_id,
    query: searchQuery,
    mode: searchMode,
  }), [data?.graph, data?.graph_id, searchQuery, searchMode]);

  // Hide previous hits immediately, including the debounce before a new request starts
  const hasCurrentSearchResponse = searchResponse?.context === searchContext;
  const searchResults = useMemo(
    () => (searchResponse?.context === searchContext ? searchResponse.nodeIds : []),
    [searchContext, searchResponse]
  );

  useEffect(() => {
    const { graph, graphId, query, mode } = searchContext;
    setIsSearching(false);
    if (!query.trim() || !graph || !graphId) return;

    const controller = new AbortController();
    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const endpoint = mode === 'semantic' ? 'semantic-search-graph' : 'search-graph';
        const url = `${API_BASE_URL}/api/${endpoint}?graph_id=${encodeURIComponent(graphId)}&query=${encodeURIComponent(query)}`;
        const response = await fetch(url, { credentials: 'include', signal: controller.signal });
        const result = await response.json();
        if (!cancelled) {
          setSearchResponse({ context: searchContext, nodeIds: result.status === 'success' ? result.node_ids || [] : [] });
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[Graph Search] Error:', error);
          setSearchResponse({ context: searchContext, nodeIds: [] });
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [searchContext]);

  return {
    searchQuery,
    setSearchQuery,
    searchMode,
    setSearchMode,
    searchContext,
    hasCurrentSearchResponse,
    searchResults,
    pendingSearchNavigation,
    setPendingSearchNavigation,
    isSearching,
  };
}
