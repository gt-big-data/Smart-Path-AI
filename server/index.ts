import dotenv from 'dotenv';
import mongoose from 'mongoose';
import express from 'express';
import passport from 'passport';
import cors from 'cors';
import authRoutes from './auth/routes';
import session from 'express-session';
dotenv.config();

import './config/passport';

const app = express();

// Connect to Mongo
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI!);
        console.log('MongoDB connected');
    } catch (err) {
        console.error('Could not connect to MongoDB', err);
        process.exit(1);
    }
};
connectDB();

// CORS
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}));

app.use(express.json());

// Add express-session middleware BEFORE initializing Passport sessions
app.use(session({
    secret: process.env.SESSION_SECRET || 'mysecret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Initialize Passport and use Passport sessions
app.use(passport.initialize());
app.use(passport.session());

// Auth routes
app.use('/auth', authRoutes);

// Start server
app.listen(4000, () => {
    console.log('Server running on http://localhost:4000');
});
