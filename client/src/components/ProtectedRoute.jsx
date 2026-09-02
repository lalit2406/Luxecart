import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth';
import { ShieldAlert, RefreshCw } from 'lucide-react';

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F3EE] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#9A6A45] animate-spin" />
          <p className="text-sm text-[#6F6963]">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return (
      <div className="min-h-screen bg-[#F7F3EE] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#FFFFFF] border border-[#E7DED5] rounded-2xl p-8 text-center shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold font-serif text-[#2A211B]">
            Access Restricted
          </h2>
          <p className="text-sm text-[#6F6963]">
            You do not have the required <strong>{requiredRole}</strong> permissions to access this area.
          </p>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#2A211B] text-white hover:bg-[#9A6A45] transition-colors text-sm font-medium"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
