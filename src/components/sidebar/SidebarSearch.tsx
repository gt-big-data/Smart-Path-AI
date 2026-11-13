import React, { RefObject } from 'react';
import Icon from '../common/Icon';

interface SidebarSearchProps {
  searchQuery: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onClear: () => void;
}

export default function SidebarSearch({
  searchQuery,
  inputRef,
  onChange,
  onClear,
}: SidebarSearchProps) {
  return (
    <label className="sidebar-search">
      <Icon name="search" size={15} />
      <input
        ref={inputRef}
        type="text"
        placeholder="Search chats..."
        value={searchQuery}
        onChange={(e) => onChange(e.target.value)}
      />
      {searchQuery && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={onClear}
        >
          <Icon name="x" size={13} />
        </button>
      )}
    </label>
  );
}
