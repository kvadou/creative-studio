import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { config } from '../../lib/config.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

if (config.googleClientId && config.googleClientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.googleClientId,
        clientSecret: config.googleClientSecret,
        callbackURL: config.googleCallbackUrl,
        scope: ['openid', 'email', 'profile'],
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done: (error: Error | null, user?: AuthUser | false) => void
      ) => {
        try {
          const email = profile.emails?.[0]?.value;

          if (!email) {
            return done(null, false);
          }

          const domain = email.split('@')[1];
          if (config.allowedEmailDomains.length > 0 && !config.allowedEmailDomains.includes(domain)) {
            return done(null, false);
          }

          const user: AuthUser = {
            id: profile.id,
            email,
            name: profile.displayName,
            picture: profile.photos?.[0]?.value,
          };

          return done(null, user);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );
} else {
  console.warn('Google OAuth not configured — GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required');
}

export default passport;
