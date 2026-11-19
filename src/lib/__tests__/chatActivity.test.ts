import { describe, expect, it } from 'vitest';
import { chatActivityDate, sortChatsByActivity } from '../chatActivity';
import type { Chat } from '../../types/chat';

describe('chat activity', () => {
  it('uses the latest visit or message, including chats created before visit tracking', () => {
    expect(chatActivityDate('2026-01-01', undefined, ['2026-02-01']).toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(chatActivityDate('2026-01-01', '2026-03-01', ['2026-02-01']).toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(chatActivityDate('invalid', undefined, ['2026-02-01']).toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });
  it('sorts newest first without changing the input list', () => {
    const chats: Chat[] = ['2026-01-01', '2026-03-01', '2026-02-01'].map((date, id) => ({
      id: String(id), title: 'Chat', timestamp: new Date(date), messages: [],
    }));
    expect(sortChatsByActivity(chats).map(chat => chat.id)).toEqual(['1', '2', '0']);
    expect(chats.map(chat => chat.id)).toEqual(['0', '1', '2']);
  });
});
