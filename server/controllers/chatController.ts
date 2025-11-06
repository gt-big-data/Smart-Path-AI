import { Request, Response } from 'express';
import User from '../models/User';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get current logged in user's ID
 * GET /chat/user
 */
export const getCurrentUserId = async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.passport?.user;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
    }
    console.log("userId from backend", userId);
    const idString = typeof userId === 'object' ? userId._id : userId;

    res.status(200).send(idString);
  } catch (err) {
    console.error('Get current user ID error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

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
    const { chat_id, sender, text, graph_id } = req.body;

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
        graph_id: graph_id || '', // Initialize with empty string if no graph_id
        messages: [],
      };
      user?.chats.push(chat);
    }

    // If graph_id is provided, update it
    if (graph_id) {
      chat.graph_id = graph_id;
    }

    // Only add message if text is provided (allows for graph_id only updates)
    if (text) {
      const newMessage = {
        sender,
        text,
        timestamp: new Date(),
      };
      chat.messages.push(newMessage);
    }

    if (user) {
      await user.save();

      console.log("message/graph_id update successful");
      res.status(200).json({
        message: text ? 'Message added' : 'Graph ID updated',
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


// GET /chat/chats
export const getUserChats = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user?.chats);  // assuming chats are stored in user.chats
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

/**
 * Delete a chat for the current user
 * DELETE /chat/delete/:chat_id
 */
export const deleteChat = async (req: Request, res: Response): Promise<void> => {
  console.log("=== DELETE CHAT REQUEST ===");
  console.log("Request params:", req.params);
  console.log("Request method:", req.method);
  console.log("Request URL:", req.url);

  try {
    const userId = (req.session as any)?.passport?.user;
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

    const user = await User.findById(userId);

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
    await user.save();

    console.log(`✅ Chat ${chat_id} deleted successfully. User now has ${user.chats.length} chats.`);
    res.status(200).json({
      message: 'Chat deleted successfully',
      chat_id: chat_id,
    });

  } catch (error) {
    console.error('❌ Delete chat error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};