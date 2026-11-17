import type { Chat } from '../types/chat';

// Upload messages are saved to the chat as "Uploaded file: <name>", so the name survives a reload
const UPLOAD_MESSAGE_PATTERN = /^Uploaded file: (.+)$/;

/** Names of the documents a chat's graph was built from, in upload order */
export function getSourceFileNames(chat?: Chat | null): string[] {
  if (!chat) return [];
  if (chat.source_files?.length) return chat.source_files;

  return chat.messages.flatMap((message) => {
    const match = UPLOAD_MESSAGE_PATTERN.exec(message.content);
    return match ? [match[1].trim()] : [];
  });
}

/**
 * Link to the most recently uploaded file. Only available in the session that uploaded it,
 * because the PDF itself is not stored on the server.
 */
export function getSourceFileUrl(chat?: Chat | null): string | undefined {
  if (!chat) return undefined;
  return chat.messages.filter((message) => message.file?.url).pop()?.file?.url;
}
