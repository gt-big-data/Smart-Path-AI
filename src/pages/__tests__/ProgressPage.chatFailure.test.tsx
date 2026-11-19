import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import ProgressPage from '../ProgressPage';
import { PROGRESS_CACHE_KEY } from '../../lib/progressCache';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ userEmail: 'student@example.test' }) }));
vi.mock('../../components/progress/ChatActivityTabs', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

let renderer: ReactTestRenderer;
let chatsAvailable = false;

describe('Progress when the chat list is unavailable', () => {
  beforeEach(() => {
    chatsAvailable = false;
    const storage = new Map<string, string>();
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => storage.get(key) || null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(axios.get).mockImplementation(async url => {
      const path = String(url);
      if (path.endsWith('/api/concept-progress')) return { data: [{ chatId: 'chat1', conceptId: 'topic1', conceptName: 'Algebra', confidenceScore: 0.6, lastAttempted: '2026-11-18' }] };
      if (path.endsWith('/chat/user')) return { data: 'user1' };
      if (path.endsWith('/chat/user1/chats')) {
        if (!chatsAvailable) throw new Error('temporarily unavailable');
        return { data: [{ chat_id: 'chat1', title: 'Math notes', graph_id: 'graph1' }] };
      }
      if (path.endsWith('/chat/graph-ids')) return { data: { graphIds: ['graph1'] } };
      if (path.endsWith('/api/view-graph')) return { data: { graph: { nodes: [{ id: 'topic1', labels: ['Topic'], properties: { name: 'Algebra', topicID: 'topic1' } }] } } };
      throw new Error(`Unexpected request: ${path}`);
    });
  });

  afterEach(() => {
    renderer?.unmount();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows owned confidence records on a first visit and restores chat names on retry', async () => {
    await act(async () => { renderer = create(<ProgressPage />); });
    expect(JSON.stringify(renderer.toJSON())).toContain('Algebra');
    expect(JSON.stringify(renderer.toJSON())).toContain('Untitled chat');
    expect(JSON.stringify(renderer.toJSON())).toContain('Could not refresh your chats');

    chatsAvailable = true;
    const retry = renderer.root.findAllByType('button').find(button => button.children.includes('Retry'));
    expect(retry).toBeDefined();
    await act(async () => { retry!.props.onClick(); });
    expect(JSON.stringify(renderer.toJSON())).toContain('Math notes');
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Could not refresh your chats');
  });

  it('retains cached chats without confidence records when refreshing the chat list fails', async () => {
    sessionStorage.setItem(PROGRESS_CACHE_KEY, JSON.stringify({
      userEmail: 'student@example.test',
      profileData: { full_progress: [], topics_to_review: [] },
      chatTitles: [['chat2', 'Exam-only chat']],
      studyChats: [{ id: 'chat2', title: 'Exam-only chat', graphId: 'graph2' }],
    }));
    await act(async () => { renderer = create(<ProgressPage />); });
    expect(JSON.stringify(renderer.toJSON())).toContain('Exam-only chat');
    expect(JSON.stringify(renderer.toJSON())).toContain('Algebra');
    expect(JSON.stringify(renderer.toJSON())).toContain('Could not refresh your chats');
  });
});
