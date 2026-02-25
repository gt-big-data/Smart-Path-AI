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
exports.renameChat = exports.deleteChat = exports.getUserGraphIds = exports.getUserChats = exports.addMessageToChat = exports.createNewChat = exports.getCurrentUserId = void 0;
const User_1 = __importDefault(require("../models/User"));
const uuid_1 = require("uuid");
/**
 * Get current logged in user's ID
 * GET /chat/user
 */
const getCurrentUserId = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const userId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return; // CRITICAL: Stop execution after sending error response
        }
        console.log("userId from backend", userId);
        const idString = typeof userId === 'object' ? userId._id : userId;
        res.status(200).send(idString);
    }
    catch (err) {
        console.error('Get current user ID error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});
exports.getCurrentUserId = getCurrentUserId;
/**
 * Create a new chat for the current user
 * POST /chat/new
 */
const createNewChat = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    console.log("hit createchatend");
    try {
        console.log("req", req.session);
        const userId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user; // Access userId from passport
        console.log("userid1", userId);
        if (!userId) {
            console.log("userid", userId);
            console.log("unauthorized");
            res.status(401).json({ message: 'Unauthorized' });
            return; // CRITICAL: Stop execution after sending error response
        }
        else {
            const newChat = {
                chat_id: (0, uuid_1.v4)(),
                title: 'New Chat',
                date_created: new Date(),
                graph_id: '',
                messages: [],
            };
            const user = yield User_1.default.findById(userId);
            if (!user) {
                console.log("user not found");
                res.status(404).json({ message: 'User not found' });
                return; // CRITICAL: Stop execution after sending error response
            }
            else {
                user.chats.push(newChat);
                yield user.save();
                console.log("new chat created successfully");
                res.status(201).json({
                    message: 'New chat created',
                    chat: newChat,
                });
            }
        }
    }
    catch (error) {
        console.error('Create chat error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
exports.createNewChat = createNewChat;
/**
 * Add a message to an existing chat
 * POST /chat/message
 */
const addMessageToChat = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    console.log("hit addMessageToChat");
    try {
        const userId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user; // Access userId from passport
        const { chat_id, sender, text, graph_id } = req.body;
        if (!userId) {
            console.log("unauthorized");
            res.status(401).json({ message: 'Unauthorized' });
            return; // CRITICAL: Stop execution after sending error response
        }
        const user = yield User_1.default.findById(userId);
        if (!user) {
            console.log("user not found");
            res.status(404).json({ message: 'User not found' });
            return; // CRITICAL: Stop execution after sending error response
        }
        let chat = user.chats.find((chat) => chat.chat_id === chat_id);
        if (!chat) {
            console.log("chat not found, creating a new chat");
            const newChat = {
                chat_id,
                title: 'New Chat',
                date_created: new Date(),
                graph_id: graph_id || '',
                messages: [],
            };
            user.chats.push(newChat);
            chat = user.chats[user.chats.length - 1];
        }
        // If graph_id is provided, update it
        if (graph_id && chat) {
            chat.graph_id = graph_id;
        }
        // Only add message if text is provided (allows for graph_id only updates)
        if (text && chat) {
            const newMessage = {
                sender,
                text,
                timestamp: new Date(),
            };
            chat.messages.push(newMessage);
        }
        if (user) {
            yield user.save();
            console.log("message/graph_id update successful");
            res.status(200).json({
                message: text ? 'Message added' : 'Graph ID updated',
                chat,
            });
        }
        else {
            console.log("user not found");
            res.status(404).json({ message: 'User not found' });
        }
    }
    catch (error) {
        console.error('Add message error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
exports.addMessageToChat = addMessageToChat;
// GET /chat/chats
const getUserChats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.params.userId;
        const user = yield User_1.default.findById(userId);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return; // CRITICAL: Stop execution after sending error response
        }
        res.status(200).json(user.chats); // assuming chats are stored in user.chats
    }
    catch (err) {
        res.status(500).json({ message: 'Server Error' });
    }
});
exports.getUserChats = getUserChats;
/**
 * Get all graph IDs for the current user
 * GET /chat/graph-ids
 */
const getUserGraphIds = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        console.log('[getUserGraphIds] ===== ENDPOINT CALLED =====');
        console.log('[getUserGraphIds] Session:', req.session);
        console.log('[getUserGraphIds] Session passport:', (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport);
        // Use the exact same pattern as addMessageToChat which works
        const userId = (_c = (_b = req.session) === null || _b === void 0 ? void 0 : _b.passport) === null || _c === void 0 ? void 0 : _c.user;
        console.log('[getUserGraphIds] Request received, userId:', userId);
        console.log('[getUserGraphIds] userId type:', typeof userId);
        if (!userId) {
            console.log('[getUserGraphIds] No userId in session, returning 401');
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        console.log('[getUserGraphIds] Querying database with userId:', userId);
        const user = yield User_1.default.findById(userId);
        console.log('[getUserGraphIds] User query result:', user ? 'Found user' : 'User is null');
        if (!user) {
            console.log('[getUserGraphIds] User not found in database for userId:', userId);
            // Try to list all users to debug
            const allUsers = yield User_1.default.find({}).limit(5).select('_id email');
            console.log('[getUserGraphIds] Sample users in DB:', allUsers.map(u => ({ id: u._id, email: u.email })));
            res.status(404).json({ message: 'User not found' });
            return;
        }
        // Extract all unique graph_ids from chats, filtering out empty strings
        const graphIds = [...new Set(user.chats
                .map(chat => chat.graph_id)
                .filter(id => id && id.trim() !== ''))];
        console.log(`[getUserGraphIds] Found ${graphIds.length} graph IDs for user ${userId}:`, graphIds);
        res.status(200).json({ graphIds });
    }
    catch (error) {
        console.error('[getUserGraphIds] Error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        res.status(500).json({
            message: 'Internal server error',
            error: error.message
        });
    }
});
exports.getUserGraphIds = getUserGraphIds;
/**
 * Delete a chat for the current user
 * DELETE /chat/delete/:chat_id
 */
