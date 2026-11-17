import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import type { Folder } from '../types/chat';
import type { SetChats } from './useChatList';

export type InlineFolderAction = { type: 'chat' | 'folder'; id: string };

interface UseChatFoldersOptions {
  setChats: SetChats;
  showErrorToast: (message: string) => void;
  flashNewItem: (id: string) => void;
}

function serverMessage(err: unknown): string {
  return (axios.isAxiosError(err) && err.response?.data?.message) || 'Server error';
}

/** Folder tree and every folder and chat-to-folder action: create, rename, delete, move, and the inline sidebar pickers */
export function useChatFolders({ setChats, showErrorToast, flashNewItem }: UseChatFoldersOptions) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);

  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [folderRenameValue, setFolderRenameValue] = useState('');
  const folderRenameInFlightRef = useRef<string | null>(null);

  const [inlineFolderAction, setInlineFolderAction] = useState<InlineFolderAction | null>(null);
  const [inlineFolderValue, setInlineFolderValue] = useState('');
  const [inlineFolderDestination, setInlineFolderDestination] = useState('');

  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [moveModalChatId, setMoveModalChatId] = useState<string | null>(null);

  const fetchFolders = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/chat/folders`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setFolders(data);
    } catch (err) {
      console.error('Error fetching folders:', err);
    }
  }, []);

  useEffect(() => {
    void fetchFolders();
  }, [fetchFolders]);

  // Creates a folder on the server and appends it to the list. Callers decide what to show on failure.
  const createFolderRecord = useCallback(async (name: string, parentFolderId: string | null) => {
    const response = await axios.post(
      `${API_BASE_URL}/chat/folder/new`,
      { name, parent_folder_id: parentFolderId },
      { withCredentials: true },
    );
    const newFolder: Folder = response.data;
    setFolders((prev) => [...prev, newFolder]);
    return newFolder;
  }, []);

  const moveChatToFolder = useCallback(
    async (chatId: string, folderId: string | null) => {
      try {
        const res = await fetch(`${API_BASE_URL}/chat/move-to-folder`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ chat_id: chatId, folder_id: folderId }),
        });
        if (!res.ok) throw new Error(`Server error (${res.status})`);
        setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, folder_id: folderId } : chat)));
      } catch (err) {
        console.error('Error moving chat:', err);
        showErrorToast('Could not move chat to folder.');
      }
    },
    [setChats, showErrorToast],
  );

  const moveFolderToFolder = useCallback(
    async (folderId: string, parentFolderId: string | null) => {
      try {
        const res = await fetch(`${API_BASE_URL}/chat/folder/${folderId}/move`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ parent_folder_id: parentFolderId }),
        });
        if (!res.ok) throw new Error(`Server error (${res.status})`);
        setFolders((prev) =>
          prev.map((folder) =>
            folder.folder_id === folderId ? { ...folder, parent_folder_id: parentFolderId } : folder,
          ),
        );
      } catch (err) {
        console.error('Error moving folder:', err);
        showErrorToast('Could not move folder.');
      }
    },
    [showErrorToast],
  );

  // Flashes a newly created folder and expands it and its parent so it is visible
  const revealFolder = useCallback(
    (folder: Folder) => {
      flashNewItem(folder.folder_id);
      setExpandedFolders((prev) => ({
        ...prev,
        [folder.folder_id]: true,
        ...(folder.parent_folder_id ? { [folder.parent_folder_id]: true } : {}),
      }));
    },
    [flashNewItem],
  );

  // New top-level or subfolder from the create-folder row
  const beginCreateFolder = useCallback(() => {
    setNewFolderParentId(null);
    setIsCreatingFolder(true);
  }, []);

  const cancelCreateFolder = useCallback(() => {
    setIsCreatingFolder(false);
    setNewFolderName('');
    setNewFolderParentId(null);
  }, []);

  const submitCreateFolder = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const name = newFolderName.trim();
      if (!name) {
        setIsCreatingFolder(false);
        return;
      }

      try {
        const newFolder = await createFolderRecord(name, newFolderParentId);
        revealFolder(newFolder);
      } catch (err) {
        console.error('Error creating folder:', err);
        showErrorToast(`Could not create folder: ${serverMessage(err)}`);
      } finally {
        setNewFolderName('');
        setNewFolderParentId(null);
        setIsCreatingFolder(false);
      }
    },
    [createFolderRecord, revealFolder, newFolderName, newFolderParentId, showErrorToast],
  );

  const toggleFolderExpanded = useCallback((folderId: string) => {
    setExpandedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  }, []);

  const beginRenameFolder = useCallback((folderId: string, name: string) => {
    setRenamingFolderId(folderId);
    setFolderRenameValue(name);
  }, []);

  const cancelRenameFolder = useCallback(() => setRenamingFolderId(null), []);

  const saveFolderRename = useCallback(
    async (folderId: string) => {
      if (renamingFolderId !== folderId || folderRenameInFlightRef.current === folderId) return;
      const trimmed = folderRenameValue.trim();
      const currentName = folders.find((f) => f.folder_id === folderId)?.name || '';
      setRenamingFolderId(null);
      if (!trimmed || trimmed === currentName) return;

      folderRenameInFlightRef.current = folderId;
      setFolders((prev) =>
        prev.map((folder) => (folder.folder_id === folderId ? { ...folder, name: trimmed } : folder)),
      );

      try {
        await axios.patch(
          `${API_BASE_URL}/chat/folder/${folderId}/rename`,
          { name: trimmed },
          { withCredentials: true },
        );
      } catch (err) {
        console.error('Error renaming folder:', err);
        void fetchFolders();
        showErrorToast(`Could not rename folder: ${serverMessage(err)}`);
      } finally {
        folderRenameInFlightRef.current = null;
      }
    },
    [fetchFolders, folderRenameValue, folders, renamingFolderId, showErrorToast],
  );

  const requestDeleteFolder = useCallback((folder: Folder) => setFolderToDelete(folder), []);
  const cancelDeleteFolder = useCallback(() => setFolderToDelete(null), []);

  const confirmDeleteFolder = useCallback(async () => {
    if (!folderToDelete) return;
    const { folder_id: folderId, parent_folder_id: parentFolderId } = folderToDelete;
    setFolderToDelete(null);

    try {
      await axios.delete(`${API_BASE_URL}/chat/folder/${folderId}`, { withCredentials: true });
      // Children and chats of the deleted folder move up one level
      setFolders((prev) =>
        prev
          .filter((item) => item.folder_id !== folderId)
          .map((item) =>
            item.parent_folder_id === folderId ? { ...item, parent_folder_id: parentFolderId || null } : item,
          ),
      );
      setChats((prev) => prev.map((chat) => (chat.folder_id === folderId ? { ...chat, folder_id: null } : chat)));
      setExpandedFolders((prev) => {
        const next = { ...prev };
        delete next[folderId];
        return next;
      });
    } catch (err) {
      console.error('Error deleting folder:', err);
      showErrorToast(`Failed to delete folder: ${serverMessage(err)}`);
    }
  }, [folderToDelete, setChats, showErrorToast]);

  // Inline sidebar picker: toggles the move row under a chat
  const toggleChatMoveAction = useCallback((chatId: string) => {
    setInlineFolderAction((prev) =>
      prev?.type === 'chat' && prev.id === chatId ? null : { type: 'chat', id: chatId },
    );
    setInlineFolderDestination('root');
    setInlineFolderValue('');
  }, []);

  // Inline sidebar picker: opens the new-subfolder row under a folder
  const openSubfolderAction = useCallback((folderId: string) => {
    setInlineFolderAction({ type: 'folder', id: folderId });
    setInlineFolderValue('');
    setExpandedFolders((prev) => ({ ...prev, [folderId]: true }));
  }, []);

  const closeInlineAction = useCallback(() => setInlineFolderAction(null), []);

  const confirmInlineAction = useCallback(async () => {
    if (!inlineFolderAction) return;

    if (inlineFolderAction.type === 'chat') {
      if (!inlineFolderDestination) return;
      if (inlineFolderDestination === 'new') {
        const name = inlineFolderValue.trim();
        if (!name) return;
        try {
          const newFolder = await createFolderRecord(name, null);
          await moveChatToFolder(inlineFolderAction.id, newFolder.folder_id);
        } catch {
          showErrorToast('Could not create folder for chat.');
        }
      } else {
        await moveChatToFolder(
          inlineFolderAction.id,
          inlineFolderDestination === 'root' ? null : inlineFolderDestination,
        );
      }
    } else {
      const name = inlineFolderValue.trim();
      if (!name) return;
      try {
        const newFolder = await createFolderRecord(name, inlineFolderAction.id);
        flashNewItem(newFolder.folder_id);
        setExpandedFolders((prev) => ({
          ...prev,
          [inlineFolderAction.id]: true,
          [newFolder.folder_id]: true,
        }));
      } catch {
        showErrorToast('Could not create subfolder.');
      }
    }

    setInlineFolderAction(null);
    setInlineFolderValue('');
    setInlineFolderDestination('');
  }, [
    createFolderRecord,
    flashNewItem,
    inlineFolderAction,
    inlineFolderDestination,
    inlineFolderValue,
    moveChatToFolder,
    showErrorToast,
  ]);

  // MoveChatModal: moves the chat to an existing folder, or to a new top-level folder when newName is set
  const moveChatFromModal = useCallback(
    async (destFolderId: string | null, newName?: string) => {
      if (!moveModalChatId) return;
      if (newName) {
        try {
          const newFolder = await createFolderRecord(newName, null);
          await moveChatToFolder(moveModalChatId, newFolder.folder_id);
        } catch {
          showErrorToast('Could not create folder.');
        }
      } else {
        await moveChatToFolder(moveModalChatId, destFolderId);
      }
      setMoveModalChatId(null);
    },
    [createFolderRecord, moveChatToFolder, moveModalChatId, showErrorToast],
  );

  return {
    folders,
    expandedFolders,
    isCreatingFolder,
    newFolderName,
    setNewFolderName,
    newFolderParentId,
    renamingFolderId,
    folderRenameValue,
    setFolderRenameValue,
    inlineFolderAction,
    inlineFolderValue,
    setInlineFolderValue,
    inlineFolderDestination,
    setInlineFolderDestination,
    folderToDelete,
    moveModalChatId,
    setMoveModalChatId,
    createFolderRecord,
    revealFolder,
    moveChatToFolder,
    moveFolderToFolder,
    beginCreateFolder,
    cancelCreateFolder,
    submitCreateFolder,
    toggleFolderExpanded,
    beginRenameFolder,
    cancelRenameFolder,
    saveFolderRename,
    requestDeleteFolder,
    cancelDeleteFolder,
    confirmDeleteFolder,
    toggleChatMoveAction,
    openSubfolderAction,
    closeInlineAction,
    confirmInlineAction,
    moveChatFromModal,
  };
}
