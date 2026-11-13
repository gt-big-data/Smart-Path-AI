import type { Folder } from '../types/chat';

/** Names from the top-level folder down to folderId. [] when there is no folder or it is unknown. */
export function getFolderPath(folders: Folder[], folderId: string | null | undefined): string[] {
  if (!folderId) return [];
  const folder = folders.find((item) => item.folder_id === folderId);
  if (!folder) return [];
  return [...getFolderPath(folders, folder.parent_folder_id), folder.name];
}
