import { Request, Response, NextFunction } from 'express';
import { findOwnedChat, normalizeSessionUserId } from '../services/chatService';
import {
  getUserConceptProgress,
  normalizeConceptId,
  updateChatConceptConfidence,
} from '../services/progressService';

export const updateConceptProgress = async (req: Request, res: Response, next: NextFunction) => {
  const userId = normalizeSessionUserId((req.session as any)?.passport?.user);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const chatId = String(req.body?.chat_id || req.body?.chatId || '');
  const conceptId = normalizeConceptId(req.body);
  const { isCorrect, isRetry = false } = req.body || {};
  const attemptId = String(req.body?.attempt_id || req.body?.attemptId || '');

  if (!chatId || !conceptId || !attemptId || typeof isCorrect !== 'boolean' || typeof isRetry !== 'boolean') {
    return res.status(400).json({ message: 'chat_id, concept_id, attempt_id, isCorrect, and isRetry are required' });
  }

  try {
    if (!(await findOwnedChat(userId, chatId))) {
      return res.status(404).json({ message: 'Chat not found for this user' });
    }

    const progress = await updateChatConceptConfidence({
      userId,
      chatId,
      conceptId,
      isCorrect,
      isRetry,
      attemptId,
    });
    return res.status(200).json(progress);
  } catch (error) {
    console.error('Error updating chat concept progress:', error);
    return next(error);
  }
};

export const getConceptProgress = async (req: Request, res: Response, next: NextFunction) => {
  const userId = normalizeSessionUserId((req.session as any)?.passport?.user);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });

  const chatId = String(req.query.chat_id || req.query.chatId || '') || undefined;

  try {
    if (chatId && !(await findOwnedChat(userId, chatId))) {
      return res.status(404).json({ message: 'Chat not found for this user' });
    }

    const progress = await getUserConceptProgress(userId, chatId);
    return res.status(200).json(progress);
  } catch (error) {
    console.error('Error fetching concept progress:', error);
    return next(error);
  }
};
