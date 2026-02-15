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
  concepts: IConcept[];
  questions: IQuestion[];
  createdAt: Date;
  updatedAt: Date;
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
  concepts: [conceptSchema],
  questions: [questionSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for efficient queries by userID
QuizHistorySchema.index({ userID: 1 });

// Update the updatedAt field before saving
QuizHistorySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const QuizHistory = model<IQuizHistory>('QuizHistory', QuizHistorySchema);

export default QuizHistory;
export { IQuizHistory, IConcept, IQuestion };
