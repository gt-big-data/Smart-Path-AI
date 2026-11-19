import type { Chat } from '../types/chat';

/** Older chats have no visit timestamp; their latest saved message is their best activity date. */
export function chatActivityDate(created: string, lastUsed: string | undefined, messageDates: string[]): Date {
  const latest = [created, lastUsed, ...messageDates].reduce<number>((current, value) => {
    const time = value ? new Date(value).getTime() : 0;
    return Number.isFinite(time) ? Math.max(current, time) : current;
  }, 0);
  return new Date(latest);
}

export function sortChatsByActivity(chats: Chat[]): Chat[] {
  return [...chats].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}
