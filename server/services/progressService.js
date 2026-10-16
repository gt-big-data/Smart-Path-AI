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
exports.deleteChatProgressAndHistory = exports.getUserConceptProgress = exports.getAllUserConceptProgress = exports.getChatConfidenceMap = exports.getChatConceptProgress = exports.updateChatConceptConfidence = exports.buildConfidenceUpdatePipeline = exports.confidenceDelta = exports.normalizeConceptId = void 0;
const mongoose_1 = require("mongoose");
const ChatConceptProgress_1 = __importDefault(require("../models/ChatConceptProgress"));
const ConceptProgress_1 = __importDefault(require("../models/ConceptProgress"));
const QuizHistory_1 = __importDefault(require("../models/QuizHistory"));
const LEGACY_CONCEPT_FIELDS = [
    'concept_id',
    'conceptId',
    'conceptID',
    'topicID',
    'topic_id',
    'topicId',
    'id',
];
const normalizeConceptId = (value) => {
    if (typeof value === 'string') {
        const normalized = value.trim();
        return normalized || null;
    }
    if (value && typeof value === 'object') {
        const record = value;
        for (const field of LEGACY_CONCEPT_FIELDS) {
            const normalized = (0, exports.normalizeConceptId)(record[field]);
            if (normalized)
                return normalized;
        }
    }
    return null;
};
exports.normalizeConceptId = normalizeConceptId;
const confidenceDelta = (isCorrect, isRetry) => {
    if (!isCorrect)
        return -0.1;
    return isRetry ? 0.05 : 0.1;
};
exports.confidenceDelta = confidenceDelta;
const buildConfidenceUpdatePipeline = (delta, attemptId, attemptedAt) => {
    const priorAttempts = { $ifNull: ['$processed_attempt_ids', []] };
    const alreadyProcessed = { $in: [{ $literal: attemptId }, priorAttempts] };
    const currentScore = { $ifNull: ['$confidence_score', 0.5] };
    return [{
            $set: {
                confidence_score: {
                    $cond: [
                        alreadyProcessed,
                        currentScore,
                        { $max: [0, { $min: [1, { $add: [currentScore, delta] }] }] },
                    ],
                },
                processed_attempt_ids: {
                    $cond: [
                        alreadyProcessed,
                        priorAttempts,
                        { $concatArrays: [priorAttempts, { $literal: [attemptId] }] },
                    ],
                },
                last_attempted: {
                    $cond: [alreadyProcessed, '$last_attempted', attemptedAt],
                },
            },
        }];
};
exports.buildConfidenceUpdatePipeline = buildConfidenceUpdatePipeline;
const updateChatConceptConfidence = (input) => __awaiter(void 0, void 0, void 0, function* () {
    const conceptId = (0, exports.normalizeConceptId)(input.conceptId);
    if (!mongoose_1.Types.ObjectId.isValid(input.userId) || !input.chatId || !conceptId || !input.attemptId || input.attemptId.length > 200) {
        throw new Error('user_id, chat_id, concept_id, and attempt_id are required');
    }
    return ChatConceptProgress_1.default.findOneAndUpdate({
        user: new mongoose_1.Types.ObjectId(input.userId),
        chat_id: input.chatId,
        concept_id: conceptId,
    }, (0, exports.buildConfidenceUpdatePipeline)((0, exports.confidenceDelta)(input.isCorrect, input.isRetry), input.attemptId, new Date()), { new: true, upsert: true });
});
exports.updateChatConceptConfidence = updateChatConceptConfidence;
const getChatConceptProgress = (userId, chatId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.Types.ObjectId.isValid(userId) || !chatId)
        return [];
    return ChatConceptProgress_1.default.find({ user: new mongoose_1.Types.ObjectId(userId), chat_id: chatId });
});
exports.getChatConceptProgress = getChatConceptProgress;
const getChatConfidenceMap = (userId, chatId) => __awaiter(void 0, void 0, void 0, function* () {
    const progress = yield (0, exports.getChatConceptProgress)(userId, chatId);
    return Object.fromEntries(progress.map(record => [record.concept_id, record.confidence_score]));
});
exports.getChatConfidenceMap = getChatConfidenceMap;
const getAllUserConceptProgress = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!mongoose_1.Types.ObjectId.isValid(userId))
        return [];
    const ownerId = new mongoose_1.Types.ObjectId(userId);
    const [chatProgress, legacyProgress] = yield Promise.all([
        ChatConceptProgress_1.default.find({ user: ownerId }),
        ConceptProgress_1.default.find({ user: ownerId }),
    ]);
    return [
        ...chatProgress.map(record => (Object.assign(Object.assign({}, record.toObject()), { concept_id: record.concept_id, conceptId: record.concept_id, confidence_score: record.confidence_score, confidenceScore: record.confidence_score, chat_id: record.chat_id, last_attempted: record.last_attempted, lastAttempted: record.last_attempted }))),
        ...legacyProgress.map(record => (Object.assign(Object.assign({}, record.toObject()), { concept_id: record.conceptId, conceptId: record.conceptId, confidence_score: record.confidenceScore, confidenceScore: record.confidenceScore, chat_id: null, last_attempted: record.lastAttempted, lastAttempted: record.lastAttempted, legacy: true }))),
    ];
});
exports.getAllUserConceptProgress = getAllUserConceptProgress;
const getUserConceptProgress = (userId, chatId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!chatId)
        return (0, exports.getAllUserConceptProgress)(userId);
    if (!mongoose_1.Types.ObjectId.isValid(userId))
        return [];
    const ownerId = new mongoose_1.Types.ObjectId(userId);
    const chatProgress = yield ChatConceptProgress_1.default.find({ user: ownerId, chat_id: chatId });
    return chatProgress.map(record => (Object.assign(Object.assign({}, record.toObject()), { concept_id: record.concept_id, conceptId: record.concept_id, confidence_score: record.confidence_score, confidenceScore: record.confidence_score, chat_id: record.chat_id, last_attempted: record.last_attempted, lastAttempted: record.last_attempted })));
});
exports.getUserConceptProgress = getUserConceptProgress;
const deleteChatProgressAndHistory = (userId, chatId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    if (!mongoose_1.Types.ObjectId.isValid(userId) || !chatId) {
        throw new Error('A valid user_id and chat_id are required');
    }
    const ownerId = new mongoose_1.Types.ObjectId(userId);
    const progressResult = yield ChatConceptProgress_1.default.deleteMany({ user: ownerId, chat_id: chatId });
    const historyResult = yield QuizHistory_1.default.deleteMany({ userID: userId, chat_id: chatId });
    return {
        progressDeleted: (_a = progressResult.deletedCount) !== null && _a !== void 0 ? _a : 0,
        quizHistoriesDeleted: (_b = historyResult.deletedCount) !== null && _b !== void 0 ? _b : 0,
    };
});
exports.deleteChatProgressAndHistory = deleteChatProgressAndHistory;