const deleteChat = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    console.log("=== DELETE CHAT REQUEST ===");
    console.log("Request params:", req.params);
    console.log("Request method:", req.method);
    console.log("Request URL:", req.url);
    try {
        const userId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user;
        const { chat_id } = req.params;
        console.log("User ID from session:", userId);
        console.log("Chat ID from params:", chat_id);
        if (!userId) {
            console.log("ERROR: Unauthorized - no userId in session");
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        if (!chat_id) {
            console.log("ERROR: Chat ID is required");
            res.status(400).json({ message: 'Chat ID is required' });
            return;
        }
        const user = yield User_1.default.findById(userId);
        if (!user) {
            console.log("ERROR: User not found in database");
            res.status(404).json({ message: 'User not found' });
            return;
        }
        console.log(`User has ${user.chats.length} chats`);
        console.log("Looking for chat_id:", chat_id);
        console.log("Available chat_ids:", user.chats.map(c => c.chat_id));
        // Find the chat index
        const chatIndex = user.chats.findIndex((chat) => chat.chat_id === chat_id);
        if (chatIndex === -1) {
            console.log("ERROR: Chat not found in user's chats");
            res.status(404).json({ message: 'Chat not found' });
            return;
        }
        console.log(`Found chat at index ${chatIndex}, deleting...`);
        // Remove the chat from the array
        user.chats.splice(chatIndex, 1);
        yield user.save();
        console.log(`✅ Chat ${chat_id} deleted successfully. User now has ${user.chats.length} chats.`);
        res.status(200).json({
            message: 'Chat deleted successfully',
            chat_id: chat_id,
        });
    }
    catch (error) {
        console.error('❌ Delete chat error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
exports.deleteChat = deleteChat;
/**
 * Rename a chat
 * PATCH /chat/rename/:chat_id
 */
const renameChat = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const userId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user;
        const { chat_id } = req.params;
        const { title } = req.body;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        if (!chat_id || !title || !title.trim()) {
            res.status(400).json({ message: 'Chat ID and title are required' });
            return;
        }
        const user = yield User_1.default.findById(userId);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        const chat = user.chats.find((c) => c.chat_id === chat_id);
        if (!chat) {
            res.status(404).json({ message: 'Chat not found' });
            return;
        }
        chat.title = title.trim();
        user.markModified('chats');
        yield user.save();
        res.status(200).json({ message: 'Chat renamed', chat_id, title: chat.title });
    }
    catch (error) {
        console.error('Rename chat error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
exports.renameChat = renameChat;
