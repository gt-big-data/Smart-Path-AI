export const PROGRESS_CACHE_KEY = 'progressPageCache:v2';
export const PROGRESS_INVALIDATED_EVENT = 'smartpath:progress-invalidated';

export function invalidateProgressCache(chatId: string) {
  try {
    sessionStorage.removeItem(PROGRESS_CACHE_KEY);
  } catch (error) {
    console.error('Could not invalidate cached progress', error);
  }
  window.dispatchEvent(new CustomEvent(PROGRESS_INVALIDATED_EVENT, { detail: { chatId } }));
}
