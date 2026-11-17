import React from 'react';
import Icon from '../common/Icon';
import { Folder, Chat } from '../../types/chat';
import SidebarChatRow from './SidebarChatRow';
import { isLeavingDropTarget } from '../../lib/dragTargets';

interface SidebarFolderRowProps {
  folder: Folder;
  allFolders: Folder[];
  chats: Chat[];
  currentChatId: string;
  expandedFolders: Record<string, boolean>;
  renamingFolderId: string | null;
  folderRenameValue: string;
  dragOverFolderId: string | null;
  draggedChatId: string | null;
  draggedFolderId: string | null;
  renamingChatId: string | null;
  chatRenameValue: string;
  inlineFolderAction: { type: 'chat' | 'folder'; id: string } | null;
  inlineFolderValue: string;
  inlineFolderDestination: string;
  shiningId: string | null;
  searchFilter?: (candidate: Folder | Chat) => boolean;
  onToggleExpand: (folderId: string) => void;
  onBeginRenameFolder: (folderId: string, currentName: string) => void;
  onRenameFolderChange: (value: string) => void;
  onRenameFolderSave: (folderId: string) => void;
  onRenameFolderCancel: () => void;
  onRequestDeleteFolder: (folder: Folder, e: React.MouseEvent) => void;
  onOpenInlineSubfolder: (folderId: string) => void;
  onCloseInlineAction: () => void;
  onInlineValueChange: (val: string) => void;
  onInlineDestinationChange: (dest: string) => void;
  onConfirmInlineAction: () => void;
  onFolderDragStart: (e: React.DragEvent, folderId: string) => void;
  onFolderDragEnd: () => void;
  onFolderDragOver: (e: React.DragEvent, folderId: string) => void;
  onFolderDragLeave: (e: React.DragEvent) => void;
  onFolderDrop: (e: React.DragEvent, folderId: string) => void;
  onSelectChat: (chatId: string) => void;
  onBeginRenameChat: (chatId: string, title: string) => void;
  onRenameChatChange: (value: string) => void;
  onRenameChatSave: (chatId: string) => void;
  onRenameChatCancel: () => void;
  onRequestDeleteChat: (chat: Chat, e: React.MouseEvent) => void;
  onToggleMoveFolder: (chatId: string) => void;
  onChatDragStart: (e: React.DragEvent, chatId: string) => void;
  onChatDragEnd: () => void;
  onChatDragOver: (e: React.DragEvent, chatId: string) => void;
  onChatDragLeave: (e: React.DragEvent) => void;
  onChatDrop: (e: React.DragEvent, targetChatId: string) => void;
}

