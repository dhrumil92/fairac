// =============================================================================
// src/App.jsx
// Application Root — Routes, Auth Provider, Navigation
// =============================================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { GuestRoute, ProtectedRoute, AdminRoute, StudentRoute } from './components/ProtectedRoute';

// Auth Pages
import LoginPage    from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

import DashboardPage from './pages/student/DashboardPage';
import RoomPage from './pages/student/RoomPage';
import SessionPage from './pages/student/SessionPage';
import WalletPage from './pages/student/WalletPage';
import ProfilePage from './pages/student/ProfilePage';

import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminStudentsPage from './pages/admin/AdminStudentsPage';
import AdminRoomsPage from './pages/admin/AdminRoomsPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminWalletPage from './pages/admin/AdminWalletPage';
import AdminSessionsPage from './pages/admin/AdminSessionsPage';

// Placeholder pages (will be replaced as we build each one)
const ComingSoon = ({ title }) => (
  <div style={{ minHeight: '100vh', background: '#0F1729', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,0.5)', flexDirection: 'column', gap: '12px' }}>
    <div style={{ fontSize: '3rem' }}>🚧</div>
    <h2 style={{ color: '#6C63FF', fontSize: '1.5rem' }}>{title}</h2>
    <p style={{ fontSize: '0.875rem' }}>This page is coming next...</p>
  </div>
);


const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Root redirect ── */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* ── Auth Routes (Guest only — redirect if logged in) ── */}
          <Route path="/login" element={
            <GuestRoute><LoginPage /></GuestRoute>
          } />
          <Route path="/register" element={
            <GuestRoute><RegisterPage /></GuestRoute>
          } />

          {/* ── Student Routes ── */}
          <Route path="/dashboard" element={
            <StudentRoute><DashboardPage /></StudentRoute>
          } />
          <Route path="/room" element={
            <StudentRoute><RoomPage /></StudentRoute>
          } />
          <Route path="/sessions" element={
            <StudentRoute><SessionPage /></StudentRoute>
          } />
          <Route path="/wallet" element={
            <StudentRoute><WalletPage /></StudentRoute>
          } />
          <Route path="/profile" element={
            <StudentRoute><ProfilePage /></StudentRoute>
          } />

          {/* ── Admin Routes ── */}
          <Route path="/admin/dashboard" element={
            <AdminRoute><AdminDashboardPage /></AdminRoute>
          } />
          <Route path="/admin/sessions" element={
            <AdminRoute><AdminSessionsPage /></AdminRoute>
          } />
          <Route path="/admin/students" element={
            <AdminRoute><AdminStudentsPage /></AdminRoute>
          } />
          <Route path="/admin/rooms" element={
            <AdminRoute><AdminRoomsPage /></AdminRoute>
          } />
          <Route path="/admin/reports" element={
            <AdminRoute><AdminReportsPage /></AdminRoute>
          } />
          <Route path="/admin/wallet" element={
            <AdminRoute><AdminWalletPage /></AdminRoute>
          } />

          {/* ── 404 ── */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
