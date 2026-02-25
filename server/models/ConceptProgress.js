"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const ConceptProgressSchema = new mongoose_1.Schema({
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    conceptId: { type: String, required: true },
    confidenceScore: { type: Number, default: 0.5, min: 0, max: 1 }, // Start at a neutral 0.5
    lastAttempted: { type: Date, default: Date.now },
});
// Ensure a user has only one progress document per concept
ConceptProgressSchema.index({ user: 1, conceptId: 1 }, { unique: true });
const ConceptProgress = (0, mongoose_1.model)('ConceptProgress', ConceptProgressSchema);
exports.default = ConceptProgress;
