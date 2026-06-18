// =============================================================================
// src/components/ProtectedRoute.jsx
// Route Guard — Prevents unauthorized access to protected pages
// =============================================================================

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Generic loading screen shown while checking localStorage
const LoadingScreen = () => (
  <div style={{
    minHeight: '100vh',
    background: '#0F1729',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: '16px',
  }}>
    <div style={{
      width: '48px', height: '48px',
      border: '3px solid rgba(108,99,255,0.2)',
      borderTop: '3px solid #6C63FF',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif' }}>
      Loading FairAC...
    </p>
  </div>
);

// ─── ProtectedRoute: requires login ─────────────────────────────────────────
export const ProtectedRoute = ({ children }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user)     return <Navigate to="/login" replace />;
  return children;
};

// ─── AdminRoute: requires admin role ────────────────────────────────────────
export const AdminRoute = ({ children }) => {
  const { user, isLoading, isAdmin } = useAuth();
  if (isLoading)  return <LoadingScreen />;
  if (!user)      return <Navigate to="/login" replace />;
  if (!isAdmin)   return <Navigate to="/dashboard" replace />;
  return children;
};

// ─── StudentRoute: requires student role ────────────────────────────────────
export const StudentRoute = ({ children }) => {
  const { user, isLoading, isStudent } = useAuth();
  if (isLoading)   return <LoadingScreen />;
  if (!user)       return <Navigate to="/login" replace />;
  if (!isStudent)  return <Navigate to="/admin/dashboard" replace />;
  return children;
};

// ─── GuestRoute: only accessible when NOT logged in ─────────────────────────
export const GuestRoute = ({ children }) => {
  const { user, isLoading, isAdmin } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (user)      return <Navigate to={isAdmin ? '/admin/dashboard' : '/dashboard'} replace />;
  return children;
};
