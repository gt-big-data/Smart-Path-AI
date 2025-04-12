import express from 'express';
import { createNewChat, addMessageToChat } from '../controllers/chatController';

const router = express.Router();

router.post('/new', createNewChat);
router.post('/message', addMessageToChat);

export default router;
