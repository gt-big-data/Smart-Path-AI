import { Types } from 'mongoose';
import ChatConceptProgress from '../models/ChatConceptProgress';
import ConceptProgress from '../models/ConceptProgress';
import QuizHistory from '../models/QuizHistory';

const LEGACY_CONCEPT_FIELDS = [
  'concept_id',
  'conceptId',
  'conceptID',
  'topicID',
  'topic_id',
  'topicId',
  'id',
] as const;

export const normalizeConceptId = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || null;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const field of LEGACY_CONCEPT_FIELDS) {
      const normalized = normalizeConceptId(record[field]);
      if (normalized) return normalized;
    }
  }

  return null;
};

export const confidenceDelta = (isCorrect: boolean, isRetry: boolean): number => {
  if (!isCorrect) return -0.1;
  return isRetry ? 0.05 : 0.1;
};

export const buildConfidenceUpdatePipeline = (
  delta: number,
  attemptId: string,
  attemptedAt: Date
) => {
  const priorAttempts = { $ifNull: ['$processed_attempt_ids', []] };
  const alreadyProcessed = { $in: [{ $literal: attemptId }, priorAttempts] };
  const currentScore = { $ifNull: ['$confidence_score', 0.5] };

  return [{
    $set: {
      confidence_score: {
        $cond: [
          alreadyProcessed,
          currentScore,
          { $max: [0, { $min: [1, { $add: [currentScore, delta] }] }] },
        ],
      },
      processed_attempt_ids: {
        $cond: [
          alreadyProcessed,
          priorAttempts,
          { $concatArrays: [priorAttempts, { $literal: [attemptId] }] },
        ],
      },
      last_attempted: {
        $cond: [alreadyProcessed, '$last_attempted', attemptedAt],
      },
    },
  }];
};

export const updateChatConceptConfidence = async (input: {
  userId: string;
  chatId: string;
  conceptId: unknown;
  isCorrect: boolean;
  isRetry: boolean;
  attemptId: string;
}) => {
  const conceptId = normalizeConceptId(input.conceptId);
  if (!Types.ObjectId.isValid(input.userId) || !input.chatId || !conceptId || !input.attemptId || input.attemptId.length > 200) {
    throw new Error('user_id, chat_id, concept_id, and attempt_id are required');
  }

  return ChatConceptProgress.findOneAndUpdate(
    {
      user: new Types.ObjectId(input.userId),
      chat_id: input.chatId,
      concept_id: conceptId,
    },
    buildConfidenceUpdatePipeline(
      confidenceDelta(input.isCorrect, input.isRetry),
      input.attemptId,
      new Date()
    ),
    { new: true, upsert: true }
  );
};

export const getChatConceptProgress = async (userId: string, chatId: string) => {
  if (!Types.ObjectId.isValid(userId) || !chatId) return [];
  return ChatConceptProgress.find({ user: new Types.ObjectId(userId), chat_id: chatId });
};

export const getChatConfidenceMap = async (userId: string, chatId: string) => {
  const progress = await getChatConceptProgress(userId, chatId);
  return Object.fromEntries(progress.map(record => [record.concept_id, record.confidence_score]));
};

export const getAllUserConceptProgress = async (userId: string) => {
  if (!Types.ObjectId.isValid(userId)) return [];

  const ownerId = new Types.ObjectId(userId);
  const [chatProgress, legacyProgress] = await Promise.all([
    ChatConceptProgress.find({ user: ownerId }),
    ConceptProgress.find({ user: ownerId }),
  ]);

  return [
    ...chatProgress.map(record => ({
      ...record.toObject(),
      concept_id: record.concept_id,
      conceptId: record.concept_id,
      confidence_score: record.confidence_score,
      confidenceScore: record.confidence_score,
      chat_id: record.chat_id,
      last_attempted: record.last_attempted,
      lastAttempted: record.last_attempted,
    })),
    ...legacyProgress.map(record => ({
      ...record.toObject(),
      concept_id: record.conceptId,
      conceptId: record.conceptId,
      confidence_score: record.confidenceScore,
      confidenceScore: record.confidenceScore,
      chat_id: null,
      last_attempted: record.lastAttempted,
      lastAttempted: record.lastAttempted,
      legacy: true,
    })),
  ];
};

export const getUserConceptProgress = async (userId: string, chatId?: string) => {
  if (!chatId) return getAllUserConceptProgress(userId);
  if (!Types.ObjectId.isValid(userId)) return [];

  const ownerId = new Types.ObjectId(userId);
  const chatProgress = await ChatConceptProgress.find({ user: ownerId, chat_id: chatId });
  return chatProgress.map(record => ({
    ...record.toObject(),
    concept_id: record.concept_id,
    conceptId: record.concept_id,
    confidence_score: record.confidence_score,
    confidenceScore: record.confidence_score,
    chat_id: record.chat_id,
    last_attempted: record.last_attempted,
    lastAttempted: record.last_attempted,
  }));
};

export const deleteChatProgressAndHistory = async (userId: string, chatId: string) => {
  if (!Types.ObjectId.isValid(userId) || !chatId) {
    throw new Error('A valid user_id and chat_id are required');
  }

  const ownerId = new Types.ObjectId(userId);
  const progressResult = await ChatConceptProgress.deleteMany({ user: ownerId, chat_id: chatId });
  const historyResult = await QuizHistory.deleteMany({ userID: userId, chat_id: chatId });

  return {
    progressDeleted: progressResult.deletedCount ?? 0,
    quizHistoriesDeleted: historyResult.deletedCount ?? 0,
  };
};