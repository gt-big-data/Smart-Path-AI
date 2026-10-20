"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeGoogleLogin = exports.beginGoogleLogin = void 0;
const crypto_1 = require("crypto");
const passport_1 = __importDefault(require("passport"));
function allowedDestination(value) {
    if (typeof value !== 'string')
        return undefined;
    try {
        const url = new URL(value);
        // Accept complete HTTP(S) origins only, never paths or embedded credentials.
        if (!['http:', 'https:'].includes(url.protocol) || value !== url.origin)
            return undefined;
        const origins = (process.env.AUTH_ALLOWED_ORIGINS || process.env.CLIENT_URL || 'http://localhost:5173')
            .split(',').map(origin => origin.trim()).filter(Boolean);
        return origins.includes(url.origin) ? url.origin : undefined;
    }
    catch (_a) {
        return undefined;
    }
}
const beginGoogleLogin = (req, res, next) => {
    const returnTo = allowedDestination(req.query.returnTo === undefined
        ? process.env.CLIENT_URL || 'http://localhost:5173'
        : req.query.returnTo);
    if (!returnTo) {
        res.status(400).send('Invalid login return destination.');
        return;
    }
    const state = (0, crypto_1.randomBytes)(32).toString('hex');
    req.session.googleLogin = { state, returnTo, expiresAt: Date.now() + 10 * 60 * 1000 };
    req.session.save(error => {
        if (error)
            return next(error);
        passport_1.default.authenticate('google', {
            scope: ['profile', 'email'],
            prompt: 'select_account',
            state,
        })(req, res, next);
    });
};
exports.beginGoogleLogin = beginGoogleLogin;
const completeGoogleLogin = (req, res, next) => {
    const attempt = req.session.googleLogin;
    const state = req.query.state;
    // Validate here, before Passport handles either a code or Google's error response.
    // This also prevents a callback with neither code nor error from restarting login.
    if (!attempt || typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state)
        || !(0, crypto_1.timingSafeEqual)(Buffer.from(state), Buffer.from(attempt.state))
        || attempt.expiresAt <= Date.now() || !allowedDestination(attempt.returnTo)) {
        res.status(400).send('Invalid or expired Google login. Please start login again.');
        return;
    }
    // Capture the destination before Passport regenerates the session on login.
    const returnTo = attempt.returnTo;
    const failureUrl = new URL('/login', returnTo);
    failureUrl.searchParams.set('error', 'google_login_failed');
    delete req.session.googleLogin;
    req.session.save(error => {
        if (error)
            return next(error);
        if (req.query.error || typeof req.query.code !== 'string' || !req.query.code) {
            res.redirect(failureUrl.toString());
            return;
        }
        // State has already been verified and consumed above; never trust callback returnTo.
        passport_1.default.authenticate('google', (authError, user) => {
            if (authError || !user) {
                res.redirect(failureUrl.toString());
                return;
            }
            req.logIn(user, loginError => {
                if (loginError)
                    return next(loginError);
                // Passport saves the regenerated session before calling this callback.
                res.redirect(returnTo);
            });
        })(req, res, next);
    });
};
exports.completeGoogleLogin = completeGoogleLogin;
