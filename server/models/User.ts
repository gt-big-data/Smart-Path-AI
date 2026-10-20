import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage {
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export interface IChat {
  chat_id: string;
  title: string;
  date_created: Date;
  graph_id: string;
  folder_id?: string | null;
  messages: IMessage[];
}

export interface IFolder {
  folder_id: string;
  name: string;
  date_created: Date;
  parent_folder_id?: string | null;
}

export interface IUser extends Document {
  email?: string;
  password?: string;
  name?: string;
  displayName?: string;
  googleId?: string;
  folders: IFolder[];
  chats: IChat[];
}

const messageSchema = new mongoose.Schema<IMessage>({
  sender: { type: String, enum: ['user', 'ai'], required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const folderSchema = new mongoose.Schema<IFolder>({
  folder_id: { type: String, required: true },
  name: { type: String, required: true },
  date_created: { type: Date, default: Date.now },
  parent_folder_id: { type: String, default: null },
});

const chatSchema = new mongoose.Schema<IChat>({
  chat_id: { type: String, required: true },
  title: { type: String, default: 'New Chat' },
  date_created: { type: Date, default: Date.now },
  graph_id: { type: String, default: ''},
  folder_id: { type: String, default: null },
  messages: [messageSchema],
});

const userSchema = new mongoose.Schema<IUser>({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  name: { type: String },
  displayName: { type: String },
  googleId: { type: String },
  folders: [folderSchema],
  chats: [chatSchema],
});

export default mongoose.model<IUser>('User', userSchema);
