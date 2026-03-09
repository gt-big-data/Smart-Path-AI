import { Router, Request, Response, RequestHandler } from 'express';
import passport from 'passport';
import { signup, login, checkAuth, logout } from '../controllers/authController';
import axios from 'axios';

const router = Router();

router.post('/signup', signup as RequestHandler);
router.post('/login', login as RequestHandler);
router.get('/check-auth', checkAuth);
router.post('/logout', logout);

router.get('/flask/hi', async (req, res) => {
    try {
        const flaskResponse = await axios.get('http://localhost:5000/');
        res.send(flaskResponse.data);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error calling Flask server');
    }
});

// Google OAuth endpoints, etc...
router.get(
    '/google',
    passport.authenticate('google', {

        //failureRedirect: 'http://localhost:5173/login', // or wherever you want users to land on failure
        scope: ['profile', 'email'], // what data you want from the user
        prompt: 'select_account',    // optional: always prompt user to pick account
    })
);

// 2. Google OAuth callback
//    Google redirects here after the user grants permission
router.get('/google/callback',
    passport.authenticate('google', { failureMessage: true }),
    (req:Request, res: Response) => {
        res.redirect(process.env.CLIENT_URL || 'http://localhost:5173');
    }
);

router.get('/me', (req: Request, res: Response) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
        res.json({ user: req.user });
    } else {
        res.status(401).json({ error: 'Not logged in' });
    }
});


export default router;
