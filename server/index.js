"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Load environment variables before any other imports
const envCandidates = [
    path_1.default.resolve(__dirname, '.env'),
    path_1.default.resolve(__dirname, '../.env'),
];
const resolvedEnvPath = envCandidates.find((candidate) => fs_1.default.existsSync(candidate));
if (resolvedEnvPath) {
    dotenv_1.default.config({ path: resolvedEnvPath });
}
else {
    dotenv_1.default.config();
}
const mongoose_1 = __importDefault(require("mongoose"));
const express_1 = __importDefault(require("express"));
const passport_1 = __importDefault(require("passport"));
const cors_1 = __importDefault(require("cors"));
const routes_1 = __importDefault(require("./auth/routes"));
const uploadRoutes_1 = __importDefault(require("./routes/uploadRoutes"));
const graphRoutes_1 = __importDefault(require("./routes/graphRoutes"));
const chatRoutes_1 = __importDefault(require("./routes/chatRoutes"));
const progressRoutes_1 = __importDefault(require("./routes/progressRoutes"));
const quizHistoryRoutes_1 = __importDefault(require("./routes/quizHistoryRoutes"));
const express_session_1 = __importDefault(require("express-session"));
const connect_mongo_1 = __importDefault(require("connect-mongo"));
const axios_1 = __importDefault(require("axios"));
const User_1 = __importDefault(require("./models/User"));
require("./config/passport");
const app = (0, express_1.default)();
const rawPort = process.env.PORT;
const parsedPort = rawPort ? parseInt(rawPort, 10) : 4000;
const port = Number.isNaN(parsedPort) ? 4000 : parsedPort;
const corsOriginConfig = process.env.CORS_ORIGINS || process.env.CLIENT_URL || 'http://localhost:5173';
const corsOrigins = corsOriginConfig.split(',').map((origin) => origin.trim()).filter(Boolean);
const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.K_SERVICE);
// Connect to Mongo
const connectDB = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield mongoose_1.default.connect(process.env.MONGO_URI);
        console.log('MongoDB connected');
    }
    catch (err) {
        console.error('Could not connect to MongoDB', err);
        process.exit(1);
    }
});
connectDB();
// CORS
app.use((0, cors_1.default)({
    origin: corsOrigins.length <= 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
}));
app.use(express_1.default.json());
// Session middleware (before passport middleware)
app.set('trust proxy', 1);
app.use((0, express_session_1.default)({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    proxy: isProduction,
    resave: false,
    saveUninitialized: false,
    store: connect_mongo_1.default.create({
        mongoUrl: process.env.MONGO_URI,
        collectionName: 'sessions',
        ttl: 14 * 24 * 60 * 60,
    }),
    cookie: {
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));
// Initialize passport and restore authentication state from session
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
// Passport serialization (add these if they're not already present)
passport_1.default.serializeUser((user, done) => {
    done(null, user._id);
});
passport_1.default.deserializeUser((id, done) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield User_1.default.findById(id);
        done(null, user);
    }
    catch (err) {
        done(err);
    }
}));
// Auth routes
app.use('/auth', routes_1.default);
// Upload routes
app.use('/upload', uploadRoutes_1.default);
// Graph routes
app.use('/api', graphRoutes_1.default);
//Chat Routes
app.use('/chat', chatRoutes_1.default);
//Progress Routes (mounted at /api to match existing endpoint usage)
app.use('/api', progressRoutes_1.default);
// Quiz History Routes
app.use('/api/quiz-history', quizHistoryRoutes_1.default);
app.get('/', (req, res) => {
    res.send('API is running');
});
// New route: Calls the Flask server and returns its response
app.get('/flask/hi', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Call the Flask server on port 5000 (make sure Flask is running)
        const flaskResponse = yield axios_1.default.get('http://localhost:5000/');
        // Return the HTML/template response from Flask
        res.send(flaskResponse.data);
    }
    catch (error) {
        console.error(error);
        res.status(500).send('Error calling Flask server');
    }
}));
// Start server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
