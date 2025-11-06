import { Schema, model, Document } from 'mongoose';

interface IConceptProgress extends Document {
  user: Schema.Types.ObjectId;
  conceptId: string;
  confidenceScore: number;
  lastAttempted: Date;
}

const ConceptProgressSchema = new Schema<IConceptProgress>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  conceptId: { type: String, required: true },
  confidenceScore: { type: Number, default: 0.5, min: 0, max: 1 }, // Start at a neutral 0.5
  lastAttempted: { type: Date, default: Date.now },
});

// Ensure a user has only one progress document per concept
ConceptProgressSchema.index({ user: 1, conceptId: 1 }, { unique: true });

const ConceptProgress = model<IConceptProgress>('ConceptProgress', ConceptProgressSchema);

export default ConceptProgress;
export { IConceptProgress };
