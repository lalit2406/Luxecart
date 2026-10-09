import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, RefreshCw, KeyRound } from 'lucide-react';
import SkipToContent from '../components/common/SkipToContent';
import Logo from '../components/common/Logo';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const { resetPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!token) {
      setErrorMessage('Missing password reset token. Please request a new reset link.');
      return;
    }

    if (!password || password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    setSubmitting(true);
    const result = await resetPassword({ token, password });
    setSubmitting(false);

    if (result.success) {
      setSubmitted(true);
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

        {/* Main Card */}
        <main id="main-content" className="max-w-md w-full mx-auto my-8">
          <div className="bg-[#FFFFFF] border border-[#E7DED5] rounded-2xl p-8 shadow-xs space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-[#2A211B] text-[#E7DED5] rounded-full flex items-center justify-center mx-auto mb-2">
                <KeyRound className="w-6 h-6 text-[#9A6A45]" />
              </div>
              <h1 className="text-2xl font-serif font-bold text-[#2A211B]">
                Reset your password
              </h1>
              <p className="text-sm text-[#6F6963]">
                Enter a new secure password for your LuxeCart account.
              </p>
            </div>

            {errorMessage && (
              <div
                id="reset-error"
                role="alert"
                className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex flex-col gap-2 text-xs"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
                {(errorMessage.toLowerCase().includes('expired') || errorMessage.toLowerCase().includes('invalid')) && (
                  <div className="pt-1 pl-6.5">
                    <Link
                      to="/forgot-password"
                      className="font-semibold text-[#9A6A45] hover:underline"
                    >
                      Request a new password reset link &rarr;
                    </Link>
                  </div>
                )}
              </div>
            )}

            {submitted ? (
              <div
                role="status"
                aria-live="polite"
                className="p-6 rounded-xl bg-[#F7F3EE] border border-[#E7DED5] text-center space-y-4"
              >
                <div className="w-12 h-12 bg-emerald-700 text-white rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-base font-serif font-bold text-[#2A211B]">
                    Password updated
                  </h2>
                  <p className="text-xs text-[#6F6963] leading-relaxed">
                    Your password has been successfully reset. You can now sign in with your new credentials.
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-[#2A211B] hover:bg-[#9A6A45] text-white text-xs font-semibold transition-colors"
                  >
                    <span>Proceed to Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
                <div className="space-y-1">
                  <label
                    htmlFor="reset-new-password"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#6F6963]"
                  >
                    New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6F6963]">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="reset-new-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      aria-required="true"
                      aria-invalid={!!errorMessage}
                      aria-describedby={errorMessage ? 'reset-error' : undefined}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] text-[#171513] text-sm focus:outline-none focus:border-[#9A6A45] focus:bg-[#FFFFFF] focus-visible:ring-2 focus-visible:ring-[#9A6A45] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#6F6963] hover:text-[#2A211B] focus:outline-none cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="reset-confirm-password"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#6F6963]"
                  >
                    Confirm New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6F6963]">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="reset-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      aria-required="true"
                      aria-invalid={!!errorMessage}
                      aria-describedby={errorMessage ? 'reset-error' : undefined}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] text-[#171513] text-sm focus:outline-none focus:border-[#9A6A45] focus:bg-[#FFFFFF] focus-visible:ring-2 focus-visible:ring-[#9A6A45] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#6F6963] hover:text-[#2A211B] focus:outline-none cursor-pointer"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
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
                      <span>Updating password...</span>
                    </>
                  ) : (
                    <>
                      <span>Reset Password</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="border-t border-[#E7DED5] pt-6 text-center text-xs text-[#6F6963]">
              <Link
                to="/login"
                className="font-semibold text-[#9A6A45] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45] rounded"
              >
                &larr; Back to Sign In
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
