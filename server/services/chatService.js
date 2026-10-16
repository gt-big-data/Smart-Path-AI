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
exports.findOwnedChat = exports.normalizeSessionUserId = void 0;
const mongoose_1 = require("mongoose");
const User_1 = __importDefault(require("../models/User"));
const normalizeSessionUserId = (value) => {
    if (typeof value === 'string')
        return value;
    if (!value || typeof value !== 'object')
        return '';
    const sessionUser = value;
    if (sessionUser._id)
        return String(sessionUser._id);
    if (typeof sessionUser.toHexString === 'function')
        return sessionUser.toHexString();
    if (sessionUser.id)
        return String(sessionUser.id);
    return '';
};
exports.normalizeSessionUserId = normalizeSessionUserId;
const findOwnedChat = (userId, chatId, graphId) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!mongoose_1.Types.ObjectId.isValid(userId) || !chatId)
        return null;
    const user = yield User_1.default.findById(userId);
    if (!user)
        return null;
    return (_a = user.chats.find(chat => chat.chat_id === chatId && (!graphId || chat.graph_id === graphId))) !== null && _a !== void 0 ? _a : null;
});
exports.findOwnedChat = findOwnedChat;
