import { Request, Response } from 'express';
import User from '../models/User';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a new chat for the current user
 * POST /chat/new
 */
export const createNewChat = async (req: Request, res: Response) => {
  console.log("hit createchatend");

  try {
    console.log("req", req.session);
    const userId = (req.session as any)?.passport?.user; // Access userId from passport

    console.log("userid1", userId);

    if (!userId) {
      console.log("userid" ,userId);
      console.log("unauthorized");
      res.status(401).json({ message: 'Unauthorized' });
    } else {
      const newChat = {
        chat_id: uuidv4(),
        date_created: new Date(),
        graph_id: '',
        messages: [],
      };

      const user = await User.findById(userId);

      if (!user) {
        console.log("user not found");
        res.status(404).json({ message: 'User not found' });
      } else {
        user.chats.push(newChat);
        await user.save();

        console.log("new chat created successfully");
        res.status(201).json({
          message: 'New chat created',
          chat: newChat,
        });
      }
    }
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


/**
 * Add a message to an existing chat
 * POST /chat/message
 */
export const addMessageToChat = async (req: Request, res: Response) => {
  console.log("hit addMessageToChat");

  try {
    const userId = (req.session as any)?.passport?.user; // Access userId from passport
    const { chat_id, sender, text } = req.body;

    if (!userId) {
      console.log("unauthorized");
      res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await User.findById(userId);

    if (!user) {
      console.log("user not found");
      res.status(404).json({ message: 'User not found' });
    }

    let chat = user?.chats.find((chat) => chat.chat_id === chat_id);

    if (!chat) {
      console.log("chat not found, creating a new chat");
      chat = {
        chat_id,
        date_created: new Date(),
        graph_id: '', // Set to null if no graph is created yet
        messages: [],
      };
      user?.chats.push(chat);
    }

    const newMessage = {
      sender,
      text,
      timestamp: new Date(),
    };

    if (user) {
      chat.messages.push(newMessage);
      await user.save();

      console.log("message added successfully");
      res.status(200).json({
        message: 'Message added',
        chat,
      });
    } else {
      console.log("user not found");
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Add message error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
