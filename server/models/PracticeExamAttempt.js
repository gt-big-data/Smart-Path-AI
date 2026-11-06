"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const answerSchema = new mongoose_1.Schema({
    part_id: { type: String, required: true }, user_answer: { type: String, default: '' },
}, { _id: false });
const schema = new mongoose_1.Schema({
    user_id: { type: String, required: true }, exam_id: { type: mongoose_1.Schema.Types.ObjectId, required: true, ref: 'PracticeExam' },
    request_id: { type: String, required: true },
    status: { type: String, enum: ['draft', 'grading', 'submitted', 'grading_failed'], default: 'draft' },
    revision: { type: Number, default: 0 }, answers: { type: [answerSchema], default: [] },
    grading: { type: mongoose_1.Schema.Types.Mixed }, grading_started_at: Date,
    error: String, submitted_at: Date,
}, { timestamps: true });
schema.index({ user_id: 1, request_id: 1 }, { unique: true });
schema.index({ user_id: 1, exam_id: 1, createdAt: -1 });
exports.default = (0, mongoose_1.model)('PracticeExamAttempt', schema);
