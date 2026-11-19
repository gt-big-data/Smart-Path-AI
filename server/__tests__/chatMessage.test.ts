import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import User from '../models/User';
import { addMessageToChat } from '../controllers/chatController.ts';

vi.mock('../models/User', () => ({ default: { findById: vi.fn() } }));

function request(chatId: unknown, authenticated = true) {
  return { session: authenticated ? { passport: { user: 'user-id' } } : {},
    body: { chat_id: chatId, sender: 'user', text: 'Uploaded file: cells.pdf' } } as unknown as Request;
}
function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('message chat ID validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([undefined, null, '', '   ', 123, {}])('rejects invalid chat ID %j before accessing user data', async chatId => {
    const res = response();
    await addMessageToChat(request(chatId), res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(User.findById).not.toHaveBeenCalled();
  });

  it('still requires authentication', async () => {
    const res = response();
    await addMessageToChat(request('', false), res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(User.findById).not.toHaveBeenCalled();
  });

  it('adds an upload message to a valid existing chat', async () => {
    const chat = { chat_id: 'chat-id', messages: [] };
    const user = { chats: [chat], save: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(User.findById).mockResolvedValue(user);
    const res = response();
    await addMessageToChat(request('chat-id'), res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(user.save).toHaveBeenCalledOnce();
    expect(chat.messages).toEqual([expect.objectContaining({ text: 'Uploaded file: cells.pdf' })]);
  });
});
