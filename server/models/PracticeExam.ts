import { Schema, model } from 'mongoose';
import { ExamDefinition } from '../services/practiceExamContract';
export interface IPracticeExam {
  user_id: string; chat_id: string; graph_id: string; schema_version: number;
  title: string; total_points: number; sample_filename: string;
  exam: ExamDefinition; blueprint: unknown; createdAt: Date; updatedAt: Date;
}
const schema = new Schema<IPracticeExam>({
  user_id: { type: String, required: true }, chat_id: { type: String, required: true },
  graph_id: { type: String, required: true }, schema_version: { type: Number, default: 2 },
  title: { type: String, required: true }, total_points: { type: Number, required: true },
  sample_filename: { type: String, required: true },
  // Private snapshot. Controllers must explicitly select it and project public fields.
  exam: { type: Schema.Types.Mixed, required: true, select: false },
  blueprint: { type: Schema.Types.Mixed, required: true, select: false },
}, { timestamps: true });
schema.index({ user_id: 1, chat_id: 1, createdAt: -1 });
export default model<IPracticeExam>('PracticeExam', schema);
