import { Request, Response, NextFunction } from 'express';
import QuizHistory, { IQuizHistory, IConcept, IQuestion } from '../models/QuizHistory';
import ConceptProgress from '../models/ConceptProgress';

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
    
    // Create/update progress records from quiz history
    console.log('[Quiz History] Creating progress records from quiz answers...');
    let progressCreated = 0;
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const concept = concepts[i];
      
      if (!concept || !concept.conceptID) {
        console.warn(`[Quiz History] Skipping question ${i + 1} - no conceptID`);
        continue;
      }
      
      // Check if answer is correct (normalize both answers for comparison)
      const userAnswer = String(question.userAnswer).trim().toUpperCase();
      const correctAnswer = String(question.correctAnswer).trim().toUpperCase();
      
      // Treat skipped questions as incorrect
      const isSkipped = userAnswer === 'SKIPPED' || userAnswer === 'SKIP';
      const isCorrect = !isSkipped && (
        userAnswer === correctAnswer || 
        (correctAnswer === 'T' && userAnswer === 'TRUE') ||
        (correctAnswer === 'F' && userAnswer === 'FALSE') ||
        (correctAnswer === 'TRUE' && userAnswer === 'T') ||
        (correctAnswer === 'FALSE' && userAnswer === 'F')
      );
      
      try {
        // Find or create progress record
        let progress = await ConceptProgress.findOne({ 
          user: userId, 
          conceptId: concept.conceptID 
        });
        
        if (!progress) {
          progress = new ConceptProgress({
            user: userId,
            conceptId: concept.conceptID,
            confidenceScore: 0.5,
            lastAttempted: new Date()
          });
        }
        
        // Update confidence score
        if (isCorrect) {
          progress.confidenceScore += 0.1;
        } else {
          progress.confidenceScore -= 0.1;
        }
        
        // Clamp between 0 and 1
        progress.confidenceScore = Math.max(0, Math.min(1, progress.confidenceScore));
        progress.lastAttempted = new Date();
        
        await progress.save();
        progressCreated++;
        console.log(`[Quiz History] ✅ Created/updated progress for concept ${concept.conceptID}: score=${progress.confidenceScore.toFixed(2)}, correct=${isCorrect}`);
      } catch (error) {
        console.error(`[Quiz History] ❌ Error creating progress for concept ${concept.conceptID}:`, error);
      }
    }
    
    console.log(`[Quiz History] ✅ Created/updated ${progressCreated} progress records`);
    
    res.status(201).json({
      message: 'Quiz history saved successfully',
      quizHistory: savedQuizHistory,
      progressRecordsCreated: progressCreated
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

// Process all existing quiz history records to create progress records
export const processAllQuizHistory = async (req: Request, res: Response, next: NextFunction) => {
  console.log('[Quiz History] ===== PROCESS-ALL ENDPOINT CALLED =====');
  const userId = (req.session as any)?.passport?.user;
  console.log('[Quiz History] User ID from session:', userId);
  
  if (!userId) {
    console.log('[Quiz History] No user ID found - returning 401');
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    console.log(`[Quiz History] 🔄 Processing all quiz history for user ${userId}...`);
    const quizHistories = await QuizHistory.find({ userID: userId });
    console.log(`[Quiz History] Found ${quizHistories.length} quiz history records to process`);
    
    let totalProgressCreated = 0;
    let totalProgressUpdated = 0;
    
    for (const quizHistory of quizHistories) {
      const { concepts, questions } = quizHistory;
      
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        const concept = concepts[i];
        
        if (!concept || !concept.conceptID) {
          continue;
        }
        
        // Check if answer is correct
        const userAnswer = String(question.userAnswer).trim().toUpperCase();
        const correctAnswer = String(question.correctAnswer).trim().toUpperCase();
        
        // Treat skipped questions as incorrect
        const isSkipped = userAnswer === 'SKIPPED' || userAnswer === 'SKIP';
        const isCorrect = !isSkipped && (
          userAnswer === correctAnswer || 
          (correctAnswer === 'T' && userAnswer === 'TRUE') ||
          (correctAnswer === 'F' && userAnswer === 'FALSE') ||
          (correctAnswer === 'TRUE' && userAnswer === 'T') ||
          (correctAnswer === 'FALSE' && userAnswer === 'F')
        );
        
        try {
          let progress = await ConceptProgress.findOne({ 
            user: userId, 
            conceptId: concept.conceptID 
          });
          
          const isNew = !progress;
          
          if (!progress) {
            progress = new ConceptProgress({
              user: userId,
              conceptId: concept.conceptID,
              confidenceScore: 0.5,
              lastAttempted: question.timestamp || new Date()
            });
            totalProgressCreated++;
          } else {
            totalProgressUpdated++;
          }
          
          // Update confidence score
          if (isCorrect) {
            progress.confidenceScore += 0.1;
          } else {
            progress.confidenceScore -= 0.1;
          }
          
          progress.confidenceScore = Math.max(0, Math.min(1, progress.confidenceScore));
          if (question.timestamp) {
            progress.lastAttempted = question.timestamp;
          }
          
          await progress.save();
        } catch (error) {
          console.error(`[Quiz History] Error processing concept ${concept.conceptID}:`, error);
        }
      }
    }
    
    console.log(`[Quiz History] ✅ Processed ${quizHistories.length} quiz histories: ${totalProgressCreated} created, ${totalProgressUpdated} updated`);
    
    res.status(200).json({
      message: 'All quiz history processed successfully',
      quizHistoriesProcessed: quizHistories.length,
      progressRecordsCreated: totalProgressCreated,
      progressRecordsUpdated: totalProgressUpdated
    });
  } catch (error) {
    console.error('[Quiz History] Error processing quiz history:', error);
    next(error);
  }
};
