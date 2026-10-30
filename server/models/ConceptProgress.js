"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const ConceptProgressSchema = new mongoose_1.Schema({
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    chatId: { type: String },
    conceptId: { type: String, required: true },
    confidenceScore: { type: Number, default: 0.5, min: 0, max: 1 }, // Start at a neutral 0.5
    submissionIds: { type: [String], default: [] },
    lastAttempted: { type: Date, default: Date.now },
    // Topic name saved with the score so the Progress page can label it even if the graph changes
    conceptName: { type: String },
});
// Keep progress unique per user, chat, and graph concept.
ConceptProgressSchema.index({ user: 1, chatId: 1, conceptId: 1 }, { unique: true });
ConceptProgressSchema.set('autoIndex', false);
const ConceptProgress = (0, mongoose_1.model)('ConceptProgress', ConceptProgressSchema);
exports.default = ConceptProgress;
