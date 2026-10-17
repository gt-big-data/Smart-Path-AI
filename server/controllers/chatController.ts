import { Request, Response } from 'express';
import User, { IUser, IChat } from '../models/User';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

/**
 * Get current logged in user's ID
 * GET /chat/user
 */
export const getCurrentUserId = async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.passport?.user;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return; // CRITICAL: Stop execution after sending error response
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
      return; // CRITICAL: Stop execution after sending error response
    } else {
      const newChat = {
        chat_id: uuidv4(),
        title: 'New Chat',
        date_created: new Date(),
        graph_id: '',
        messages: [],
      };

      const user = await User.findById(userId);

      if (!user) {
        console.log("user not found");
        res.status(404).json({ message: 'User not found' });
        return; // CRITICAL: Stop execution after sending error response
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
      return; // CRITICAL: Stop execution after sending error response
    }

    const user = await User.findById(userId);

    if (!user) {
      console.log("user not found");
      res.status(404).json({ message: 'User not found' });
      return; // CRITICAL: Stop execution after sending error response
    }

    let chat = user.chats.find((chat) => chat.chat_id === chat_id);

    if (!chat) {
      console.log("chat not found, creating a new chat");
      const newChat: IChat = {
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
      return; // CRITICAL: Stop execution after sending error response
    }

    res.status(200).json(user.chats);  // assuming chats are stored in user.chats
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

/**
 * Get all graph IDs for the current user
 * GET /chat/graph-ids
 */
export const getUserGraphIds = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('[getUserGraphIds] ===== ENDPOINT CALLED =====');
    console.log('[getUserGraphIds] Session:', req.session);
    console.log('[getUserGraphIds] Session passport:', (req.session as any)?.passport);
    
    // Use the exact same pattern as addMessageToChat which works
    const userId = (req.session as any)?.passport?.user;

    console.log('[getUserGraphIds] Request received, userId:', userId);
    console.log('[getUserGraphIds] userId type:', typeof userId);

    if (!userId) {
      console.log('[getUserGraphIds] No userId in session, returning 401');
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    console.log('[getUserGraphIds] Querying database with userId:', userId);
    const user = await User.findById(userId);
    
    console.log('[getUserGraphIds] User query result:', user ? 'Found user' : 'User is null');

    if (!user) {
      console.log('[getUserGraphIds] User not found in database for userId:', userId);
      // Try to list all users to debug
      const allUsers = await User.find({}).limit(5).select('_id email');
      console.log('[getUserGraphIds] Sample users in DB:', allUsers.map(u => ({ id: u._id, email: u.email })));
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Extract all unique graph_ids from chats, filtering out empty strings
    const graphIds = [...new Set(
      user.chats
        .map(chat => chat.graph_id)
        .filter(id => id && id.trim() !== '')
    )];

    console.log(`[getUserGraphIds] Found ${graphIds.length} graph IDs for user ${userId}:`, graphIds);
    res.status(200).json({ graphIds });
  } catch (error: any) {
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

/**
 * Rename a chat
 * PATCH /chat/rename/:chat_id
 */
export const renameChat = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req.session as any)?.passport?.user;
    const { chat_id } = req.params;
    const { title } = req.body;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (!chat_id || !title || !title.trim()) {
      res.status(400).json({ message: 'Chat ID is required and title cannot be empty or contain only whitespace' });
      return;
    }

    const user = await User.findById(userId);

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
    await user.save();

    res.status(200).json({ message: 'Chat renamed', chat_id, title: chat.title });
  } catch (error) {
    console.error('Rename chat error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Create a new folder
export const createFolder = async (req: Request, res: Response) => {
  try {
    const rawUserId = (req.session as any)?.passport?.user || req.session?.userId || (req.user as any)?._id;
    
    if (!rawUserId) {
      return res.status(401).json({ message: 'Unauthorized: Session missing user ID' });
    }

    // Extract raw string if Passport serialized an object
    const userId = typeof rawUserId === 'object' && rawUserId._id ? rawUserId._id : rawUserId;

    const { name, parent_folder_id } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Folder name is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.error('[createFolder] User ID in session not found in DB:', userId);
      return res.status(404).json({ message: 'User record not found in database' });
    }

    if (parent_folder_id && !user.folders.some((folder) => folder.folder_id === parent_folder_id)) {
      return res.status(404).json({ message: 'Parent folder not found' });
    }

    const newFolder = {
      folder_id: uuidv4(),
      name: name.trim(),
      date_created: new Date(),
      parent_folder_id: parent_folder_id || null,
    };
    user.folders.push(newFolder);
    await user.save();

    console.log('[createFolder] Folder created successfully:', newFolder);
    return res.status(201).json(newFolder);
  } catch (error) {
    console.error('[createFolder] Internal error:', error);
    return res.status(500).json({ message: 'Error creating folder', error });
  }
};

// Delete a folder and return its chats to the root list
export const deleteFolder = async (req: Request, res: Response) => {
  try {
    const userId = (req.session as any)?.passport?.user || req.session?.userId || (req.user as any)?._id;
    const { folder_id } = req.params;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const folderIndex = user.folders.findIndex((folder) => folder.folder_id === folder_id);
    if (folderIndex === -1) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    const parentFolderId = user.folders[folderIndex].parent_folder_id || null;
    user.folders.splice(folderIndex, 1);
    user.folders.forEach((folder) => {
      if (folder.parent_folder_id === folder_id) {
        folder.parent_folder_id = parentFolderId;
      }
    });
    user.chats.forEach((chat) => {
      if (chat.folder_id === folder_id) {
        chat.folder_id = null;
      }
    });
    user.markModified('folders');
    user.markModified('chats');
    await user.save();

    return res.status(200).json({ message: 'Folder deleted successfully', folder_id });
  } catch (error) {
    console.error('Delete folder error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Move a chat to a folder (or remove from folder if folder_id is null)
export const moveChatToFolder = async (req: Request, res: Response) => {
  try {
    const rawUserId = (req.session as any)?.passport?.user || req.session?.userId || (req.user as any)?._id || (req.user as IUser)?._id;
    const userId = typeof rawUserId === 'object' && rawUserId?._id ? rawUserId._id : rawUserId;
    
    const { chat_id, folder_id } = req.body;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const chat = user.chats.find((c) => c.chat_id === chat_id);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    if (folder_id && !user.folders.some((folder) => folder.folder_id === folder_id)) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    chat.folder_id = folder_id || null;
    await user.save();

    res.status(200).json({ message: 'Chat moved successfully', chat });
  } catch (error) {
    res.status(500).json({ message: 'Error moving chat', error });
  }
};

export const getUserFolders = async (req: Request, res: Response) => {
  try {
    const rawUserId = (req.session as any)?.passport?.user || req.session?.userId || (req.user as any)?._id;
    const userId = typeof rawUserId === 'object' && rawUserId?._id ? rawUserId._id : rawUserId;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const user = await User.findById(userId).select('folders');
    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.status(200).json(user.folders || []);
  } catch (error) {
    console.error('Get folders error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const moveFolder = async (req: Request, res: Response) => {
  try {
    const rawUserId = (req.session as any)?.passport?.user || req.session?.userId || (req.user as any)?._id;
    const userId = typeof rawUserId === 'object' && rawUserId?._id ? rawUserId._id : rawUserId;
    const { folder_id } = req.params;
    const { parent_folder_id } = req.body;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const folder = user.folders.find((item) => item.folder_id === folder_id);
    if (!folder) return res.status(404).json({ message: 'Folder not found' });

    if (parent_folder_id) {
      if (parent_folder_id === folder_id) {
        return res.status(400).json({ message: 'A folder cannot contain itself' });
      }

      const parent = user.folders.find((item) => item.folder_id === parent_folder_id);
      if (!parent) return res.status(404).json({ message: 'Parent folder not found' });

      let ancestorId: string | null | undefined = parent.parent_folder_id;
      while (ancestorId) {
        if (ancestorId === folder_id) {
          return res.status(400).json({ message: 'A folder cannot be moved into its own descendant' });
        }
        ancestorId = user.folders.find((item) => item.folder_id === ancestorId)?.parent_folder_id;
      }
    }

    folder.parent_folder_id = parent_folder_id || null;
    user.markModified('folders');
    await user.save();

    return res.status(200).json(folder);
  } catch (error) {
    console.error('Move folder error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const renameFolder = async (req: Request, res: Response) => {
  try {
    const rawUserId = (req.session as any)?.passport?.user || req.session?.userId || (req.user as any)?._id;
    const userId = typeof rawUserId === 'object' && rawUserId?._id ? rawUserId._id : rawUserId;
    const { folder_id } = req.params;
    const { name } = req.body;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!name || !name.trim()) return res.status(400).json({ message: 'Folder name is required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const folder = user.folders.find((item) => item.folder_id === folder_id);
    if (!folder) return res.status(404).json({ message: 'Folder not found' });

    folder.name = name.trim();
    user.markModified('folders');
    await user.save();

    return res.status(200).json(folder);
  } catch (error) {
    console.error('Rename folder error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};