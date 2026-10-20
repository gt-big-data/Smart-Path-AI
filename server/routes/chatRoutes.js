"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const chatController_1 = require("../controllers/chatController");
const router = express_1.default.Router();
router.post('/folder/new', chatController_1.createFolder);
router.delete('/folder/:folder_id', chatController_1.deleteFolder);
router.get('/folders', chatController_1.getUserFolders);
router.patch('/folder/:folder_id/move', chatController_1.moveFolder);
router.patch('/folder/:folder_id/rename', chatController_1.renameFolder);
router.patch('/move-to-folder', chatController_1.moveChatToFolder);
router.post('/new', chatController_1.createNewChat);
router.post('/message', chatController_1.addMessageToChat);
router.get('/user', chatController_1.getCurrentUserId);
router.get('/graph-ids', chatController_1.getUserGraphIds); // Must come before /:userId/chats
router.delete('/delete/:chat_id', chatController_1.deleteChat); // Must come before /:userId/chats
router.patch('/rename/:chat_id', chatController_1.renameChat); // Must come before /:userId/chats
router.get('/:userId/chats', chatController_1.getUserChats);
exports.default = router;
