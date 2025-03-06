import { Router, Request, Response } from 'express';
import passport from 'passport';
import { signup, login } from '../controllers/authController';
import axios from 'axios';

const router = Router();

router.post('/signup', signup); // calls a controller method to create a user in DB
router.post('/login', login);   // calls a controller method to verify credentials



router.get('/flask/hi', async (req, res) => {
    try {
      // Call Flask on port 5000
      const flaskResponse = await axios.get('http://localhost:5000/');
      // Forward the response ("hi") back to the client
      res.send(flaskResponse.data);
    } catch (error) {
      console.error(error);
      res.status(500).send('Error calling Flask server');
    }
  });

/**
 * Google OAuth endpoints using Passport
 */

// 1. Start Google OAuth flow
//    This route redirects the user to Google's auth consent screen
router.get('/google',
    passport.authenticate('google', {
        failureRedirect: 'http://localhost:5173/login', // or wherever you want users to land on failure
        scope: ['profile', 'email'], // what data you want from the user
        prompt: 'select_account',    // optional: always prompt user to pick account
    })
);

// 2. Google OAuth callback
//    Google redirects here after the user grants permission
router.get('/google/callback',
    passport.authenticate('google', {
        failureRedirect: '/login',   // or wherever you want users to land on failure
    }),
    (req:Request, res: Response) => {
        res.redirect('http://localhost:5173');
    }
);

router.get('/me', (req: Request, res: Response):void => {
    if (req.isAuthenticated && req.isAuthenticated()) {
        res.json({ user: req.user });
    } else {
        res.status(401).json({ error: 'Not logged in' });
    }
});

export default router;
