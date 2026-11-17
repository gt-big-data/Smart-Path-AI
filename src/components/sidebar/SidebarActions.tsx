import React from 'react';
import Icon from '../common/Icon';

interface SidebarActionsProps {
  isCollapsed: boolean;
  isCreatingFolder: boolean;
  newFolderName: string;
  newFolderParentId: string | null;
  onNewChat: () => void;
  onStartCreateFolder: () => void;
  onNewFolderNameChange: (name: string) => void;
  onCreateFolderSubmit: (e: React.FormEvent) => void;
  onCancelCreateFolder: () => void;
}

export default function SidebarActions({
  isCollapsed,
  isCreatingFolder,
  newFolderName,
  newFolderParentId,
  onNewChat,
  onStartCreateFolder,
  onNewFolderNameChange,
  onCreateFolderSubmit,
  onCancelCreateFolder,
}: SidebarActionsProps) {
  return (
    <>
      <div
        data-sidebar-actions
        className={isCollapsed ? 'create-actions collapsed' : 'create-actions'}
      >
        <button type="button" onClick={onNewChat}>
          <Icon name="plus" />
          {!isCollapsed && <span>New chat</span>}
        </button>

        <button
          type="button"
          onClick={onStartCreateFolder}
          title="Create folder"
          aria-label="Create folder"
        >
          <Icon name="folder" />
          {!isCollapsed && <span>New folder</span>}
        </button>
      </div>

      {!isCollapsed && isCreatingFolder && (
        <form onSubmit={onCreateFolderSubmit} className="inline-create">
          <input
            autoFocus
            type="text"
            placeholder={newFolderParentId ? 'Subfolder name...' : 'Folder name...'}
            value={newFolderName}
            onChange={(e) => onNewFolderNameChange(e.target.value)}
          />
          <button type="submit" aria-label="Create folder">
            <Icon name="check" size={14} />
          </button>
          <button
            type="button"
            onClick={onCancelCreateFolder}
            aria-label="Cancel"
          >
            <Icon name="x" size={14} />
          </button>
        </form>
      )}
    </>
  );
}
