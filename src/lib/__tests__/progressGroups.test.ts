import { describe, expect, it } from 'vitest';
import { groupStudyProgress } from '../progressGroups';
const chats = [{ id: 'chat1', title: 'First', graphId: 'shared' }, { id: 'chat2', title: 'Second', graphId: 'shared' }];

describe('Progress chat groups', () => {
  it('includes graph-backed chats with no confidence records and omits empty new chats', () => {
    expect(groupStudyProgress([...chats, { id: 'empty', title: 'New Chat' }], []).map(g => g.chatId)).toEqual(['chat1', 'chat2']);
  });
  it('keeps chat-scoped confidence separate even when chats share a graph', () => {
    const item = { chat_id: 'chat2', graph_id: 'shared', last_practiced: '2026-11-18' };
    const groups = groupStudyProgress(chats, [item]);
    expect(groups[0].items).toEqual([]); expect(groups[1].items).toEqual([item]);
  });
  it('does not reattach a deleted chat’s records to an active graph', () => {
    expect(groupStudyProgress(chats, [{ chat_id: 'deleted', graph_id: 'shared', last_practiced: '2026-11-18' }])
      .every(group => group.items.length === 0)).toBe(true);
  });
});
