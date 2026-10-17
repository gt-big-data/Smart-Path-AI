import express from 'express';
import { addMessageToChat, createFolder, createNewChat, deleteChat, deleteFolder, getCurrentUserId, getUserChats, getUserFolders, getUserGraphIds, moveChatToFolder, moveFolder, renameChat, renameFolder } from '../controllers/chatController';

const router = express.Router();

router.post('/folder/new', createFolder);
router.delete('/folder/:folder_id', deleteFolder);
router.get('/folders', getUserFolders);
router.patch('/folder/:folder_id/move', moveFolder);
router.patch('/folder/:folder_id/rename', renameFolder);
router.patch('/move-to-folder', moveChatToFolder);
router.post('/new', createNewChat);
router.post('/message', addMessageToChat);
router.get('/user', getCurrentUserId);
router.get('/graph-ids', getUserGraphIds); // Must come before /:userId/chats
router.delete('/delete/:chat_id', deleteChat); // Must come before /:userId/chats
router.patch('/rename/:chat_id', renameChat); // Must come before /:userId/chats
router.get('/:userId/chats', getUserChats);

export default router;
