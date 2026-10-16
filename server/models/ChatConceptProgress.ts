import { Schema, model, Types, Document } from 'mongoose';

export interface IChatConceptProgress extends Document {
  user: Types.ObjectId;
  chat_id: string;
  concept_id: string;
  confidence_score: number;
  last_attempted: Date;
  processed_attempt_ids: string[];
}

const ChatConceptProgressSchema = new Schema<IChatConceptProgress>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  chat_id: { type: String, required: true },
  concept_id: { type: String, required: true },
  confidence_score: { type: Number, default: 0.5, min: 0, max: 1 },
  last_attempted: { type: Date, default: Date.now },
  processed_attempt_ids: { type: [String], default: [] },
});

ChatConceptProgressSchema.index(
  { user: 1, chat_id: 1, concept_id: 1 },
  { unique: true }
);

const ChatConceptProgress = model<IChatConceptProgress>(
  'ChatConceptProgress',
  ChatConceptProgressSchema
);

export default ChatConceptProgress;