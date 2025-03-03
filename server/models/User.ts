import mongoose, { Schema, Document, Model } from 'mongoose';

interface IUser extends Document {
    email?: string;
    googleId?: string;
    displayName?: string;
    password?: string;
}

const userSchema = new Schema<IUser>(
    {
        email: { type: String, unique: true, required: true, index: true },
        googleId: { type: String, unique: true, sparse: true, partialFilterExpression: { googleId: { $exists: true, $ne: null } } },
        displayName: String,
        password: String,
    }
);


const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
export default User;