"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateConfidenceScore = updateConfidenceScore;
const mongoose_1 = require("mongoose");
const ConceptProgress_1 = __importDefault(require("../models/ConceptProgress"));
const confidenceDecay_1 = require("../utils/confidenceDecay");
/** Quiz scoring rules, kept separate while the quiz implementation is changing. */
function updateConfidenceScore(userId_1, conceptId_1, isCorrect_1) {
    return __awaiter(this, arguments, void 0, function* (userId, conceptId, isCorrect, isRetry = false, updateId) {
        var _a, _b;
        for (;;) {
            const progress = yield ConceptProgress_1.default.findOne({ user: userId, conceptId }).select('+examProgressUpdates');
            if (updateId && ((_a = progress === null || progress === void 0 ? void 0 : progress.examProgressUpdates) === null || _a === void 0 ? void 0 : _a.includes(updateId)))
                return progress;
            const now = new Date();
            const score = (0, confidenceDecay_1.calculateDecayedConfidence)((_b = progress === null || progress === void 0 ? void 0 : progress.confidenceScore) !== null && _b !== void 0 ? _b : 0.5, progress === null || progress === void 0 ? void 0 : progress.lastAttempted, now.getTime());
            const delta = isCorrect ? (isRetry ? 0.05 : 0.1) : -0.1;
            try {
                // Compare the previous score/time so concurrent updates cannot overwrite each other.
                const updated = yield ConceptProgress_1.default.findOneAndUpdate(Object.assign(Object.assign({ user: userId, conceptId }, (progress ? { _id: progress._id, confidenceScore: progress.confidenceScore,
                    lastAttempted: progress.lastAttempted } : { _id: new mongoose_1.Types.ObjectId() })), (updateId ? { examProgressUpdates: { $ne: updateId } } : {})), Object.assign({ $set: { confidenceScore: Math.max(0, Math.min(1, score + delta)), lastAttempted: now } }, (updateId ? { $addToSet: { examProgressUpdates: updateId } } : {})), { new: true, upsert: !progress });
                if (updated)
                    return updated;
            }
            catch (error) {
                // Another request may have created this user's concept record first.
                if (error.code !== 11000)
                    throw error;
            }
        }
    });
}
