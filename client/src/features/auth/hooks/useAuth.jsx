import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/authApi';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check current session from HTTP-only cookie
  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authApi.getCurrentUser();
      if (res?.data?.user) {
        setUser(res.data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Login handler
  const login = async (credentials) => {
    setError(null);
    try {
      const res = await authApi.login(credentials);
      if (res?.data?.user) {
        setUser(res.data.user);
        return { success: true, user: res.data.user };
      }
      return { success: false, message: 'Invalid response from server' };
    } catch (err) {
      const msg = err.message || 'Login failed';
      setError(msg);
      return { success: false, message: msg };
    }
  };

  // Register handler
  const register = async (data) => {
    setError(null);
    try {
      const res = await authApi.register(data);
      if (res?.data?.user) {
        setUser(res.data.user);
        return { success: true, user: res.data.user };
      }
      return { success: false, message: 'Invalid response from server' };
    } catch (err) {
      const msg = err.message || 'Registration failed';
      setError(msg);
      return { success: false, message: msg };
    }
  };

  // Google OAuth Login handler
  const googleLogin = async (credential) => {
    setError(null);
    try {
      const res = await authApi.googleLogin(credential);
      if (res?.data?.user) {
        setUser(res.data.user);
        return { success: true, user: res.data.user };
      }
      return { success: false, message: 'Invalid response from server' };
    } catch (err) {
      const msg = err.message || 'Google authentication failed';
      setError(msg);
      return { success: false, message: msg };
    }
  };

  // Forgot password handler
  const forgotPassword = async (email) => {
    setError(null);
    try {
      const res = await authApi.forgotPassword(email);
      return { success: true, message: res?.message || 'Password reset link sent.' };
    } catch (err) {
      const msg = err.message || 'Failed to request password reset';
      setError(msg);
      return { success: false, message: msg };
    }
  };

  // Reset password handler
  const resetPassword = async ({ token, password }) => {
    setError(null);
    try {
      const res = await authApi.resetPassword({ token, password });
      return { success: true, message: res?.message || 'Password reset successfully.' };
    } catch (err) {
      const msg = err.message || 'Failed to reset password';
      setError(msg);
      return { success: false, message: msg };
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        register,
        googleLogin,
        forgotPassword,
        resetPassword,
        logout,
        checkAuth,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'ADMIN',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
