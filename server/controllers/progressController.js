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
exports.getConceptProgress = exports.updateConceptProgress = void 0;
const ConceptProgress_1 = __importDefault(require("../models/ConceptProgress"));
const updateConfidenceScore = (userId, conceptId, isCorrect, isRetry) => __awaiter(void 0, void 0, void 0, function* () {
    let progress = yield ConceptProgress_1.default.findOne({ user: userId, conceptId });
    if (!progress) {
        progress = new ConceptProgress_1.default({
            user: userId,
            conceptId,
            confidenceScore: 0.5, // Starting confidence score
        });
    }
    if (isCorrect) {
        progress.confidenceScore += isRetry ? 0.05 : 0.1;
    }
    else {
        progress.confidenceScore -= 0.1;
    }
    // Clamp the score between 0 and 1
    progress.confidenceScore = Math.max(0, Math.min(1, progress.confidenceScore));
    progress.lastAttempted = new Date();
    yield progress.save();
    return progress;
});
const updateConceptProgress = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const userId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const { conceptId, isCorrect, isRetry } = req.body;
    if (typeof conceptId !== 'string' || typeof isCorrect !== 'boolean' || typeof isRetry !== 'boolean') {
        return res.status(400).json({ message: 'Invalid request body' });
    }
    try {
        const progress = yield updateConfidenceScore(userId, conceptId, isCorrect, isRetry);
        res.status(200).json(progress);
    }
    catch (error) {
        console.error('Error updating concept progress:', error);
        next(error);
    }
});
exports.updateConceptProgress = updateConceptProgress;
const getConceptProgress = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const userId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user;
    console.log('[getConceptProgress] ===== ENDPOINT CALLED =====');
    console.log('[getConceptProgress] User ID:', userId);
    if (!userId) {
        console.log('[getConceptProgress] No userId in session, returning 401');
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        const progress = yield ConceptProgress_1.default.find({ user: userId });
        console.log(`[getConceptProgress] Found ${progress.length} progress records for user ${userId}`);
        if (progress.length > 0) {
            console.log('[getConceptProgress] Sample progress records:');
            progress.slice(0, 3).forEach((p, idx) => {
                console.log(`  [${idx + 1}] Concept: ${p.conceptId}, Score: ${p.confidenceScore}, Last: ${p.lastAttempted}`);
            });
        }
        else {
            console.log('[getConceptProgress] No progress records found');
        }
        res.status(200).json(progress);
    }
    catch (error) {
        console.error('[getConceptProgress] Error fetching concept progress:', error);
        next(error);
    }
});
exports.getConceptProgress = getConceptProgress;
