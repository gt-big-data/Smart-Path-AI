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
        failureRedirect: 'http://localhost:5173/login',
        scope: ['profile', 'email'],
        prompt: 'select_account'
    })
);

router.get(
    '/google/callback',
    passport.authenticate('google', {
        failureRedirect: 'http://localhost:5173/login',
    }),
    (req: Request, res: Response) => {
        res.redirect('http://localhost:5173');
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
