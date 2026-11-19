export interface StudyChat { id: string; title: string; graphId?: string }
interface ProgressReference { chat_id?: string; graph_id?: string; last_practiced: string }

/** Current chats own activity; a shared graph must not merge two chats' scores. */
export function groupStudyProgress<T extends ProgressReference>(chats: StudyChat[], progress: T[]) {
  const groups = new Map<string, T[]>(chats.filter(chat => chat.graphId).map(chat => [chat.id, []]));
  for (const item of progress) {
    const chat = item.chat_id ? chats.find(chat => chat.id === item.chat_id)
      : item.graph_id ? chats.find(chat => chat.graphId === item.graph_id) : undefined;
    if (!chat) continue;
    groups.set(chat.id, [...(groups.get(chat.id) || []), item]);
  }
  return Array.from(groups, ([chatId, items]) => ({
    chatId, title: chats.find(chat => chat.id === chatId)!.title, items,
    lastPracticed: items.reduce((latest, item) => !latest || new Date(item.last_practiced) > new Date(latest)
      ? item.last_practiced : latest, ''),
  }));
}
