import { Schema, model, Document } from 'mongoose';

interface IConcept {
  conceptID: string;
  name: string;
}

interface IQuestion {
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  timestamp: Date;
}

interface IQuizHistory extends Document {
  userID: string;
  chatID: string;
  concepts: IConcept[];
  questions: IQuestion[];
  createdAt: Date;
  updatedAt: Date;
  schemaVersion?: number;
  attemptId?: string;
  graphId?: string;
  title?: string;
  format?: string;
  status?: 'draft' | 'completed';
  definition?: QuizQuestion[];
  results?: Record<string, QuizResult>;
  correctCount?: number;
  totalQuestions?: number;
  completedAt?: Date;
}

export interface QuizQuestion {
  question: string; answer: string; conceptId: string; conceptName?: string;
  explanation?: string; format?: string;
}
export interface QuizResult {
  answer: string; isCorrect: boolean; feedback: string; skipped: boolean;
  followUpQuestion?: string;
}

const conceptSchema = new Schema<IConcept>({
  conceptID: { type: String, required: true },
  name: { type: String, required: true }
}, { _id: false });

const questionSchema = new Schema<IQuestion>({
  questionText: { type: String, required: true },
  userAnswer: { type: String, required: true },
  correctAnswer: { type: String, required: true },
  explanation: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const QuizHistorySchema = new Schema<IQuizHistory>({
  userID: { type: String, required: true },
  chatID: { type: String, required: true },
  concepts: [conceptSchema],
  questions: [questionSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  schemaVersion: Number,
  attemptId: String, graphId: String, title: String, format: String,
  status: { type: String, enum: ['draft', 'completed'] },
  definition: { type: Schema.Types.Mixed, select: false },
  results: { type: Schema.Types.Mixed, select: false },
  correctCount: Number, totalQuestions: Number, completedAt: Date,
});

// Index for efficient queries by userID
QuizHistorySchema.index({ userID: 1 });
QuizHistorySchema.index({ userID: 1, chatID: 1, createdAt: -1 });
QuizHistorySchema.index({ userID: 1, attemptId: 1 }, {
  unique: true, partialFilterExpression: { attemptId: { $type: 'string' } },
});

// Update the updatedAt field before saving
QuizHistorySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const QuizHistory = model<IQuizHistory>('QuizHistory', QuizHistorySchema);

export default QuizHistory;
export { IQuizHistory, IConcept, IQuestion };
