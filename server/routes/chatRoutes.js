"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const chatController_1 = require("../controllers/chatController");
const router = express_1.default.Router();
router.post('/new', chatController_1.createNewChat);
router.post('/message', chatController_1.addMessageToChat);
router.get('/user', chatController_1.getCurrentUserId);
router.get('/graph-ids', chatController_1.getUserGraphIds); // Must come before /:userId/chats
router.delete('/delete/:chat_id', chatController_1.deleteChat); // Must come before /:userId/chats
router.patch('/rename/:chat_id', chatController_1.renameChat); // Must come before /:userId/chats
router.get('/:userId/chats', chatController_1.getUserChats);
exports.default = router;
