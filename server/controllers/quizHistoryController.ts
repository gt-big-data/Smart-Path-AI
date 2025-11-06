import { Request, Response, NextFunction } from 'express';
import QuizHistory, { IQuizHistory, IConcept, IQuestion } from '../models/QuizHistory';

// Save a new QuizHistory record when a quiz is completed
export const saveQuizHistory = async (req: Request, res: Response, next: NextFunction) => {
  console.log('[Quiz History] POST /api/quiz-history endpoint called');
  console.log('[Quiz History] Request body:', JSON.stringify(req.body, null, 2));
  
  const userId = (req.session as any)?.passport?.user;
  console.log('[Quiz History] User ID from session:', userId);
  
  if (!userId) {
    console.log('[Quiz History] No user ID found in session - returning 401');
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { concepts, questions } = req.body;

  // Validate required fields
  if (!concepts || !Array.isArray(concepts)) {
    return res.status(400).json({ message: 'Concepts array is required' });
  }

  if (!questions || !Array.isArray(questions)) {
    return res.status(400).json({ message: 'Questions array is required' });
  }

  // Validate concepts structure
  for (const concept of concepts) {
    if (!concept.conceptID || !concept.name) {
      return res.status(400).json({ message: 'Each concept must have conceptID and name' });
    }
  }

  // Validate questions structure
  for (const question of questions) {
    if (!question.questionText || !question.userAnswer || !question.correctAnswer || !question.explanation) {
      return res.status(400).json({ message: 'Each question must have questionText, userAnswer, correctAnswer, and explanation' });
    }
  }

  try {
    console.log('[Quiz History] Creating new QuizHistory document...');
    const quizHistory = new QuizHistory({
      userID: userId,
      concepts: concepts as IConcept[],
      questions: questions as IQuestion[]
    });

    console.log('[Quiz History] QuizHistory document created, calling save()...');
    const savedQuizHistory = await quizHistory.save();
    console.log(`[Quiz History] ✅ Successfully saved quiz history for user ${userId} with ${questions.length} questions`);
    console.log('[Quiz History] Saved document ID:', savedQuizHistory._id);
    
    res.status(201).json({
      message: 'Quiz history saved successfully',
      quizHistory: savedQuizHistory
    });
  } catch (error) {
    console.error('[Quiz History] ❌ Error saving quiz history:', error);
    next(error);
  }
};

// Retrieve all quiz histories for a given userID
export const getUserQuizHistories = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req.session as any)?.passport?.user;
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

// Retrieve all histories across users (admin/debug endpoint)
export const getAllQuizHistories = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req.session as any)?.passport?.user;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const quizHistories = await QuizHistory.find()
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(offset))
      .exec();

    const totalCount = await QuizHistory.countDocuments();

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
  const userId = (req.session as any)?.passport?.user;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { id } = req.params;

  try {
    const quizHistory = await QuizHistory.findById(id);
    
    if (!quizHistory) {
      return res.status(404).json({ message: 'Quiz history not found' });
    }

    // Check if the user owns this quiz history
    if (quizHistory.userID !== userId) {
      return res.status(403).json({ message: 'Access denied' });
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
