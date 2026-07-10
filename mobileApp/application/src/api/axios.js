// =============================================================================
// src/api/axios.js
// Axios HTTP Client — Mobile version (uses AsyncStorage instead of localStorage)
// Copied from web frontend and adapted for React Native
// =============================================================================

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ⚠️ UPDATE THIS to your computer's local IP address (same as web app)
// Find it by running `ipconfig` in your terminal on Windows
const API_BASE_URL = 'http://10.202.106.220:5000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request Interceptor ─────────────────────────────────────────────────────
// Automatically attaches the JWT token to every outgoing request.
// Mobile uses AsyncStorage instead of localStorage.
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('fairac_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
