import { Request, Response, NextFunction } from 'express';
import QuizHistory, { IConcept, IQuestion } from '../models/QuizHistory';
import { findOwnedChat, normalizeSessionUserId } from '../services/chatService';
import { normalizeConceptId } from '../services/progressService';

// Save a new QuizHistory record when a quiz is completed
export const saveQuizHistory = async (req: Request, res: Response, next: NextFunction) => {
  console.log('[Quiz History] POST /api/quiz-history endpoint called');
  console.log('[Quiz History] Request body:', JSON.stringify(req.body, null, 2));
  
  const userId = normalizeSessionUserId((req.session as any)?.passport?.user);
  console.log('[Quiz History] User ID from session:', userId);
  
  if (!userId) {
    console.log('[Quiz History] No user ID found in session - returning 401');
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const userID = String(userId);
  const chatId = String(req.body?.chat_id || req.body?.chatId || '');
  const quizId = String(req.body?.quiz_id || req.body?.quizId || '');
  const { concepts, questions } = req.body || {};

  if (!chatId || !quizId) {
    return res.status(400).json({ message: 'chat_id and quiz_id are required' });
  }

  // Validate required fields
  if (!concepts || !Array.isArray(concepts)) {
    return res.status(400).json({ message: 'Concepts array is required' });
  }

  if (!questions || !Array.isArray(questions)) {
    return res.status(400).json({ message: 'Questions array is required' });
  }

  if (concepts.length !== questions.length) {
    return res.status(400).json({ message: 'Each question must have one matching concept' });
  }

  const conceptEntries = concepts.map((concept: any) => ({
    concept_id: normalizeConceptId(concept),
    name: String(concept?.name || ''),
  }));
  if (conceptEntries.some(concept => !concept.concept_id || !concept.name)) {
    return res.status(400).json({ message: 'Each concept must have concept_id and name' });
  }
  const normalizedConcepts = conceptEntries as IConcept[];

  // Validate questions structure
  for (const question of questions) {
    if (!question?.questionText || !question?.userAnswer || !question?.correctAnswer || !question?.explanation) {
      return res.status(400).json({ message: 'Each question must have questionText, userAnswer, correctAnswer, and explanation' });
    }
  }

  try {
    if (!(await findOwnedChat(userID, chatId))) {
      return res.status(404).json({ message: 'Chat not found for this user' });
    }

    const historyFilter = { userID, chat_id: chatId, quiz_id: quizId };
    let savedQuizHistory;
    try {
      savedQuizHistory = await QuizHistory.findOneAndUpdate(
        historyFilter,
        {
          $setOnInsert: {
            ...historyFilter,
            concepts: normalizedConcepts,
            questions: questions as IQuestion[],
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    } catch (error: any) {
      if (error.code !== 11000) throw error;
      savedQuizHistory = await QuizHistory.findOne(historyFilter);
      if (!savedQuizHistory) throw error;
    }

    console.log(`[Quiz History] Saved quiz ${quizId} for user ${userID}, chat ${chatId}`);
    
    res.status(201).json({
      message: 'Quiz history saved successfully',
      quizHistory: savedQuizHistory,
      progressRecordsCreated: 0,
    });
  } catch (error) {
    console.error('[Quiz History] ❌ Error saving quiz history:', error);
    next(error);
  }
};

// Retrieve all quiz histories for a given userID
export const getUserQuizHistories = async (req: Request, res: Response, next: NextFunction) => {
  const userId = normalizeSessionUserId((req.session as any)?.passport?.user);
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const quizHistories = await QuizHistory.find({ userID: userId })
      .sort({ createdAt: -1 }) // Most recent first
      .exec();

    console.log(`[Quiz History] Retrieved ${quizHistories.length} quiz histories for user ${userId}`);
    
    res.status(200).json({
      message: 'Quiz histories retrieved successfully',
      count: quizHistories.length,
      quizHistories
    });
  } catch (error) {
    console.error('[Quiz History] Error retrieving quiz histories:', error);
    next(error);
  }
};

// Retain the legacy route while restricting results to the authenticated user.
export const getAllQuizHistories = async (req: Request, res: Response, next: NextFunction) => {
  const userId = normalizeSessionUserId((req.session as any)?.passport?.user);
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const quizHistories = await QuizHistory.find({ userID: userId })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(offset))
      .exec();

    const totalCount = await QuizHistory.countDocuments({ userID: userId });

    console.log(`[Quiz History] Retrieved ${quizHistories.length} quiz histories (admin view)`);
    
    res.status(200).json({
      message: 'All quiz histories retrieved successfully',
      count: quizHistories.length,
      totalCount,
      quizHistories
    });
  } catch (error) {
    console.error('[Quiz History] Error retrieving all quiz histories:', error);
    next(error);
  }
};

// Get a specific quiz history by ID
export const getQuizHistoryById = async (req: Request, res: Response, next: NextFunction) => {
  const userId = normalizeSessionUserId((req.session as any)?.passport?.user);
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { id } = req.params;

  try {
    const quizHistory = await QuizHistory.findOne({ _id: id, userID: userId });
    
    if (!quizHistory) {
      return res.status(404).json({ message: 'Quiz history not found' });
    }

    console.log(`[Quiz History] Retrieved quiz history ${id} for user ${userId}`);
    
    res.status(200).json({
      message: 'Quiz history retrieved successfully',
      quizHistory
    });
  } catch (error) {
    console.error('[Quiz History] Error retrieving quiz history by ID:', error);
    next(error);
  }
};

// Process all existing quiz history records to create progress records
export const processAllQuizHistory = async (req: Request, res: Response, next: NextFunction) => {
  const userId = normalizeSessionUserId((req.session as any)?.passport?.user);
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  return res.status(200).json({
    message: 'Legacy quiz histories are not replayed because they are not reliably associated with a chat.',
    quizHistoriesProcessed: 0,
    progressRecordsCreated: 0,
    progressRecordsUpdated: 0,
  });
};
