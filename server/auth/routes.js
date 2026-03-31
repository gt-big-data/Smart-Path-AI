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
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const authController_1 = require("../controllers/authController");
const axios_1 = __importDefault(require("axios"));
const router = (0, express_1.Router)();
router.post('/signup', authController_1.signup);
router.post('/login', authController_1.login);
router.get('/check-auth', authController_1.checkAuth);
router.post('/logout', authController_1.logout);
router.get('/flask/hi', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const flaskResponse = yield axios_1.default.get('http://localhost:5000/');
        res.send(flaskResponse.data);
    }
    catch (error) {
        console.error(error);
        res.status(500).send('Error calling Flask server');
    }
}));
// Google OAuth endpoints, etc...
router.get('/google', passport_1.default.authenticate('google', {
    //failureRedirect: 'http://localhost:5173/login', // or wherever you want users to land on failure
    scope: ['profile', 'email'], // what data you want from the user
    prompt: 'select_account', // optional: always prompt user to pick account
}));
// 2. Google OAuth callback
//    Google redirects here after the user grants permission
router.get('/google/callback', passport_1.default.authenticate('google', { failureMessage: true }), (req, res) => {
    res.redirect(process.env.CLIENT_URL || 'http://localhost:5173');
});
router.get('/me', (req, res) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
        res.json({ user: req.user });
    }
    else {
        res.status(401).json({ error: 'Not logged in' });
    }
});
exports.default = router;
