import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth';
import { Lock, Mail, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import SkipToContent from '../components/common/SkipToContent';
import Logo from '../components/common/Logo';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    const result = await login({ email, password });
    setSubmitting(false);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setErrorMessage(result.message);
    }
  };

  const handleGoogleSuccess = async (credential) => {
    setErrorMessage(null);
    setSubmitting(true);
    const result = await googleLogin(credential);
    setSubmitting(false);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setErrorMessage(result.message);
    }
  };

  return (
    <>
      <SkipToContent targetId="main-content" />
      <div className="min-h-screen bg-[#F7F3EE] flex flex-col justify-between p-6 sm:p-10">
        {/* Header */}
        <header className="max-w-md w-full mx-auto text-center">
          <Link
            to="/"
            aria-label="LuxeCart Home"
            className="inline-block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45] rounded-lg py-1"
          >
            <Logo variant="light" className="h-10 sm:h-12 w-auto mx-auto" priority alt="LuxeCart" />
          </Link>
        </header>

        {/* Main Login Card */}
        <main id="main-content" className="max-w-md w-full mx-auto my-8">
          <div className="bg-[#FFFFFF] border border-[#E7DED5] rounded-2xl p-8 shadow-xs space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-serif font-bold text-[#2A211B]">
                Welcome Back
              </h1>
              <p className="text-sm text-[#6F6963]">
                Sign in to your LuxeCart account
              </p>
            </div>

            {errorMessage && (
              <div
                id="login-error"
                role="alert"
                className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3 text-xs"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
              <div className="space-y-1">
                <label
                  htmlFor="login-email"
                  className="block text-xs font-semibold uppercase tracking-wider text-[#6F6963]"
                >
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6F6963]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="login-email"
                    type="email"
                    required
                    aria-required="true"
                    aria-invalid={!!errorMessage}
                    aria-describedby={errorMessage ? 'login-error' : undefined}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] text-[#171513] text-sm focus:outline-none focus:border-[#9A6A45] focus:bg-[#FFFFFF] focus-visible:ring-2 focus-visible:ring-[#9A6A45] transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#6F6963]"
                  >
                    Password <span className="text-red-500">*</span>
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-[#9A6A45] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45] rounded"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6F6963]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    required
                    aria-required="true"
                    aria-invalid={!!errorMessage}
                    aria-describedby={errorMessage ? 'login-error' : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] text-[#171513] text-sm focus:outline-none focus:border-[#9A6A45] focus:bg-[#FFFFFF] focus-visible:ring-2 focus-visible:ring-[#9A6A45] transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#2A211B] hover:bg-[#9A6A45] text-white text-sm font-semibold transition-all shadow-xs disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45]"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E7DED5]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#FFFFFF] px-3 text-[#6F6963] font-medium tracking-wider">
                  Or continue with
                </span>
              </div>
            </div>

            <GoogleSignInButton
              onSuccess={handleGoogleSuccess}
              onError={(err) => setErrorMessage(err.message || 'Google sign-in failed')}
              disabled={submitting}
              text="signin_with"
            />

            <div className="border-t border-[#E7DED5] pt-6 text-center text-xs text-[#6F6963]">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-semibold text-[#9A6A45] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45] rounded"
              >
                Create Account
              </Link>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="max-w-md w-full mx-auto text-center text-xs text-[#6F6963]">
          &copy; 2026 LuxeCart. All rights reserved.
        </footer>
      </div>
    </>
  );
}
