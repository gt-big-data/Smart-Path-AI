"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const ChatConceptProgressSchema = new mongoose_1.Schema({
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    chat_id: { type: String, required: true },
    concept_id: { type: String, required: true },
    confidence_score: { type: Number, default: 0.5, min: 0, max: 1 },
    last_attempted: { type: Date, default: Date.now },
    processed_attempt_ids: { type: [String], default: [] },
});
ChatConceptProgressSchema.index({ user: 1, chat_id: 1, concept_id: 1 }, { unique: true });
const ChatConceptProgress = (0, mongoose_1.model)('ChatConceptProgress', ChatConceptProgressSchema);
exports.default = ChatConceptProgress;
