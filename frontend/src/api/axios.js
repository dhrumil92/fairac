// =============================================================================
// src/api/axios.js
// Axios HTTP Client — Centralized API Configuration
// =============================================================================
//
// WHY ONE AXIOS INSTANCE?
//   All API calls share the same base URL, timeout, and interceptors.
//   Without this, every file would duplicate the URL string, making a
//   server URL change require updating 20 files instead of 1.
//
// HOW INTERCEPTORS WORK:
//   Request interceptor: runs before every request → adds Authorization header
//   Response interceptor: runs after every response → handles 401s globally
//
// =============================================================================

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000/api/v1`;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request Interceptor ───────────────────────────────────────────────────
// Automatically attaches the JWT token to every outgoing request.
// The token is stored in localStorage after login.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('fairac_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor ─────────────────────────────────────────────────
// If ANY API call returns 401 (Unauthorized / token expired):
//   - Clear localStorage
//   - Redirect to login page
// This prevents users from getting stuck in a broken state.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('fairac_token');
      localStorage.removeItem('fairac_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
