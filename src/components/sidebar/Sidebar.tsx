import React, { RefObject } from 'react';
import Icon from '../common/Icon';
import { Folder, Chat } from '../../types/chat';
import SidebarHeader from './SidebarHeader';
import SidebarSearch from './SidebarSearch';
import SidebarActions from './SidebarActions';
import SidebarFolderRow from './SidebarFolderRow';
import SidebarChatRow from './SidebarChatRow';
import SidebarNav from './SidebarNav';
import SidebarAccount from './SidebarAccount';
import { isLeavingDropTarget } from '../../lib/dragTargets';

interface SidebarProps {
  isCollapsed: boolean;
  sidebarWidth: number;
  isResizing: boolean;
  userName?: string | null;
  folders: Folder[];
  chats: Chat[];
  currentChatId: string;
  searchQuery: string;
  searchInputRef: RefObject<HTMLInputElement>;
  expandedFolders: Record<string, boolean>;
  isCreatingFolder: boolean;
  newFolderName: string;
  newFolderParentId: string | null;
  renamingFolderId: string | null;
  folderRenameValue: string;
  renamingChatId: string | null;
  chatRenameValue: string;
  dragOverFolderId: string | null;
  draggedChatId: string | null;
  draggedFolderId: string | null;
  inlineFolderAction: { type: 'chat' | 'folder'; id: string } | null;
  inlineFolderValue: string;
  inlineFolderDestination: string;
  shiningId: string | null;
  onToggleCollapse: () => void;
  onOpenSidebar: () => void;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onNewChat: () => void;
  onStartCreateFolder: () => void;
  onNewFolderNameChange: (name: string) => void;
  onCreateFolderSubmit: (e: React.FormEvent) => void;
  onCancelCreateFolder: () => void;
  onToggleExpandFolder: (folderId: string) => void;
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
  onRootDropOver: (e: React.DragEvent) => void;
  onRootDropLeave: (e: React.DragEvent) => void;
  onRootDrop: (e: React.DragEvent) => void;
  onStartSidebarResize: (e: React.MouseEvent) => void;
  onHome: () => void;
  onProgress: () => void;
  onSettings: () => void;
  onLogout: () => void;
  isProgressActive?: boolean;
}

export default function Sidebar({
  isCollapsed,
  sidebarWidth,
  isResizing,
  userName,
  folders,
  chats,
  currentChatId,
  searchQuery,
  searchInputRef,
  expandedFolders,
  isCreatingFolder,
  newFolderName,
  newFolderParentId,
  renamingFolderId,
  folderRenameValue,
  renamingChatId,
  chatRenameValue,
  dragOverFolderId,
  draggedChatId,
  draggedFolderId,
  inlineFolderAction,
  inlineFolderValue,
  inlineFolderDestination,
  shiningId,
  onToggleCollapse,
  onOpenSidebar,
  onSearchChange,
  onClearSearch,
  onNewChat,
  onStartCreateFolder,
  onNewFolderNameChange,
  onCreateFolderSubmit,
  onCancelCreateFolder,
  onToggleExpandFolder,
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
  onRootDropOver,
  onRootDropLeave,
  onRootDrop,
  onStartSidebarResize,
  onHome,
  onProgress,
  onSettings,
  onLogout,
  isProgressActive = false,
}: SidebarProps) {
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const folderHasMatch = (folder: Folder): boolean => {
    if (!normalizedSearch) return true;
    if (folder.name.toLowerCase().includes(normalizedSearch)) return true;
    const hasMatchingChat = chats
      .filter((c) => c.folder_id === folder.folder_id)
      .some((c) => c.title.toLowerCase().includes(normalizedSearch));
    if (hasMatchingChat) return true;
    return folders
      .filter((child) => child.parent_folder_id === folder.folder_id)
      .some(folderHasMatch);
  };

  const topLevelFolders = folders
    .filter((f) => !f.parent_folder_id)
    .filter(folderHasMatch);

  const unorganizedChats = chats
    .filter((c) => !c.folder_id)
    .filter((c) => !normalizedSearch || c.title.toLowerCase().includes(normalizedSearch));

  return (
    <>
      {isCollapsed && (
        <button
          type="button"
          className="fixed left-4.25 top-4.5 z-25 grid h-9 w-9 place-items-center rounded-xs border border-[#e2dfe5] bg-white text-[#25282d] hover:bg-teal-pale hover:text-teal-dark"
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          <Icon name="chevron" size={18} />
        </button>
      )}

      <div
        className={`app-sidebar relative flex flex-col ${
          isCollapsed ? 'sidebar-collapsed' : ''
        } ${isResizing ? 'select-none' : ''}`}
        style={{
          width: isCollapsed ? 0 : sidebarWidth,
          minWidth: isCollapsed ? 0 : 210,
        }}
      >
        <SidebarHeader
          isCollapsed={isCollapsed}
          onHomeClick={onHome}
          onToggleCollapse={onToggleCollapse}
        />

        {!isCollapsed && (
          <SidebarSearch
            searchQuery={searchQuery}
            inputRef={searchInputRef}
            onChange={onSearchChange}
            onClear={onClearSearch}
          />
        )}

        <SidebarActions
          isCollapsed={isCollapsed}
          isCreatingFolder={isCreatingFolder}
          newFolderName={newFolderName}
          newFolderParentId={newFolderParentId}
          onNewChat={onNewChat}
          onStartCreateFolder={onStartCreateFolder}
          onNewFolderNameChange={onNewFolderNameChange}
          onCreateFolderSubmit={onCreateFolderSubmit}
          onCancelCreateFolder={onCancelCreateFolder}
        />

        {!isCollapsed && (
          <div data-sidebar-library className="library">
            <div className="library-label">
              <span>YOUR LIBRARY</span>
              <span>{chats.length}</span>
            </div>

            {topLevelFolders.map((folder) => (
              <SidebarFolderRow
                key={folder.folder_id}
                folder={folder}
                allFolders={folders}
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
                onToggleExpand={onToggleExpandFolder}
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

            {normalizedSearch && topLevelFolders.length === 0 && unorganizedChats.length === 0 && (
              <div className="search-empty">
                <Icon name="search" size={18} />
                <span>No chats found</span>
              </div>
            )}
          </div>
        )}

        {!isCollapsed && (
          <div
            onDragOver={onRootDropOver}
            onDragLeave={(e) => {
              if (isLeavingDropTarget(e)) onRootDropLeave(e);
            }}
            onDrop={onRootDrop}
            className={`root-drop-zone ${dragOverFolderId === 'root' ? 'drop-active' : ''}`}
            aria-label="Library root drop area"
          >
            {unorganizedChats.map((chat) => (
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
                folders={folders}
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

        <SidebarNav
          isCollapsed={isCollapsed}
          isProgressActive={isProgressActive}
          onHome={onHome}
          onProgress={onProgress}
          onSettings={onSettings}
        />

        {!isCollapsed && (
          <SidebarAccount userName={userName} onLogout={onLogout} />
        )}

        {!isCollapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            onMouseDown={onStartSidebarResize}
            className="sidebar-resizer"
          />
        )}
      </div>
    </>
  );
}
