import { useState } from 'react';
import type { DragEvent } from 'react';
import type { Chat, Folder } from '../types/chat';

// DataTransfer keys. Folder and chat drags share one drop handler per target, so the key tells them apart.
const FOLDER_DRAG_TYPE = 'application/x-smartpath-folder';
const CHAT_DRAG_TYPE = 'text/plain';

interface UseSidebarDragDropOptions {
  chats: Chat[];
  moveChatToFolder: (chatId: string, folderId: string | null) => Promise<void>;
  moveFolderToFolder: (folderId: string, parentFolderId: string | null) => Promise<void>;
  createFolderRecord: (name: string, parentFolderId: string | null) => Promise<Folder>;
  /** Called after a folder is created by a drop, so the sidebar can reveal it */
  onFolderCreated: (folder: Folder) => void;
  showErrorToast: (message: string) => void;
}

/** Drag-and-drop of chats and folders in the sidebar tree */
export function useSidebarDragDrop({
  chats,
  moveChatToFolder,
  moveFolderToFolder,
  createFolderRecord,
  onFolderCreated,
  showErrorToast,
}: UseSidebarDragDropOptions) {
  const [draggedChatId, setDraggedChatId] = useState<string | null>(null);
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  // A folder id, `chat-<id>` for a chat row, or 'root' for the list background
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const clearDrag = () => {
    setDraggedChatId(null);
    setDraggedFolderId(null);
    setDragOverFolderId(null);
  };

  const clearDragOver = () => setDragOverFolderId(null);

  const handleFolderDragStart = (e: DragEvent, folderId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(FOLDER_DRAG_TYPE, folderId);
    setDraggedFolderId(folderId);
  };

  const handleFolderDragOver = (e: DragEvent, folderId: string) => {
    // Hovering the folder being dragged changes nothing, so it is not a drop target
    if (draggedFolderId === folderId) {
      e.stopPropagation();
      setDragOverFolderId(null);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(folderId);
  };

  const handleFolderDrop = async (e: DragEvent, targetFolderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const folderId = e.dataTransfer.getData(FOLDER_DRAG_TYPE) || draggedFolderId;
    const chatId = e.dataTransfer.getData(CHAT_DRAG_TYPE) || draggedChatId;
    clearDrag();

    if (folderId && folderId !== targetFolderId) {
      await moveFolderToFolder(folderId, targetFolderId);
    } else if (chatId) {
      await moveChatToFolder(chatId, targetFolderId);
    }
  };

  const handleChatDragStart = (e: DragEvent, chatId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(CHAT_DRAG_TYPE, chatId);
    setDraggedChatId(chatId);
  };

  const handleChatDragOver = (e: DragEvent, chatId: string) => {
    // Hovering the chat being dragged changes nothing, so it is not a drop target
    if (draggedChatId === chatId) {
      e.stopPropagation();
      setDragOverFolderId(null);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(`chat-${chatId}`);
  };

  // Dropping a chat on another chat files both into a new subfolder.
  // The subfolder sits inside the target's folder, or at the top level when the target is unorganized.
  const handleChatDropOnChat = async (e: DragEvent, targetChatId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceChatId = e.dataTransfer.getData(CHAT_DRAG_TYPE) || draggedChatId;
    setDragOverFolderId(null);
    setDraggedChatId(null);
    if (!sourceChatId || sourceChatId === targetChatId) return;

    const parentFolderId = chats.find((c) => c.id === targetChatId)?.folder_id ?? null;
    try {
      const newFolder = await createFolderRecord('New folder', parentFolderId);
      onFolderCreated(newFolder);
      await moveChatToFolder(targetChatId, newFolder.folder_id);
      await moveChatToFolder(sourceChatId, newFolder.folder_id);
    } catch {
      showErrorToast('Could not create folder for chats.');
    }
  };

  const handleRootDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragOverFolderId('root');
  };

  // Dropping on the list background moves the dragged item to the top level
  const handleRootDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const chatId = e.dataTransfer.getData(CHAT_DRAG_TYPE) || draggedChatId;
    const folderId = e.dataTransfer.getData(FOLDER_DRAG_TYPE) || draggedFolderId;
    clearDrag();

    if (chatId) {
      await moveChatToFolder(chatId, null);
    } else if (folderId) {
      await moveFolderToFolder(folderId, null);
    }
  };

  return {
    draggedChatId,
    draggedFolderId,
    dragOverFolderId,
    clearDrag,
    clearDragOver,
    handleFolderDragStart,
    handleFolderDragOver,
    handleFolderDrop,
    handleChatDragStart,
    handleChatDragOver,
    handleChatDropOnChat,
    handleRootDragOver,
    handleRootDrop,
  };
}
