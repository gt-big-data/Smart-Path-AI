"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const messageSchema = new mongoose_1.default.Schema({
    sender: { type: String, enum: ['user', 'ai'], required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
});
const folderSchema = new mongoose_1.default.Schema({
    folder_id: { type: String, required: true },
    name: { type: String, required: true },
    date_created: { type: Date, default: Date.now },
    parent_folder_id: { type: String, default: null },
});
const chatSchema = new mongoose_1.default.Schema({
    chat_id: { type: String, required: true },
    title: { type: String, default: 'New Chat' },
    date_created: { type: Date, default: Date.now },
    graph_id: { type: String, default: '' },
    folder_id: { type: String, default: null },
    messages: [messageSchema],
});
const userSchema = new mongoose_1.default.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String },
    name: { type: String },
    displayName: { type: String },
    googleId: { type: String },
    folders: [folderSchema],
    chats: [chatSchema],
});
exports.default = mongoose_1.default.model('User', userSchema);
