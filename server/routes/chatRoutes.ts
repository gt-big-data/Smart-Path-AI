import express from 'express';
import { createNewChat, addMessageToChat, getUserChats, getCurrentUserId } from '../controllers/chatController';

const router = express.Router();

router.post('/new', createNewChat);
router.post('/message', addMessageToChat);
router.get('/:userId/chats', getUserChats);
router.get('/user', getCurrentUserId)

export default router;
