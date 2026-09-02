import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth';
import { User, Mail, Lock, Phone, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import SkipToContent from '../components/common/SkipToContent';
import Logo from '../components/common/Logo';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name || !email || !password) {
      setErrorMessage('Please fill in all required fields');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long');
      return;
    }

    setSubmitting(true);
    const result = await register({
      name,
      email,
      password,
      phone: phone.trim() ? phone.trim() : undefined,
    });
    setSubmitting(false);

    if (result.success) {
      navigate('/', { replace: true });
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

        {/* Main Register Card */}
        <main id="main-content" className="max-w-md w-full mx-auto my-8">
          <div className="bg-[#FFFFFF] border border-[#E7DED5] rounded-2xl p-8 shadow-xs space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-serif font-bold text-[#2A211B]">
                Create an Account
              </h1>
              <p className="text-sm text-[#6F6963]">
                Join LuxeCart for a curated fashion experience
              </p>
            </div>

            {errorMessage && (
              <div
                id="register-error"
                role="alert"
                className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3 text-xs"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label
                  htmlFor="register-name"
                  className="block text-xs font-semibold uppercase tracking-wider text-[#6F6963]"
                >
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6F6963]">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="register-name"
                    type="text"
                    required
                    aria-required="true"
                    aria-invalid={!!errorMessage}
                    aria-describedby={errorMessage ? 'register-error' : undefined}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] text-[#171513] text-sm focus:outline-none focus:border-[#9A6A45] focus:bg-[#FFFFFF] focus-visible:ring-2 focus-visible:ring-[#9A6A45] transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="register-email"
                  className="block text-xs font-semibold uppercase tracking-wider text-[#6F6963]"
                >
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6F6963]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="register-email"
                    type="email"
                    required
                    aria-required="true"
                    aria-invalid={!!errorMessage}
                    aria-describedby={errorMessage ? 'register-error' : undefined}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] text-[#171513] text-sm focus:outline-none focus:border-[#9A6A45] focus:bg-[#FFFFFF] focus-visible:ring-2 focus-visible:ring-[#9A6A45] transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="register-password"
                  className="block text-xs font-semibold uppercase tracking-wider text-[#6F6963]"
                >
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6F6963]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="register-password"
                    type="password"
                    required
                    aria-required="true"
                    aria-invalid={!!errorMessage}
                    aria-describedby={errorMessage ? 'register-error' : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] text-[#171513] text-sm focus:outline-none focus:border-[#9A6A45] focus:bg-[#FFFFFF] focus-visible:ring-2 focus-visible:ring-[#9A6A45] transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="register-phone"
                  className="block text-xs font-semibold uppercase tracking-wider text-[#6F6963]"
                >
                  Mobile Number (Optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#6F6963]">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    id="register-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] text-[#171513] text-sm focus:outline-none focus:border-[#9A6A45] focus:bg-[#FFFFFF] focus-visible:ring-2 focus-visible:ring-[#9A6A45] transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] transition-colors text-sm font-medium disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45]"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="text-center pt-2 border-t border-[#E7DED5]">
              <p className="text-xs text-[#6F6963]">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="font-semibold text-[#9A6A45] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45] rounded"
                >
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="text-center text-xs text-[#6F6963]">
          <p>LuxeCart &copy; 2026. Single-Vendor Fashion & Lifestyle.</p>
        </footer>
      </div>
    </>
  );
}
