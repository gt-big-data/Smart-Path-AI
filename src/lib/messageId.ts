/** Client-side id for a chat message. Uses crypto.randomUUID when the browser provides it. */
export function generateMessageId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    // Fall through to the random id below
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
