import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth';
import { Mail, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import SkipToContent from '../components/common/SkipToContent';
import Logo from '../components/common/Logo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const { forgotPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !email.trim()) {
      setErrorMessage('Please enter your email address');
      return;
    }

    setSubmitting(true);
    const result = await forgotPassword(email.trim().toLowerCase());
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
              <h1 className="text-2xl font-serif font-bold text-[#2A211B]">
                Forgot your password?
              </h1>
              <p className="text-sm text-[#6F6963]">
                Enter the email address associated with your LuxeCart account.
              </p>
            </div>

            {errorMessage && (
              <div
                id="forgot-error"
                role="alert"
                className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3 text-xs"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {submitted ? (
              <div
                role="status"
                aria-live="polite"
                className="p-6 rounded-xl bg-[#F7F3EE] border border-[#E7DED5] text-center space-y-4"
              >
                <div className="w-12 h-12 bg-[#2A211B] text-[#E7DED5] rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6 text-[#9A6A45]" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-base font-serif font-bold text-[#2A211B]">
                    Check your email
                  </h2>
                  <p className="text-xs text-[#6F6963] leading-relaxed">
                    If an account exists for <span className="font-semibold text-[#2A211B]">{email}</span>, we have sent a password reset link. The link will expire in 30 minutes.
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-[#2A211B] hover:bg-[#9A6A45] text-white text-xs font-semibold transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Return to Sign In</span>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
                <div className="space-y-1">
                  <label
                    htmlFor="forgot-email"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#6F6963]"
                  >
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6F6963]">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id="forgot-email"
                      type="email"
                      required
                      aria-required="true"
                      aria-invalid={!!errorMessage}
                      aria-describedby={errorMessage ? 'forgot-error' : undefined}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
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
                      <span>Sending reset link...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Reset Link</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="border-t border-[#E7DED5] pt-6 text-center text-xs text-[#6F6963]">
              Remember your password?{' '}
              <Link
                to="/login"
                className="font-semibold text-[#9A6A45] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45] rounded"
              >
                Sign In
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
