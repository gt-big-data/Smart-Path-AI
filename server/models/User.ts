import mongoose, { Document } from 'mongoose';

export interface IUser extends Document {
    email: string;
    password?: string;
    name?: string;
    displayName?: string;
    googleId?: string;
}

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String },
    name: { type: String },
    displayName: { type: String },
    googleId: { type: String }
});

export default mongoose.model<IUser>('User', userSchema);