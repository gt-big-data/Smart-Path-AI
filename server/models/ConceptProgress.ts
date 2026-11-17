import { Schema, model, Document } from 'mongoose';

interface IConceptProgress extends Document {
  user: Schema.Types.ObjectId;
  chatId?: string;
  conceptId: string;
  confidenceScore: number;
  lastAttempted: Date;
  conceptName?: string;
  examProgressUpdates?: string[];
  submissionIds: string[];
}

const ConceptProgressSchema = new Schema<IConceptProgress>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  chatId: { type: String },
  conceptId: { type: String, required: true },
  confidenceScore: { type: Number, default: 0.2, min: 0, max: 1 },
  submissionIds: { type: [String], default: [] },
  lastAttempted: { type: Date, default: Date.now },
  // Topic name saved with the score so the Progress page can label it even if the graph changes
  conceptName: { type: String },
  examProgressUpdates: { type: [String], default: undefined, select: false },
});

// Keep progress unique per user, chat, and graph concept.
ConceptProgressSchema.index({ user: 1, chatId: 1, conceptId: 1 }, { unique: true });
ConceptProgressSchema.set('autoIndex', false);

const ConceptProgress = model<IConceptProgress>('ConceptProgress', ConceptProgressSchema);

export default ConceptProgress;
export { IConceptProgress };
