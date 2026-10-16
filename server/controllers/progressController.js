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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConceptProgress = exports.updateConceptProgress = void 0;
const chatService_1 = require("../services/chatService");
const progressService_1 = require("../services/progressService");
const updateConceptProgress = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    const userId = (0, chatService_1.normalizeSessionUserId)((_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user);
    if (!userId)
        return res.status(401).json({ message: 'Unauthorized' });
    const chatId = String(((_c = req.body) === null || _c === void 0 ? void 0 : _c.chat_id) || ((_d = req.body) === null || _d === void 0 ? void 0 : _d.chatId) || '');
    const conceptId = (0, progressService_1.normalizeConceptId)(req.body);
    const { isCorrect, isRetry = false } = req.body || {};
    const attemptId = String(((_e = req.body) === null || _e === void 0 ? void 0 : _e.attempt_id) || ((_f = req.body) === null || _f === void 0 ? void 0 : _f.attemptId) || '');
    if (!chatId || !conceptId || !attemptId || typeof isCorrect !== 'boolean' || typeof isRetry !== 'boolean') {
        return res.status(400).json({ message: 'chat_id, concept_id, attempt_id, isCorrect, and isRetry are required' });
    }
    try {
        if (!(yield (0, chatService_1.findOwnedChat)(userId, chatId))) {
            return res.status(404).json({ message: 'Chat not found for this user' });
        }
        const progress = yield (0, progressService_1.updateChatConceptConfidence)({
            userId,
            chatId,
            conceptId,
            isCorrect,
            isRetry,
            attemptId,
        });
        return res.status(200).json(progress);
    }
    catch (error) {
        console.error('Error updating chat concept progress:', error);
        return next(error);
    }
});
exports.updateConceptProgress = updateConceptProgress;
const getConceptProgress = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const userId = (0, chatService_1.normalizeSessionUserId)((_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user);
    if (!userId)
        return res.status(401).json({ message: 'Unauthorized' });
    const chatId = String(req.query.chat_id || req.query.chatId || '') || undefined;
    try {
        if (chatId && !(yield (0, chatService_1.findOwnedChat)(userId, chatId))) {
            return res.status(404).json({ message: 'Chat not found for this user' });
        }
        const progress = yield (0, progressService_1.getUserConceptProgress)(userId, chatId);
        return res.status(200).json(progress);
    }
    catch (error) {
        console.error('Error fetching concept progress:', error);
        return next(error);
    }
});
exports.getConceptProgress = getConceptProgress;
