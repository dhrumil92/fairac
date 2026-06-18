// =============================================================================
// src/context/AuthContext.jsx
// Global Authentication State (React Context)
// =============================================================================
//
// WHY USE CONTEXT FOR AUTH?
//   User auth state (who is logged in) is needed by many components:
//   - Navbar (show user name)
//   - Protected routes (redirect if not logged in)
//   - Dashboard (show role-specific content)
//
//   Without context, each component would independently call localStorage
//   on every render. With context, the state lives in one place and all
//   components read from it reactively.
//
// WHAT THIS CONTEXT PROVIDES:
//   - user: the logged-in user object (or null)
//   - token: the JWT token (or null)
//   - login(token, user): saves to state + localStorage
//   - logout(): clears state + localStorage + redirects
//   - isAdmin: convenience boolean
//   - isLoading: true while checking localStorage on mount
//
// =============================================================================

import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: restore session from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('fairac_token');
    const savedUser  = localStorage.getItem('fairac_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const login = (newToken, newUser) => {
    localStorage.setItem('fairac_token', newToken);
    localStorage.setItem('fairac_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('fairac_token');
    localStorage.removeItem('fairac_user');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  };

  const updateUserLocally = (updatedUser) => {
    localStorage.setItem('fairac_user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  const isAdmin   = user?.role === 'admin';
  const isStudent = user?.role === 'student';

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isAdmin, isStudent, login, logout, updateUserLocally }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for clean usage in any component
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
