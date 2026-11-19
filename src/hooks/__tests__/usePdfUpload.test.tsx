import { useState, type ChangeEvent } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { usePdfUpload } from '../usePdfUpload';
import { readPdfProcessStream } from '../../lib/pdfUploadStream';
import type { Chat } from '../../types/chat';

vi.mock('axios', () => ({ default: { post: vi.fn() } }));
vi.mock('../../lib/pdfUploadStream', () => ({ readPdfProcessStream: vi.fn() }));

const newChat: Chat = { id: 'created-chat', title: 'New Chat', timestamp: new Date(), messages: [] };
const payload = { graph_id: 'new-graph', processed_chunks: 1, graph: {
  nodes: [{ id: 'center', labels: ['Topic'], properties: { name: 'Cells', isCenter: true } }], relationships: [],
} };
const callbacks = {
  createChat: vi.fn(), showErrorToast: vi.fn(), appendErrorMessage: vi.fn(),
  showGraph: vi.fn(), fetchGraphData: vi.fn(), clearGraphData: vi.fn(),
};
let renderer: ReactTestRenderer;
let upload: ReturnType<typeof usePdfUpload>;
let chats: Chat[];

function Harness({ chatId }: { chatId: string }) {
  const [items, setChats] = useState<Chat[]>([{ ...newChat, id: chatId || newChat.id }]);
  chats = items;
  upload = usePdfUpload({ currentChatId: chatId, setChats, ...callbacks });
  return null;
}

async function mount(chatId = '') {
  await act(async () => { renderer = create(<Harness chatId={chatId} />); });
}

const selectPdf = () => upload.handleFileSelect({ target: { files: [new File(['pdf'], 'cells.pdf', { type: 'application/pdf' })] } } as unknown as ChangeEvent<HTMLInputElement>);

describe('PDF upload chat ownership', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    vi.mocked(readPdfProcessStream).mockResolvedValue(payload);
    vi.mocked(axios.post).mockResolvedValue({ data: {} });
    callbacks.createChat.mockResolvedValue(newChat);
  });
  afterEach(() => {
    act(() => renderer?.unmount());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates a missing chat before processing and uses its ID for every saved result', async () => {
    await mount();
    await act(async () => { await selectPdf(); });
    expect(callbacks.createChat).toHaveBeenCalledTimes(1);
    expect(callbacks.createChat.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(fetch).mock.invocationCallOrder[0]);
    expect(axios.post).toHaveBeenCalledTimes(2);
    for (const [, body] of vi.mocked(axios.post).mock.calls) expect(body).toMatchObject({ chat_id: newChat.id });
    expect(chats[0].graph_id).toBe('new-graph');
    expect(callbacks.showGraph).toHaveBeenCalledWith(payload, 'new-graph', newChat.id);
  });

  it('keeps an existing chat without creating another one', async () => {
    await mount('existing-chat');
    await act(async () => { await selectPdf(); });
    expect(callbacks.createChat).not.toHaveBeenCalled();
    for (const [, body] of vi.mocked(axios.post).mock.calls) expect(body).toMatchObject({ chat_id: 'existing-chat' });
    expect(chats[0].messages).toHaveLength(1);
  });

  it('accepts a graph produced from PDF images when there are no text chunks', async () => {
    const imagePayload = { ...payload, processed_chunks: 0, images_processed: 1 };
    vi.mocked(readPdfProcessStream).mockResolvedValue(imagePayload);
    await mount('existing-chat');
    await act(async () => { await selectPdf(); });
    expect(callbacks.appendErrorMessage).not.toHaveBeenCalled();
    expect(callbacks.showGraph).toHaveBeenCalledWith(imagePayload, 'new-graph', 'existing-chat');
    expect(chats[0].graph_id).toBe('new-graph');
  });

  it('reports extraction failure without blaming cloud configuration when no text or images were processed', async () => {
    vi.mocked(readPdfProcessStream).mockResolvedValue({ processed_chunks: 0, images_processed: 0 });
    await mount('existing-chat');
    await act(async () => { await selectPdf(); });
    expect(axios.post).not.toHaveBeenCalled();
    const error = callbacks.appendErrorMessage.mock.calls[0][1];
    expect(error).toMatch(/readable text|image/i);
    expect(error).not.toContain('On GCP');
  });

  it('preserves a specific processing failure returned by the AI service', async () => {
    vi.mocked(readPdfProcessStream).mockResolvedValue({ processed_chunks: 0,
      failed_chunks: [{ error: 'OCR permission denied' }] });
    await mount('existing-chat');
    await act(async () => { await selectPdf(); });
    expect(callbacks.appendErrorMessage).toHaveBeenCalledWith('existing-chat', expect.stringContaining('OCR permission denied'));
  });

  it('does not process the PDF or save messages if chat creation fails', async () => {
    callbacks.createChat.mockResolvedValue(undefined);
    await mount();
    await act(async () => { await selectPdf(); });
    expect(fetch).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
    expect(upload.isProcessingFile).toBe(false);
  });

  it('keeps the original chat ID while processing if the selected chat changes', async () => {
    let complete!: (value: typeof payload) => void;
    vi.mocked(readPdfProcessStream).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    await mount('original-chat');
    let pending!: Promise<void>;
    await act(async () => { pending = selectPdf(); });
    await act(async () => { renderer.update(<Harness chatId="other-chat" />); });
    await act(async () => { complete(payload); await pending; });
    for (const [, body] of vi.mocked(axios.post).mock.calls) expect(body).toMatchObject({ chat_id: 'original-chat' });
    expect(callbacks.showGraph).toHaveBeenCalledWith(payload, 'new-graph', 'original-chat');
  });
});
