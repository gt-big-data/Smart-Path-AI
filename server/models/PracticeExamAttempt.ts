import { Schema, model, Types } from 'mongoose';
import { Answer, Grading } from '../services/practiceExamContract';
export interface IPracticeExamAttempt {
  user_id: string; exam_id: Types.ObjectId; request_id: string;
  status: 'draft' | 'grading' | 'submitted' | 'grading_failed'; revision: number;
  answers: Answer[]; grading?: Grading; grading_started_at?: Date;
  error?: string; submitted_at?: Date; createdAt: Date; updatedAt: Date;
}
const answerSchema = new Schema<Answer>({
  part_id: { type: String, required: true }, user_answer: { type: String, default: '' },
}, { _id: false });
const schema = new Schema<IPracticeExamAttempt>({
  user_id: { type: String, required: true }, exam_id: { type: Schema.Types.ObjectId, required: true, ref: 'PracticeExam' },
  request_id: { type: String, required: true },
  status: { type: String, enum: ['draft', 'grading', 'submitted', 'grading_failed'], default: 'draft' },
  revision: { type: Number, default: 0 }, answers: { type: [answerSchema], default: [] },
  grading: { type: Schema.Types.Mixed }, grading_started_at: Date,
  error: String, submitted_at: Date,
}, { timestamps: true });
schema.index({ user_id: 1, request_id: 1 }, { unique: true });
schema.index({ user_id: 1, exam_id: 1, createdAt: -1 });
export default model<IPracticeExamAttempt>('PracticeExamAttempt', schema);
