import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConceptProgress from '../models/ConceptProgress';
import User from '../models/User';
import { getConceptProgress } from '../controllers/progressController.ts';

vi.mock('../models/User', () => ({ default: { findById: vi.fn() } }));
vi.mock('../models/ConceptProgress', () => ({ default: { find: vi.fn() } }));

const select = vi.fn();
const ownedChats = { chats: [{ chat_id: 'current-chat' }] };
function request(query: Record<string, string> = {}, authenticated = true) {
  return { session: authenticated ? { passport: { user: 'user-id' } } : {}, query } as unknown as Request;
}
function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

describe('progress only for existing chats', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(User.findById).mockReturnValue({ select } as never);
    select.mockResolvedValue(ownedChats);
    vi.mocked(ConceptProgress.find).mockResolvedValue([]);
  });
  afterEach(() => vi.restoreAllMocks());

  it('restricts account progress to chats that still belong to the user', async () => {
    const res = response();
    const next = vi.fn();
    await getConceptProgress(request(), res as unknown as Response, next);
    expect(ConceptProgress.find).toHaveBeenCalledWith({ user: 'user-id', chatId: { $in: ['current-chat'] } });
    expect(res.json).toHaveBeenCalledWith([]);
    expect(next).not.toHaveBeenCalled();
  });

  it('still returns decayed confidence for a current chat', async () => {
    const saved = { chatId: 'current-chat', conceptId: 'topic', confidenceScore: 0.8,
      lastAttempted: new Date(Date.now() - 86400000) };
    vi.mocked(ConceptProgress.find).mockResolvedValue([{ ...saved, toObject: () => saved }]);
    const res = response();
    await getConceptProgress(request({ chat_id: 'current-chat' }), res as unknown as Response, vi.fn());
    expect(ConceptProgress.find).toHaveBeenCalledWith({ user: 'user-id', chatId: 'current-chat' });
    const [progress] = res.json.mock.calls[0][0];
    expect(progress).toMatchObject({ chatId: 'current-chat', conceptId: 'topic' });
    expect(progress.confidenceScore).toBeGreaterThan(0);
    expect(progress.confidenceScore).toBeLessThan(saved.confidenceScore);
  });

  it('does not return records for a deleted or another user’s chat', async () => {
    const res = response();
    await getConceptProgress(request({ chat_id: 'deleted-chat' }), res as unknown as Response, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(ConceptProgress.find).not.toHaveBeenCalled();
  });

  it('returns no progress when the user has no chats', async () => {
    select.mockResolvedValue({ chats: [] });
    const res = response();
    await getConceptProgress(request(), res as unknown as Response, vi.fn());
    expect(ConceptProgress.find).toHaveBeenCalledWith({ user: 'user-id', chatId: { $in: [] } });
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('does not include missing or empty legacy chat IDs as valid chats', async () => {
    select.mockResolvedValue({ chats: [{}, { chat_id: '' }, { chat_id: 'current-chat' }] });
    const res = response();
    await getConceptProgress(request(), res as unknown as Response, vi.fn());
    expect(ConceptProgress.find).toHaveBeenCalledWith({ user: 'user-id', chatId: { $in: ['current-chat'] } });
  });

  it('requires authentication before querying any data', async () => {
    const res = response();
    await getConceptProgress(request({}, false), res as unknown as Response, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(User.findById).not.toHaveBeenCalled();
    expect(ConceptProgress.find).not.toHaveBeenCalled();
  });

  it('handles a user that no longer exists', async () => {
    select.mockResolvedValue(null);
    const res = response();
    await getConceptProgress(request(), res as unknown as Response, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(ConceptProgress.find).not.toHaveBeenCalled();
  });
});
