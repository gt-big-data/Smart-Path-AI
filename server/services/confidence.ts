import { Types } from 'mongoose';
import ConceptProgress from '../models/ConceptProgress';
import { calculateDecayedConfidence } from '../utils/confidenceDecay';
import { calculateBayesianConfidence } from '../utils/bayesianKnowledgeTracing';

/** Apply a graded exam question once per concept in its chat. */
export async function updateConfidenceScore(
  userId: string, chatId: string, conceptId: string, isCorrect: boolean, updateId: string,
) {
  const key = { user: userId, chatId, conceptId };
  for (;;) {
    const progress = await ConceptProgress.findOne(key).select('+examProgressUpdates');
    if (progress?.examProgressUpdates?.includes(updateId)) return progress;
    const now = new Date();
    const score = progress && calculateDecayedConfidence(progress.confidenceScore, progress.lastAttempted, now.getTime());
    const confidenceScore = calculateBayesianConfidence(score ?? undefined, isCorrect);
    try {
      // Compare the previous score/time so concurrent updates cannot overwrite each other.
      const updated = await ConceptProgress.findOneAndUpdate({
        ...key,
        ...(progress ? { _id: progress._id, confidenceScore: progress.confidenceScore,
          lastAttempted: progress.lastAttempted } : { _id: new Types.ObjectId() }),
        examProgressUpdates: { $ne: updateId },
      }, {
        $set: { confidenceScore, lastAttempted: now },
        $addToSet: { examProgressUpdates: updateId },
      }, { new: true, upsert: !progress });
      if (updated) return updated;
    } catch (error: any) {
      // Another request may have created this user's concept record first.
      if (error.code !== 11000) throw error;
    }
  }
}
