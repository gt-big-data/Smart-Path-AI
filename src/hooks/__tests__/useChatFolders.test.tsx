import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { useChatFolders } from '../useChatFolders';

vi.mock('axios', () => ({ default: { post: vi.fn(), patch: vi.fn(), isAxiosError: (error: any) => !!error.isAxiosError } }));
let renderer: ReactTestRenderer;
let folders: ReturnType<typeof useChatFolders>;
const toast = vi.fn();

function Harness() {
  folders = useChatFolders({ setChats: vi.fn(), showErrorToast: toast, flashNewItem: vi.fn() });
  return null;
}

describe('folder actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
  });
  afterEach(() => { renderer?.unmount(); vi.unstubAllGlobals(); });

  it('keeps the folder name available and explains a failed request', async () => {
    vi.mocked(axios.post).mockRejectedValue({ isAxiosError: true, response: { status: 500, data: { message: 'Database unavailable' } } });
    await act(async () => { renderer = create(<Harness />); });
    act(() => { folders.beginCreateFolder(); folders.setNewFolderName('Lecture notes'); });
    await act(async () => { await folders.submitCreateFolder({ preventDefault: vi.fn() } as any); });
    expect(folders.isCreatingFolder).toBe(true);
    expect(folders.newFolderName).toBe('Lecture notes');
    expect(toast).toHaveBeenCalledWith('Could not create folder: Database unavailable');
  });

  it('keeps the move controls open when the server rejects the move', async () => {
    vi.mocked(axios.patch).mockRejectedValue({ isAxiosError: true, response: { status: 404, data: { message: 'Folder not found' } } });
    await act(async () => { renderer = create(<Harness />); });
    act(() => { folders.toggleChatMoveAction('chat1'); });
    await act(async () => { await folders.confirmInlineAction(); });
    expect(folders.inlineFolderAction).toEqual({ type: 'chat', id: 'chat1' });
    expect(toast).toHaveBeenCalledWith('Could not move chat to folder: Folder not found');
  });
});
