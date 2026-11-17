import type { Message } from '../types/chat';

// Text prefixes of assistant error replies, both raised in-session and saved to the backend
const ERROR_TEXT_PREFIXES = ['Error processing PDF:', 'Sorry, I could not generate a response'];
// Text the upload flow saves for a successfully attached PDF
const UPLOAD_TEXT_PREFIX = 'Uploaded file:';

/** The backend stores messages without a tone, so the tone is inferred from the saved text */
export function toneForStoredMessage(sender: Message['sender'], text: string): Message['tone'] {
  if (sender === 'ai' && ERROR_TEXT_PREFIXES.some((prefix) => text.startsWith(prefix))) {
    return 'error';
  }
  if (sender === 'user' && text.startsWith(UPLOAD_TEXT_PREFIX)) {
    return 'success';
  }
  return undefined;
}
