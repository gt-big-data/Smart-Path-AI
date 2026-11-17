/**
 * The chat that was open last, remembered in the browser so the workspace reopens it
 * after visiting another page (home, account, progress) or reloading.
 */

const LAST_CHAT_KEY = 'smartpath:last-chat';

/** The id of the chat that was open last, or null if none was saved (or storage is unavailable) */
export function loadLastChatId(): string | null {
  try {
    return localStorage.getItem(LAST_CHAT_KEY);
  } catch {
    return null;
  }
}

export function saveLastChatId(chatId: string): void {
  try {
    localStorage.setItem(LAST_CHAT_KEY, chatId);
  } catch {
    // Storage full or blocked: the workspace still works, it just opens the first chat
  }
}
