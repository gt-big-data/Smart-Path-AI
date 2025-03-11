import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import User, { IUser } from '../models/User';
import { Types, Document as MongooseDocument } from 'mongoose';

// Extend the session type to include userId
declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

const validatePassword = (password: string): { isValid: boolean; error: string } => {
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
export const signup = async (req: Request, res: Response) => {
    try {
        const { email, password, name } = req.body;
        console.log('Received signup request:', { email, name }); // Log incoming request

        // Validate password
        const { isValid, error } = validatePassword(password);
        if (!isValid) {
            return res.status(400).json({ message: error });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const userData = {
            email,
            password: hashedPassword,
            displayName: name,
        };

        const newUser = (await User.create(userData)) as unknown as MongooseDocument<Types.ObjectId> & IUser;
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
                },
            });
        }); 
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Internal server error' });
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
            res.status(401).json({ message: 'Invalid email or password' });
            return;
        }
        const isMatch = await bcrypt.compare(password, user.password!);
        if (!isMatch) {
            res.status(401).json({ message: 'Invalid email or password' });
            return;
        }
        req.login(user, (err) => {
                if (err) {
                    console.error('Error establishing session on signup:', err);
                    res.status(500).json({ message: 'Failed to establish session' });
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
        res.status(500).json({ message: 'Internal server error' });
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

export const checkAuth = async (req: Request, res: Response) => {
    try {
        if (req.isAuthenticated() && req.user) {
            const user = req.user as any;
            res.json({ 
                authenticated: true,
                user: {
                    email: user.email,
                    displayName: user.displayName,
                }
            });
        } else {
            res.status(401).json({ authenticated: false });
        }
    } catch (error) {
        console.error('Check auth error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const logout = async (req: Request, res: Response) => {
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
};