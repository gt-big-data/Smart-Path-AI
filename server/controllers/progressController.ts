//progressController.ts
import { Request, Response, NextFunction } from 'express';
import ConceptProgress from '../models/ConceptProgress';

const updateConfidenceScore = async (userId: string, conceptId: string, isCorrect: boolean, isRetry: boolean) => {
  let progress = await ConceptProgress.findOne({ user: userId, conceptId });

  if (!progress) {
    progress = new ConceptProgress({
      user: userId,
      conceptId,
      confidenceScore: 0.5, // Starting confidence score
    });
  }

  if (isCorrect) {
    progress.confidenceScore += isRetry ? 0.05 : 0.1;
  } else {
    progress.confidenceScore -= 0.1;
  }

  // Clamp the score between 0 and 1
  progress.confidenceScore = Math.max(0, Math.min(1, progress.confidenceScore));
  progress.lastAttempted = new Date();

  await progress.save();
  return progress;
};

export const updateConceptProgress = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req.session as any)?.passport?.user;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { conceptId, isCorrect, isRetry } = req.body;

  if (typeof conceptId !== 'string' || typeof isCorrect !== 'boolean' || typeof isRetry !== 'boolean') {
    return res.status(400).json({ message: 'Invalid request body' });
  }

  try {
    const progress = await updateConfidenceScore(userId, conceptId, isCorrect, isRetry);
    res.status(200).json(progress);
  } catch (error) {
    console.error('Error updating concept progress:', error);
    next(error);
  }
};

export const getConceptProgress = async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.session as any)?.passport?.user;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const progress = await ConceptProgress.find({ user: userId });
        res.status(200).json(progress);
    } catch (error) {
        console.error('Error fetching concept progress:', error);
        next(error);
    }
};
