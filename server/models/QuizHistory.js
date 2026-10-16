"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const conceptSchema = new mongoose_1.Schema({
    concept_id: { type: String },
    conceptID: { type: String },
    name: { type: String, required: true }
}, { _id: false });
const questionSchema = new mongoose_1.Schema({
    questionText: { type: String, required: true },
    userAnswer: { type: String, required: true },
    correctAnswer: { type: String, required: true },
    explanation: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
}, { _id: false });
const QuizHistorySchema = new mongoose_1.Schema({
    userID: { type: String, required: true },
    chat_id: { type: String },
    quiz_id: { type: String },
    concepts: [conceptSchema],
    questions: [questionSchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
// Index for efficient queries by userID
QuizHistorySchema.index({ userID: 1 });
QuizHistorySchema.index({ userID: 1, chat_id: 1, quiz_id: 1 }, {
    unique: true,
    partialFilterExpression: { chat_id: { $type: 'string' }, quiz_id: { $type: 'string' } },
});
// Update the updatedAt field before saving
QuizHistorySchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});
const QuizHistory = (0, mongoose_1.model)('QuizHistory', QuizHistorySchema);
exports.default = QuizHistory;