export default function SidebarFolderRow({
  folder,
  allFolders,
  chats,
  currentChatId,
  expandedFolders,
  renamingFolderId,
  folderRenameValue,
  dragOverFolderId,
  draggedChatId,
  draggedFolderId,
  renamingChatId,
  chatRenameValue,
  inlineFolderAction,
  inlineFolderValue,
  inlineFolderDestination,
  shiningId,
  onToggleExpand,
  onBeginRenameFolder,
  onRenameFolderChange,
  onRenameFolderSave,
  onRenameFolderCancel,
  onRequestDeleteFolder,
  onOpenInlineSubfolder,
  onCloseInlineAction,
  onInlineValueChange,
  onInlineDestinationChange,
  onConfirmInlineAction,
  onFolderDragStart,
  onFolderDragEnd,
  onFolderDragOver,
  onFolderDragLeave,
  onFolderDrop,
  onSelectChat,
  onBeginRenameChat,
  onRenameChatChange,
  onRenameChatSave,
  onRenameChatCancel,
  onRequestDeleteChat,
  onToggleMoveFolder,
  onChatDragStart,
  onChatDragEnd,
  onChatDragOver,
  onChatDragLeave,
  onChatDrop,
}: SidebarFolderRowProps): React.ReactElement {
  const isExpanded = !!expandedFolders[folder.folder_id];
  const isRenaming = renamingFolderId === folder.folder_id;
  const isDropTarget = dragOverFolderId === folder.folder_id;
  const isDragging = draggedFolderId === folder.folder_id;
  const isShining = shiningId === folder.folder_id;

  const childFolders = allFolders.filter(
    (item) => item.parent_folder_id === folder.folder_id,
  );
  const childChats = chats.filter((c) => c.folder_id === folder.folder_id);

  return (
    <div className="folder-group" key={folder.folder_id}>
      <div
        className={`library-row folder-row ${isDragging ? 'dragging' : ''} ${
          isDropTarget ? 'drop-active' : ''
        } ${isShining ? 'is-shining' : ''}`}
        draggable
        onDoubleClick={() => onBeginRenameFolder(folder.folder_id, folder.name)}
        onDragStart={(e) => onFolderDragStart(e, folder.folder_id)}
        onDragEnd={onFolderDragEnd}
        onDragOver={(e) => onFolderDragOver(e, folder.folder_id)}
        onDragLeave={(e) => {
          if (isLeavingDropTarget(e)) onFolderDragLeave(e);
        }}
        onDrop={(e) => onFolderDrop(e, folder.folder_id)}
      >
        <button
          type="button"
          className={`disclosure ${isExpanded ? 'open' : ''}`}
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${folder.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(folder.folder_id);
          }}
        >
          <Icon name="chevron" size={14} />
        </button>
        <Icon name="folder" size={17} />
        {isRenaming ? (
          <input
            autoFocus
            className="rename-input"
            value={folderRenameValue}
            onChange={(e) => onRenameFolderChange(e.target.value)}
            onBlur={() => onRenameFolderSave(folder.folder_id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRenameFolderSave(folder.folder_id);
              if (e.key === 'Escape') onRenameFolderCancel();
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="folder-name">{folder.name}</span>
        )}
        <div className="row-actions">
          <button
            type="button"
            className="folder-action"
            aria-label={`Create subfolder in ${folder.name}`}
            title="New subfolder"
            onClick={(e) => {
              e.stopPropagation();
              onOpenInlineSubfolder(folder.folder_id);
            }}
          >
            <Icon name="folder" size={16} />
          </button>
          <button
            type="button"
            className="delete-action"
            aria-label={`Delete ${folder.name}`}
            title="Delete"
            onClick={(e) => onRequestDeleteFolder(folder, e)}
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
        {isDropTarget && <span className="drop-label">Move here</span>}
      </div>

      {inlineFolderAction?.type === 'folder' &&
        inlineFolderAction.id === folder.folder_id && (
          <div className="inline-folder-action">
            <div className="inline-folder-fields">
              <input
                autoFocus
                value={inlineFolderValue}
                onChange={(e) => onInlineValueChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onConfirmInlineAction()}
                placeholder="New subfolder"
              />
            </div>
            <button
              type="button"
              aria-label="Confirm subfolder"
              onClick={onConfirmInlineAction}
            >
              <Icon name="check" size={14} />
            </button>
            <button
              type="button"
              aria-label="Cancel subfolder"
              onClick={onCloseInlineAction}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        )}

      {isExpanded && (
        <div className="folder-contents">
          {childFolders.map((child) => (
            <SidebarFolderRow
              key={child.folder_id}
              folder={child}
              allFolders={allFolders}
              chats={chats}
              currentChatId={currentChatId}
              expandedFolders={expandedFolders}
              renamingFolderId={renamingFolderId}
              folderRenameValue={folderRenameValue}
              dragOverFolderId={dragOverFolderId}
              draggedChatId={draggedChatId}
              draggedFolderId={draggedFolderId}
              renamingChatId={renamingChatId}
              chatRenameValue={chatRenameValue}
              inlineFolderAction={inlineFolderAction}
              inlineFolderValue={inlineFolderValue}
              inlineFolderDestination={inlineFolderDestination}
              shiningId={shiningId}
              onToggleExpand={onToggleExpand}
              onBeginRenameFolder={onBeginRenameFolder}
              onRenameFolderChange={onRenameFolderChange}
              onRenameFolderSave={onRenameFolderSave}
              onRenameFolderCancel={onRenameFolderCancel}
              onRequestDeleteFolder={onRequestDeleteFolder}
              onOpenInlineSubfolder={onOpenInlineSubfolder}
              onCloseInlineAction={onCloseInlineAction}
              onInlineValueChange={onInlineValueChange}
              onInlineDestinationChange={onInlineDestinationChange}
              onConfirmInlineAction={onConfirmInlineAction}
              onFolderDragStart={onFolderDragStart}
              onFolderDragEnd={onFolderDragEnd}
              onFolderDragOver={onFolderDragOver}
              onFolderDragLeave={onFolderDragLeave}
              onFolderDrop={onFolderDrop}
              onSelectChat={onSelectChat}
              onBeginRenameChat={onBeginRenameChat}
              onRenameChatChange={onRenameChatChange}
              onRenameChatSave={onRenameChatSave}
              onRenameChatCancel={onRenameChatCancel}
              onRequestDeleteChat={onRequestDeleteChat}
              onToggleMoveFolder={onToggleMoveFolder}
              onChatDragStart={onChatDragStart}
              onChatDragEnd={onChatDragEnd}
              onChatDragOver={onChatDragOver}
              onChatDragLeave={onChatDragLeave}
              onChatDrop={onChatDrop}
            />
          ))}
          {childChats.map((chat) => (
            <SidebarChatRow
              key={chat.id}
              chat={chat}
              isActive={currentChatId === chat.id}
              isRenaming={renamingChatId === chat.id}
              renameValue={chatRenameValue}
              isDragging={draggedChatId === chat.id}
              isDropTarget={dragOverFolderId === `chat-${chat.id}`}
              inlineAction={
                inlineFolderAction?.type === 'chat' &&
                inlineFolderAction.id === chat.id
              }
              inlineFolderDestination={inlineFolderDestination}
              inlineFolderValue={inlineFolderValue}
              isShining={shiningId === chat.id}
              folders={allFolders}
              onSelect={onSelectChat}
              onBeginRename={onBeginRenameChat}
              onRenameChange={onRenameChatChange}
              onRenameSave={onRenameChatSave}
              onRenameCancel={onRenameChatCancel}
              onRequestDelete={onRequestDeleteChat}
              onToggleMoveFolder={onToggleMoveFolder}
              onInlineDestinationChange={onInlineDestinationChange}
              onInlineValueChange={onInlineValueChange}
              onInlineActionConfirm={onConfirmInlineAction}
              onInlineActionCancel={onCloseInlineAction}
              onDragStart={onChatDragStart}
              onDragEnd={onChatDragEnd}
              onDragOver={onChatDragOver}
              onDragLeave={onChatDragLeave}
              onDrop={onChatDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
}
