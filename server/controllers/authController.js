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
exports.logout = exports.checkAuth = exports.googleAuthCallback = exports.login = exports.signup = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const User_1 = __importDefault(require("../models/User"));
require("express-session");
const validatePassword = (password) => {
    if (password.length < 8) {
        return { isValid: false, error: 'Password must be at least 8 characters long' };
    }
    if (password.length > 32) {
        return { isValid: false, error: 'Password cannot be longer than 32 characters' };
    }
    if (!/[A-Z]/.test(password)) {
        return { isValid: false, error: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
        return { isValid: false, error: 'Password must contain at least one lowercase letter' };
    }
    if (!/\d/.test(password)) {
        return { isValid: false, error: 'Password must contain at least one number' };
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        return { isValid: false, error: 'Password must contain at least one special character' };
    }
    return { isValid: true, error: '' };
};
/**
 * LOCAL AUTH: SIGNUP (no JWT)
 */
const signup = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password, name } = req.body;
        console.log('Received signup request:', { email, name, }); // Log incoming request
        // Validate password
        const { isValid, error } = validatePassword(password);
        if (!isValid) {
            return res.status(400).json({ message: error });
        }
        const existingUser = yield User_1.default.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }
        const hashedPassword = yield bcrypt_1.default.hash(password, 10);
        const userData = {
            email,
            password: hashedPassword,
            displayName: name,
            chats: [],
        };
        const newUser = (yield User_1.default.create(userData));
        console.log('User created successfully:', newUser._id); // Log successful user creation
        // Set up the session with proper typing
        req.session.userId = newUser._id.toString();
        console.log('Session established:', req.session.userId); // Log session creation
        // Login the user using passport
        req.login(newUser, (err) => {
            if (err) {
                console.error('Error establishing session on signup:', err);
                return res.status(500).json({ message: 'Failed to establish session' });
            }
            console.log('Login successful, sending response'); // Log before sending response
            // Return user data
            res.status(201).json({
                message: 'Signup successful',
                user: {
                    id: newUser._id,
                    email: newUser.email,
                    displayName: newUser.displayName,
                    chats: newUser.chats,
                },
            });
        });
    }
    catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
exports.signup = signup;
/**
 * LOCAL AUTH: LOGIN (no JWT)
 */
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        const user = yield User_1.default.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        const isMatch = yield bcrypt_1.default.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        // Set the session userId
        req.session.userId = user._id.toString();
        // Explicitly save the session before proceeding
        req.session.save((saveErr) => {
            if (saveErr) {
                console.error('Session save error:', saveErr);
                return res.status(500).json({ message: 'Failed to save session' });
            }
            // Now proceed with login
            req.login(user, (loginErr) => {
                if (loginErr) {
                    console.error('Error establishing session on login:', loginErr);
                    return res.status(500).json({ message: 'Failed to establish session' });
                }
                console.log('Session established on login:', req.session.userId);
                return res.status(200).json({
                    message: 'Login successful',
                    user: {
                        _id: user._id,
                        email: user.email,
                        displayName: user.displayName,
                        chats: user.chats,
                    },
                });
            });
        });
    }
    catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});
exports.login = login;
/**
 * GOOGLE AUTH CALLBACK
 * This runs AFTER Passport successfully authenticates with Google.
 * Redirect the user to your frontend app.
 */
const googleAuthCallback = (res) => {
    return res.redirect('http://localhost:5173');
};
exports.googleAuthCallback = googleAuthCallback;
const checkAuth = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (req.isAuthenticated() && req.user) {
            const user = req.user;
            res.json({
                authenticated: true,
                user: {
                    email: user.email,
                    displayName: user.displayName,
                }
            });
        }
        else {
            res.status(401).json({ authenticated: false });
        }
    }
    catch (error) {
        console.error('Check auth error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
exports.checkAuth = checkAuth;
const logout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    req.logout((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ message: 'Error logging out' });
        }
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destruction error:', err);
                return res.status(500).json({ message: 'Error destroying session' });
            }
            res.clearCookie('connect.sid'); // Clear the session cookie
            res.json({ message: 'Logged out successfully' });
        });
    });
});
exports.logout = logout;
