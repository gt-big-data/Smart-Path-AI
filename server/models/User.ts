import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage {
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export interface IChat {
  chat_id: string;
  date_created: Date;
  graph_id: string;
  messages: IMessage[];
}

export interface IUser extends Document {
  email?: string;
  password?: string;
  name?: string;
  displayName?: string;
  googleId?: string;
  chats: IChat[];
}

const messageSchema = new mongoose.Schema<IMessage>({
  sender: { type: String, enum: ['user', 'ai'], required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const chatSchema = new mongoose.Schema<IChat>({
  chat_id: { type: String, required: true },
  date_created: { type: Date, default: Date.now },
  graph_id: { type: String, default: ''},
  messages: [messageSchema],
});

const userSchema = new mongoose.Schema<IUser>({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  name: { type: String },
  displayName: { type: String },
  googleId: { type: String },
  chats: [chatSchema],   // <-- new chats field
});

export default mongoose.model<IUser>('User', userSchema);
