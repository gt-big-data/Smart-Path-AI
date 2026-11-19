import { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { useChatGraph } from '../useChatGraph';
import type { Chat } from '../../types/chat';

vi.mock('axios', () => ({ default: { get: vi.fn(), patch: vi.fn() } }));

const payload = {
  graph: {
    nodes: [{ id: 'center', labels: ['Topic'], properties: { name: 'Cellular Respiration', isCenter: true } }],
    relationships: [],
  },
};

let renderer: ReactTestRenderer;
let graph: ReturnType<typeof useChatGraph>;
let chats: Chat[];
let updateChat: (changes: Partial<Chat>) => void;

function Harness({ initial }: { initial: Chat }) {
  const [items, setItems] = useState([initial]);
  chats = items;
  updateChat = changes => setItems(prev => prev.map(chat => ({ ...chat, ...changes })));
  graph = useChatGraph({ currentChatId: items[0].id, currentChat: items[0], setChats: setItems });
  return null;
}

async function mount(changes: Partial<Chat> = {}) {
  await act(async () => {
    renderer = create(<Harness initial={{ id: 'chat-1', title: 'New Chat', messages: [], timestamp: new Date(), ...changes }} />);
  });
}

describe('graph-based chat naming', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('window', Object.assign(new EventTarget(), { setTimeout, clearTimeout }));
    vi.mocked(axios.get).mockImplementation(async url => ({ data: String(url).includes('view-graph') ? payload : [] }));
    vi.mocked(axios.patch).mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('names an existing default chat when its graph is retrieved and saves the title', async () => {
    await mount({ graph_id: 'graph-1' });
    expect(chats[0].title).toBe('Cellular Respiration');
    expect(axios.patch).toHaveBeenCalledWith(expect.stringContaining('/chat/rename/chat-1'),
      { title: 'Cellular Respiration' }, { withCredentials: true });
    expect(axios.patch).toHaveBeenCalledTimes(1);
  });

  it('names a new chat when its uploaded graph is attached', async () => {
    await mount();
    expect(chats[0].title).toBe('New Chat');
    await act(async () => {
      updateChat({ graph_id: 'graph-1' });
      graph.showGraph(payload, 'graph-1', 'chat-1');
    });
    expect(chats[0].title).toBe('Cellular Respiration');
    expect(axios.patch).toHaveBeenCalledTimes(1);
  });

  it('preserves manually chosen titles', async () => {
    await mount({ graph_id: 'graph-1', title: 'Exam review' });
    expect(chats[0].title).toBe('Exam review');
    expect(axios.patch).not.toHaveBeenCalled();
  });

  it('waits for a real graph before naming a chat', async () => {
    await mount();
    await act(async () => {
      graph.showGraph({ graph: { nodes: [], relationships: [] } }, undefined, 'chat-1');
    });
    expect(chats[0].title).toBe('New Chat');
    expect(axios.patch).not.toHaveBeenCalled();
  });

  it('does not repeatedly retry a failed title save', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(axios.patch).mockRejectedValueOnce(new Error('Save failed'))
      .mockImplementationOnce(() => new Promise(() => {}));
    await mount({ graph_id: 'graph-1' });
    expect(chats[0].title).toBe('New Chat');
    expect(axios.patch).toHaveBeenCalledTimes(1);
  });

  it('does not undo a manual rename if an automatic save fails later', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let rejectSave!: (error: Error) => void;
    vi.mocked(axios.patch).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSave = reject; }));
    await mount({ graph_id: 'graph-1' });
    await act(async () => updateChat({ title: 'Exam review' }));
    await act(async () => rejectSave(new Error('Save failed')));
    expect(chats[0].title).toBe('Exam review');
  });
});
