// server/controllers/authController.ts
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/User';

/**
 * LOCAL AUTH: SIGNUP (no JWT)
 */
export const signup = async (req: Request, res: Response) => {
    try {
        const { email, password, name} = req.body;
        console.log('Signup request body:', req.body);
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            console.log('User already exists:', email);
            res.status(400).json({ error: 'User already exists' });
            return;
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const userData : any = {
            email,
            password: hashedPassword,
            displayName: name,
        }
        if (req.body.googleId) {
            userData.googleId = req.body.googleId;
        }
        const newUser = await User.create(userData);
        req.login(newUser, (err) => {
            if (err) {
                console.error('Error establishing session on signup:', err);
                res.status(500).json({ error: 'Failed to establish session' });
                return;
            }
        res.status(201).json({
            message: 'Signup successful',
            user: {
                id: newUser._id,
                email: newUser.email,
                displayName: newUser.displayName,
            },
        });
        }
        );
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * LOCAL AUTH: LOGIN (no JWT)
 */
export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }
        const isMatch = await bcrypt.compare(password, user.password!);
        if (!isMatch) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }
        req.login(user, (err) => {
            if (err) {
                console.error(err);
                res.status(500).json({error: 'Login failed'});
                return;
            }
            res.status(200).json({
                message: 'Login successful',
                user: {
                    _id: user._id,
                    email: user.email,
                    displayName: user.displayName,
                },
            });
        }
        );
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * GOOGLE AUTH CALLBACK
 * This runs AFTER Passport successfully authenticates with Google.
 * Redirect the user to your frontend app.
 */
export const googleAuthCallback = (res: Response) => {
    return res.redirect('http://localhost:5173');
};
