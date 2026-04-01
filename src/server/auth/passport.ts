import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { config } from '../../lib/config.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

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

        // Domain restriction removed for portfolio demo — any Google account can sign in.
        // To restrict access, set ALLOWED_EMAIL_DOMAINS in .env (comma-separated).
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

export default passport;
