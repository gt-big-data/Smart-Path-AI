import { Types } from 'mongoose';
import User, { IChat } from '../models/User';

export const normalizeSessionUserId = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';

  const sessionUser = value as { _id?: unknown; id?: unknown; toHexString?: () => string };
  if (sessionUser._id) return String(sessionUser._id);
  if (typeof sessionUser.toHexString === 'function') return sessionUser.toHexString();
  if (sessionUser.id) return String(sessionUser.id);
  return '';
};

export const findOwnedChat = async (
  userId: string,
  chatId: string,
  graphId?: string
): Promise<IChat | null> => {
  if (!Types.ObjectId.isValid(userId) || !chatId) return null;

  const user = await User.findById(userId);
  if (!user) return null;

  return user.chats.find(chat =>
    chat.chat_id === chatId && (!graphId || chat.graph_id === graphId)
  ) ?? null;
};