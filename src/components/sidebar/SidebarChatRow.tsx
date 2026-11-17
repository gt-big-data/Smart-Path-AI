import React from 'react';
import Icon from '../common/Icon';
import { Chat, Folder } from '../../types/chat';
import { isLeavingDropTarget } from '../../lib/dragTargets';

interface SidebarChatRowProps {
  chat: Chat;
  isActive: boolean;
  isRenaming: boolean;
  renameValue: string;
  isDragging: boolean;
  isDropTarget: boolean;
  isShining: boolean;
  inlineAction: boolean;
  inlineFolderDestination: string;
  inlineFolderValue: string;
  folders: Folder[];
  onSelect: (chatId: string) => void;
  onBeginRename: (chatId: string, currentTitle: string) => void;
  onRenameChange: (value: string) => void;
  onRenameSave: (chatId: string) => void;
  onRenameCancel: () => void;
  onRequestDelete: (chat: Chat, e: React.MouseEvent) => void;
  onToggleMoveFolder: (chatId: string) => void;
  onInlineDestinationChange: (dest: string) => void;
  onInlineValueChange: (val: string) => void;
  onInlineActionConfirm: () => void;
  onInlineActionCancel: () => void;
  onDragStart: (e: React.DragEvent, chatId: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, chatId: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, chatId: string) => void;
}

function formatChatTime(date: Date): string {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return `Today, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function SidebarChatRow({
  chat,
  isActive,
  isRenaming,
  renameValue,
  isDragging,
  isDropTarget,
  isShining,
  inlineAction,
  inlineFolderDestination,
  inlineFolderValue,
  folders,
  onSelect,
  onBeginRename,
  onRenameChange,
  onRenameSave,
  onRenameCancel,
  onRequestDelete,
  onToggleMoveFolder,
  onInlineDestinationChange,
  onInlineValueChange,
  onInlineActionConfirm,
  onInlineActionCancel,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: SidebarChatRowProps) {
  return (
    <div className="chat-item">
      <div
        draggable
        onDragStart={(e) => onDragStart(e, chat.id)}
        onDragEnd={onDragEnd}
        onDragOver={(e) => onDragOver(e, chat.id)}
        onDragLeave={(e) => {
          if (isLeavingDropTarget(e)) onDragLeave(e);
        }}
        onDrop={(e) => onDrop(e, chat.id)}
        onDoubleClick={() => onBeginRename(chat.id, chat.title)}
        className={`library-row chat-row ${isActive ? 'active' : ''} ${
          isDragging ? 'dragging' : ''
        } ${isDropTarget ? 'drop-active create-folder-target' : ''} ${isShining ? 'is-shining' : ''}`}
      >
        <button
          type="button"
          className="chat-open"
          onClick={() => onSelect(chat.id)}
        >
          <Icon name="bot" size={16} />
          {isRenaming ? (
            <input
              autoFocus
              className="rename-input"
              value={renameValue}
              onChange={(e) => onRenameChange(e.target.value)}
              onBlur={() => onRenameSave(chat.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRenameSave(chat.id);
                if (e.key === 'Escape') onRenameCancel();
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="chat-row-copy">
              <strong>{chat.title}</strong>
              <small>{formatChatTime(chat.timestamp)}</small>
            </span>
          )}
        </button>

        <div className="row-actions">
          <button
            type="button"
            className="folder-action"
            aria-label={`Move ${chat.title} to folder`}
            title="Move to folder"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMoveFolder(chat.id);
            }}
          >
            <Icon name="folder" size={16} />
          </button>
          <button
            type="button"
            className="delete-action"
            aria-label={`Delete ${chat.title}`}
            title="Delete"
            onClick={(e) => onRequestDelete(chat, e)}
          >
            <Icon name="trash" size={16} />
          </button>
        </div>

        {isDropTarget && <span className="drop-label">Create folder</span>}
      </div>

      {inlineAction && (
        <div
          className={`inline-folder-action ${
            inlineFolderDestination === 'new' ? 'new-folder-selected' : ''
          }`}
        >
          <div className="inline-folder-fields">
            <select
              aria-label="Folder destination"
              value={inlineFolderDestination}
              onChange={(e) => onInlineDestinationChange(e.target.value)}
            >
              <option value="">Move to…</option>
              <option value="root">Unorganized</option>
              {folders.map((folder) => (
                <option key={folder.folder_id} value={folder.folder_id}>
                  {folder.name}
                </option>
              ))}
              <option value="new">+ New folder</option>
            </select>
            {inlineFolderDestination === 'new' && (
              <input
                autoFocus
                value={inlineFolderValue}
                onChange={(e) => onInlineValueChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onInlineActionConfirm()}
                placeholder="Folder name"
              />
            )}
          </div>
          <button
            type="button"
            aria-label="Confirm folder action"
            onClick={onInlineActionConfirm}
          >
            <Icon name="check" size={14} />
          </button>
          <button
            type="button"
            aria-label="Cancel folder action"
            onClick={onInlineActionCancel}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
