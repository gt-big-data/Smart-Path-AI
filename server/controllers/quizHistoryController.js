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
const ConceptProgress_1 = __importDefault(require("../models/ConceptProgress"));
const User_1 = __importDefault(require("../models/User"));
// Older clients send placeholder names like "Question 1 Concept"; only keep real topic names
const isRealConceptName = (name) => typeof name === 'string' && !!name.trim() && !/^Question \d+ Concept$/.test(name.trim());
// Save a new QuizHistory record when a quiz is completed
const saveQuizHistory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    console.log('[Quiz History] POST /api/quiz-history endpoint called');
    console.log('[Quiz History] Request body:', JSON.stringify(req.body, null, 2));
    const userId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user;
    console.log('[Quiz History] User ID from session:', userId);
    if (!userId) {
        console.log('[Quiz History] No user ID found in session - returning 401');
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const { chat_id: chatId, concepts, questions } = req.body;
    if (typeof chatId !== 'string' || !chatId.trim()) {
        return res.status(400).json({ message: 'chat_id is required' });
    }
    // Validate required fields
    if (!concepts || !Array.isArray(concepts)) {
        return res.status(400).json({ message: 'Concepts array is required' });
    }
    if (!questions || !Array.isArray(questions)) {
        return res.status(400).json({ message: 'Questions array is required' });
    }
    // Validate concepts structure
    for (const concept of concepts) {
        if (!concept.conceptID || !concept.name) {
            return res.status(400).json({ message: 'Each concept must have conceptID and name' });
        }
    }
    // Validate questions structure
    for (const question of questions) {
        if (!question.questionText || !question.userAnswer || !question.correctAnswer || !question.explanation) {
            return res.status(400).json({ message: 'Each question must have questionText, userAnswer, correctAnswer, and explanation' });
        }
    }
    try {
        const chatOwner = yield User_1.default.exists({ _id: userId, 'chats.chat_id': chatId });
        if (!chatOwner) {
            return res.status(404).json({ message: 'Chat not found' });
        }
        console.log('[Quiz History] Creating new QuizHistory document...');
        const quizHistory = new QuizHistory_1.default({
            userID: userId,
            chatID: chatId,
            concepts: concepts,
            questions: questions
        });
        console.log('[Quiz History] QuizHistory document created, calling save()...');
        const savedQuizHistory = yield quizHistory.save();
        console.log(`[Quiz History] ✅ Successfully saved quiz history for user ${userId} with ${questions.length} questions`);
        console.log('[Quiz History] Saved document ID:', savedQuizHistory._id);
        // Confidence is applied by answer verification; history is archival only.
        for (const concept of concepts) {
            if (!(concept === null || concept === void 0 ? void 0 : concept.conceptID) || !isRealConceptName(concept.name))
                continue;
            try {
                yield ConceptProgress_1.default.updateOne({ user: userId, chatId, conceptId: concept.conceptID }, { $set: { conceptName: String(concept.name).trim() } });
            }
            catch (error) {
                console.error(`[Quiz History] ❌ Error labeling progress for concept ${concept.conceptID}:`, error);
            }
        }
        res.status(201).json({
            message: 'Quiz history saved successfully',
            quizHistory: savedQuizHistory,
            progressRecordsCreated: 0
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
    const userId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user;
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
// Retrieve all histories across users (admin/debug endpoint)
const getAllQuizHistories = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const userId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        const { limit = 50, offset = 0 } = req.query;
        const quizHistories = yield QuizHistory_1.default.find()
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip(Number(offset))
            .exec();
        const totalCount = yield QuizHistory_1.default.countDocuments();
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
    const userId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const { id } = req.params;
    try {
        const quizHistory = yield QuizHistory_1.default.findById(id);
        if (!quizHistory) {
            return res.status(404).json({ message: 'Quiz history not found' });
        }
        // Check if the user owns this quiz history
        if (quizHistory.userID !== userId) {
            return res.status(403).json({ message: 'Access denied' });
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
// Kept for API compatibility; quiz history must never replay confidence updates.
const processAllQuizHistory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const userId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user;
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        res.status(200).json({
            message: 'Quiz history is archival and is not replayed into confidence scores',
            quizHistoriesProcessed: 0,
            progressRecordsCreated: 0,
            progressRecordsUpdated: 0
        });
    }
    catch (error) {
        next(error);
    }
});
exports.processAllQuizHistory = processAllQuizHistory;
