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
exports.processAllQuizHistory = exports.getQuizHistoryById = exports.getAllQuizHistories = exports.getUserQuizHistories = exports.saveQuizHistory = void 0;
const QuizHistory_1 = __importDefault(require("../models/QuizHistory"));
const chatService_1 = require("../services/chatService");
const progressService_1 = require("../services/progressService");
// Save a new QuizHistory record when a quiz is completed
const saveQuizHistory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    console.log('[Quiz History] POST /api/quiz-history endpoint called');
    console.log('[Quiz History] Request body:', JSON.stringify(req.body, null, 2));
    const userId = (0, chatService_1.normalizeSessionUserId)((_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user);
    console.log('[Quiz History] User ID from session:', userId);
    if (!userId) {
        console.log('[Quiz History] No user ID found in session - returning 401');
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const userID = String(userId);
    const chatId = String(((_c = req.body) === null || _c === void 0 ? void 0 : _c.chat_id) || ((_d = req.body) === null || _d === void 0 ? void 0 : _d.chatId) || '');
    const quizId = String(((_e = req.body) === null || _e === void 0 ? void 0 : _e.quiz_id) || ((_f = req.body) === null || _f === void 0 ? void 0 : _f.quizId) || '');
    const { concepts, questions } = req.body || {};
    if (!chatId || !quizId) {
        return res.status(400).json({ message: 'chat_id and quiz_id are required' });
    }
    // Validate required fields
    if (!concepts || !Array.isArray(concepts)) {
        return res.status(400).json({ message: 'Concepts array is required' });
    }
    if (!questions || !Array.isArray(questions)) {
        return res.status(400).json({ message: 'Questions array is required' });
    }
    if (concepts.length !== questions.length) {
        return res.status(400).json({ message: 'Each question must have one matching concept' });
    }
    const conceptEntries = concepts.map((concept) => ({
        concept_id: (0, progressService_1.normalizeConceptId)(concept),
        name: String((concept === null || concept === void 0 ? void 0 : concept.name) || ''),
    }));
    if (conceptEntries.some(concept => !concept.concept_id || !concept.name)) {
        return res.status(400).json({ message: 'Each concept must have concept_id and name' });
    }
    const normalizedConcepts = conceptEntries;
    // Validate questions structure
    for (const question of questions) {
        if (!(question === null || question === void 0 ? void 0 : question.questionText) || !(question === null || question === void 0 ? void 0 : question.userAnswer) || !(question === null || question === void 0 ? void 0 : question.correctAnswer) || !(question === null || question === void 0 ? void 0 : question.explanation)) {
            return res.status(400).json({ message: 'Each question must have questionText, userAnswer, correctAnswer, and explanation' });
        }
    }
    try {
        if (!(yield (0, chatService_1.findOwnedChat)(userID, chatId))) {
            return res.status(404).json({ message: 'Chat not found for this user' });
        }
        const historyFilter = { userID, chat_id: chatId, quiz_id: quizId };
        let savedQuizHistory;
        try {
            savedQuizHistory = yield QuizHistory_1.default.findOneAndUpdate(historyFilter, {
                $setOnInsert: Object.assign(Object.assign({}, historyFilter), { concepts: normalizedConcepts, questions: questions }),
            }, { new: true, upsert: true, setDefaultsOnInsert: true });
        }
        catch (error) {
            if (error.code !== 11000)
                throw error;
            savedQuizHistory = yield QuizHistory_1.default.findOne(historyFilter);
            if (!savedQuizHistory)
                throw error;
        }
        console.log(`[Quiz History] Saved quiz ${quizId} for user ${userID}, chat ${chatId}`);
        res.status(201).json({
            message: 'Quiz history saved successfully',
            quizHistory: savedQuizHistory,
            progressRecordsCreated: 0,
        });
    }
    catch (error) {
        console.error('[Quiz History] ❌ Error saving quiz history:', error);
        next(error);
    }
});
exports.saveQuizHistory = saveQuizHistory;
// Retrieve all quiz histories for a given userID
const getUserQuizHistories = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const userId = (0, chatService_1.normalizeSessionUserId)((_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user);
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        const quizHistories = yield QuizHistory_1.default.find({ userID: userId })
            .sort({ createdAt: -1 }) // Most recent first
            .exec();
        console.log(`[Quiz History] Retrieved ${quizHistories.length} quiz histories for user ${userId}`);
        res.status(200).json({
            message: 'Quiz histories retrieved successfully',
            count: quizHistories.length,
            quizHistories
        });
    }
    catch (error) {
        console.error('[Quiz History] Error retrieving quiz histories:', error);
        next(error);
    }
});
exports.getUserQuizHistories = getUserQuizHistories;
// Retain the legacy route while restricting results to the authenticated user.
const getAllQuizHistories = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const userId = (0, chatService_1.normalizeSessionUserId)((_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user);
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        const { limit = 50, offset = 0 } = req.query;
        const quizHistories = yield QuizHistory_1.default.find({ userID: userId })
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip(Number(offset))
            .exec();
        const totalCount = yield QuizHistory_1.default.countDocuments({ userID: userId });
        console.log(`[Quiz History] Retrieved ${quizHistories.length} quiz histories (admin view)`);
        res.status(200).json({
            message: 'All quiz histories retrieved successfully',
            count: quizHistories.length,
            totalCount,
            quizHistories
        });
    }
    catch (error) {
        console.error('[Quiz History] Error retrieving all quiz histories:', error);
        next(error);
    }
});
exports.getAllQuizHistories = getAllQuizHistories;
// Get a specific quiz history by ID
const getQuizHistoryById = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const userId = (0, chatService_1.normalizeSessionUserId)((_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user);
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const { id } = req.params;
    try {
        const quizHistory = yield QuizHistory_1.default.findOne({ _id: id, userID: userId });
        if (!quizHistory) {
            return res.status(404).json({ message: 'Quiz history not found' });
        }
        console.log(`[Quiz History] Retrieved quiz history ${id} for user ${userId}`);
        res.status(200).json({
            message: 'Quiz history retrieved successfully',
            quizHistory
        });
    }
    catch (error) {
        console.error('[Quiz History] Error retrieving quiz history by ID:', error);
        next(error);
    }
});
exports.getQuizHistoryById = getQuizHistoryById;
// Process all existing quiz history records to create progress records
const processAllQuizHistory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const userId = (0, chatService_1.normalizeSessionUserId)((_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user);
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    return res.status(200).json({
        message: 'Legacy quiz histories are not replayed because they are not reliably associated with a chat.',
        quizHistoriesProcessed: 0,
        progressRecordsCreated: 0,
        progressRecordsUpdated: 0,
    });
});
exports.processAllQuizHistory = processAllQuizHistory;
