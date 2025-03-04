import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User';

passport.serializeUser((user: any, done) => {
    done(null, user.id);
}
);

passport.deserializeUser(async (id: string, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch(error) {
        done(error);
    }
}
);

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            callbackURL: 'http://localhost:4000/auth/google/callback',
        },
        async(accessToken, refreshToken, profile, done) => {
            try {
                let user = await User.findOne({email: profile.emails?.[0].value});
                if (!user) {
                    user = await User.create({
                        googleId: profile.id,
                        displayName: profile.displayName,
                        email: profile.emails?.[0].value,
                    });
                }
                return done(null, user);
            } catch(error) {
                return done(error);
            }
        }
    )
);
