// =============================================================================
// src/context/AuthContext.js
// Global Authentication State — Mobile version
// Copied from web frontend, adapted to use AsyncStorage instead of localStorage
// =============================================================================

import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]           = useState(null);
  const [token, setToken]         = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: restore session from AsyncStorage (replaces localStorage)
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedToken = await AsyncStorage.getItem('fairac_token');
        const savedUser  = await AsyncStorage.getItem('fairac_user');
        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
          // Silently sync with backend to get fresh user data
          api.get('/auth/me', { headers: { Authorization: `Bearer ${savedToken}` } })
            .then(res => {
              if (res.data.success) {
                setUser(res.data.data.user);
                AsyncStorage.setItem('fairac_user', JSON.stringify(res.data.data.user));
              }
            })
            .catch(err => console.error('Silent sync failed:', err));
        }
      } catch (e) {
        console.error('Failed to restore session:', e);
      } finally {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, []);

  const login = async (newToken, newUser) => {
    await AsyncStorage.setItem('fairac_token', newToken);
    await AsyncStorage.setItem('fairac_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = async () => {
    await AsyncStorage.removeItem('fairac_token');
    await AsyncStorage.removeItem('fairac_user');
    setToken(null);
    setUser(null);
  };

  const updateUserLocally = async (updatedUser) => {
    await AsyncStorage.setItem('fairac_user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  const fetchMe = async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data.success) {
        await updateUserLocally(response.data.data.user);
      }
    } catch (err) {
      console.error('Failed to fetchMe:', err);
    }
  };

  const isAdmin   = user?.role === 'admin' || user?.role === 'super_admin';
  const isStudent = user?.role === 'student';

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isAdmin, isStudent, login, logout, updateUserLocally, fetchMe }}>
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

export default AuthContext;
