import { Router, Request, Response, RequestHandler } from 'express';
import { beginGoogleLogin, completeGoogleLogin } from './googleLogin';
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

router.get('/google', beginGoogleLogin);
router.get('/google/callback', completeGoogleLogin);

router.get('/me', (req: Request, res: Response) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
        res.json({ user: req.user });
    } else {
        res.status(401).json({ error: 'Not logged in' });
    }
});


export default router;
