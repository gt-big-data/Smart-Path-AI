import express from 'express';
import { createNewChat, addMessageToChat, getUserChats, getCurrentUserId, deleteChat, getUserGraphIds, renameChat } from '../controllers/chatController';

const router = express.Router();

router.post('/new', createNewChat);
router.post('/message', addMessageToChat);
router.get('/user', getCurrentUserId);
router.get('/graph-ids', getUserGraphIds); // Must come before /:userId/chats
router.delete('/delete/:chat_id', deleteChat); // Must come before /:userId/chats
router.patch('/rename/:chat_id', renameChat); // Must come before /:userId/chats
router.get('/:userId/chats', getUserChats);

export default router;
