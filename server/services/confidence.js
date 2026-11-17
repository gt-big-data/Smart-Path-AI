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
const bayesianKnowledgeTracing_1 = require("../utils/bayesianKnowledgeTracing");
/** Apply a graded exam question once per concept in its chat. */
function updateConfidenceScore(userId, chatId, conceptId, isCorrect, updateId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const key = { user: userId, chatId, conceptId };
        for (;;) {
            const progress = yield ConceptProgress_1.default.findOne(key).select('+examProgressUpdates');
            if ((_a = progress === null || progress === void 0 ? void 0 : progress.examProgressUpdates) === null || _a === void 0 ? void 0 : _a.includes(updateId))
                return progress;
            const now = new Date();
            const score = progress && (0, confidenceDecay_1.calculateDecayedConfidence)(progress.confidenceScore, progress.lastAttempted, now.getTime());
            const confidenceScore = (0, bayesianKnowledgeTracing_1.calculateBayesianConfidence)(score !== null && score !== void 0 ? score : undefined, isCorrect);
            try {
                // Compare the previous score/time so concurrent updates cannot overwrite each other.
                const updated = yield ConceptProgress_1.default.findOneAndUpdate(Object.assign(Object.assign(Object.assign({}, key), (progress ? { _id: progress._id, confidenceScore: progress.confidenceScore,
                    lastAttempted: progress.lastAttempted } : { _id: new mongoose_1.Types.ObjectId() })), { examProgressUpdates: { $ne: updateId } }), {
                    $set: { confidenceScore, lastAttempted: now },
                    $addToSet: { examProgressUpdates: updateId },
                }, { new: true, upsert: !progress });
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
