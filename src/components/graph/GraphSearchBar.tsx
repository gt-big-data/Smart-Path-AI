import { Search, X } from 'lucide-react';
import type { SearchResultItem } from '../../lib/searchResults';
import type { SearchMode } from './useGraphSearch';
import {
  clearButton,
  modeClass,
  resultClass,
  resultCopy,
  resultDot,
  resultLabel,
  resultList,
  resultTrail,
  resultType,
  searchBarClass,
  searchClass,
  searchCount,
  searchInput,
  searchModes,
  searchResultsClass,
  searchStatus,
} from './graphClasses';

interface GraphSearchBarProps {
  query: string;
  mode: SearchMode;
  isSearching: boolean;
  results: SearchResultItem[];
  activeNodeId: string | null;
  onQueryChange: (query: string) => void;
  onModeChange: (mode: SearchMode) => void;
  onSubmit: () => void;
  onResultClick: (nodeId: string) => void;
}

const MODES: { value: SearchMode; label: string }[] = [
  { value: 'keyword', label: 'Keyword' },
  { value: 'semantic', label: 'Semantic' },
];

/** Search box over the graph with keyword/semantic toggle and the ranked hit list */
export default function GraphSearchBar({
  query,
  mode,
  isSearching,
  results,
  activeNodeId,
  onQueryChange,
  onModeChange,
  onSubmit,
  onResultClick,
}: GraphSearchBarProps) {
  return (
    <div className={searchClass}>
      <div className={searchBarClass}>
        <Search size={14} aria-hidden="true" />
        <input
          type="text"
          aria-label="Search graph nodes"
          placeholder="Search topics, concepts, definitions..."
          value={query}
          className={searchInput}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || !query.trim()) return;
            e.preventDefault();
            onSubmit();
          }}
        />
        {query && (
          <button type="button" className={clearButton} aria-label="Clear search" onClick={() => onQueryChange('')}>
            <X size={12} />
          </button>
        )}
        {isSearching && <span className={searchStatus}>Searching...</span>}
        <div className={searchModes} role="group" aria-label="Search mode">
          {MODES.map((option) => {
            const active = mode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                className={modeClass(active)}
                onClick={() => onModeChange(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {results.length > 0 && (
        <div className={searchResultsClass}>
          <div className={searchCount}>
            Found {results.length} matching node{results.length !== 1 ? 's' : ''}
          </div>
          <ul className={resultList}>
            {results.map((item) => {
              const active = item.id === activeNodeId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={resultClass(active)}
                    title={item.trail.length > 0 ? [...item.trail, item.label].join(' › ') : item.label}
                    onClick={() => onResultClick(item.id)}
                  >
                    <span className={resultDot} style={{ background: item.color }} />
                    <span className={resultCopy}>
                      <span className={resultLabel}>{item.label}</span>
                      {item.trail.length > 0 && <span className={resultTrail}>{item.trail.join(' › ')}</span>}
                    </span>
                    <span className={resultType}>{item.type}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
