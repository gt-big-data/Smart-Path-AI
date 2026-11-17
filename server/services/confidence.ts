import { Types } from 'mongoose';
import ConceptProgress from '../models/ConceptProgress';
import { calculateDecayedConfidence } from '../utils/confidenceDecay';

/** Quiz scoring rules, kept separate while the quiz implementation is changing. */
export async function updateConfidenceScore(
  userId: string, conceptId: string, isCorrect: boolean, isRetry = false, updateId?: string,
) {
  for (;;) {
    const progress = await ConceptProgress.findOne({ user: userId, conceptId }).select('+examProgressUpdates');
    if (updateId && progress?.examProgressUpdates?.includes(updateId)) return progress;
    const now = new Date();
    const score = calculateDecayedConfidence(progress?.confidenceScore ?? 0.5, progress?.lastAttempted, now.getTime());
    const delta = isCorrect ? (isRetry ? 0.05 : 0.1) : -0.1;
    try {
      // Compare the previous score/time so concurrent updates cannot overwrite each other.
      const updated = await ConceptProgress.findOneAndUpdate({
        user: userId, conceptId,
        ...(progress ? { _id: progress._id, confidenceScore: progress.confidenceScore,
          lastAttempted: progress.lastAttempted } : { _id: new Types.ObjectId() }),
        ...(updateId ? { examProgressUpdates: { $ne: updateId } } : {}),
      }, {
        $set: { confidenceScore: Math.max(0, Math.min(1, score + delta)), lastAttempted: now },
        ...(updateId ? { $addToSet: { examProgressUpdates: updateId } } : {}),
      }, { new: true, upsert: !progress });
      if (updated) return updated;
    } catch (error: any) {
      // Another request may have created this user's concept record first.
      if (error.code !== 11000) throw error;
    }
  }
}
