import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables before any other imports
const envCandidates = [
    path.resolve(__dirname, '.env'),
    path.resolve(__dirname, '../.env'),
];
const resolvedEnvPath = envCandidates.find((candidate) => fs.existsSync(candidate));
if (resolvedEnvPath) {
    dotenv.config({ path: resolvedEnvPath });
} else {
    dotenv.config();
}

import mongoose from 'mongoose';
import express from 'express';
import passport from 'passport';
import cors from 'cors';
import authRoutes from './auth/routes';
import uploadRoutes from './routes/uploadRoutes';
import graphRoutes from './routes/graphRoutes';
import chatRoutes from './routes/chatRoutes';
import progressRoutes from './routes/progressRoutes';
import quizHistoryRoutes from './routes/quizHistoryRoutes';
import session from 'express-session';
import axios from 'axios';
import User from './models/User';

import './config/passport';

const app = express();
const rawPort = process.env.PORT;
const parsedPort = rawPort ? parseInt(rawPort, 10) : 4000;
const port = Number.isNaN(parsedPort) ? 4000 : parsedPort;
const corsOriginConfig = process.env.CORS_ORIGINS || process.env.CLIENT_URL || 'http://localhost:5173';
const corsOrigins = corsOriginConfig.split(',').map((origin) => origin.trim()).filter(Boolean);

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
    origin: corsOrigins.length <= 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
}));

app.use(express.json());

// Session middleware (before passport middleware)
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Only use secure in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

// Passport serialization (add these if they're not already present)
passport.serializeUser((user: any, done) => {
    done(null, user._id);
});

passport.deserializeUser(async (id: string, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

// Auth routes
app.use('/auth', authRoutes);

// Upload routes
app.use('/upload', uploadRoutes);

// Graph routes
app.use('/api', graphRoutes);

//Chat Routes
app.use('/chat', chatRoutes);

//Progress Routes (mounted at /api to match existing endpoint usage)
app.use('/api', progressRoutes);

// Quiz History Routes
app.use('/api/quiz-history', quizHistoryRoutes);

app.get('/', (req, res) => {
    res.send('API is running');
  });

// New route: Calls the Flask server and returns its response
app.get('/flask/hi', async (req, res) => {
    try {
        // Call the Flask server on port 5000 (make sure Flask is running)
        const flaskResponse = await axios.get('http://localhost:5000/');
        // Return the HTML/template response from Flask
        res.send(flaskResponse.data);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error calling Flask server');
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
