import { NoSymbolIcon } from '@heroicons/react/24/outline';
import { loginWithGoogle } from '../lib/auth';

export function Unauthorized() {
  return (
    <div className="min-h-screen bg-stc-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <img
          src="/logo.png"
          alt="Acme Creative"
          className="h-16 mx-auto mb-6"
        />

        {/* Error card */}
        <div className="bg-white rounded-2xl shadow-card p-8">
          <div className="w-16 h-16 bg-stc-pink/15 rounded-full flex items-center justify-center mx-auto mb-4">
            <NoSymbolIcon className="w-8 h-8 text-stc-pink" />
          </div>

          <h1 className="text-xl font-bold text-neutral-900 mb-2">
            Access Denied
          </h1>
          <p className="text-neutral-600 mb-6">
            Your account is not authorized to access this application. Only
            @acmecreative.com accounts are allowed.
          </p>

          <button
            onClick={loginWithGoogle}
            className="w-full bg-stc-purple-500 text-white rounded-xl px-4 py-3 font-medium hover:bg-stc-purple-600 transition-colors min-h-[48px]"
          >
            Try a different account
          </button>
        </div>
      </div>
    </div>
  );
}
