// =============================================================================
// src/components/layout/Sidebar.jsx
// Shared Navigation Sidebar — Stitch Design
// =============================================================================

import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import './Sidebar.css';

const NAV_ITEMS = [
  { path: '/dashboard',          icon: 'dashboard',               label: 'Dashboard' },
  { path: '/room',               icon: 'meeting_room',            label: 'My Room' },
  { path: '/sessions',           icon: 'history',                 label: 'Sessions' },
  { path: '/wallet',             icon: 'account_balance_wallet',  label: 'Wallet' },
  { path: '/profile',            icon: 'settings',                label: 'Settings' },
];

const ADMIN_NAV_ITEMS = [
  { path: '/admin/dashboard',  icon: 'dashboard',              label: 'Dashboard' },
  { path: '/admin/students',   icon: 'groups',                 label: 'Students' },
  { path: '/admin/rooms',      icon: 'meeting_room',           label: 'Rooms' },
  { path: '/admin/sessions',   icon: 'history',                label: 'Sessions' },
  { path: '/admin/wallet',     icon: 'account_balance_wallet', label: 'Wallet Ops' },
  { path: '/admin/reports',    icon: 'bar_chart',              label: 'Reports' },
];

const Sidebar = () => {
  const { pathname } = useLocation();
  const { isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [hasActiveSession, setHasActiveSession] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      const checkSession = async () => {
        try {
          const res = await api.get('/sessions/active');
          const d = res.data?.data;
          const sessionData = d && d.session !== undefined ? d.session : d;
          if (sessionData && sessionData.status === 'active') {
            setHasActiveSession(true);
          } else {
            setHasActiveSession(false);
          }
        } catch (err) {
          setHasActiveSession(false);
        }
      };
      
      checkSession();
      const interval = setInterval(checkSession, 10000); // Check every 10s
      return () => clearInterval(interval);
    }
  }, [isAdmin]);

  const navItems = isAdmin ? ADMIN_NAV_ITEMS : NAV_ITEMS;

  return (
    <aside className="sidebar">
      {/* ── Logo ── */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <span className="material-symbols-outlined text-sm">ac_unit</span>
        </div>
        <div>
          <h2 className="sidebar-logo-text">FairAC</h2>
          <p className="sidebar-logo-sub">Student Billing</p>
        </div>
        {isAdmin && <span className="sidebar-admin-badge">Admin</span>}
      </div>

      {/* ── Start Session Action ── */}
      {!isAdmin && (
        <div className="sidebar-action">
          <Link to="/sessions" className={`sidebar-start-btn ${hasActiveSession ? 'active-session-btn' : ''}`}>
            {hasActiveSession ? (
              <>
                <span className="material-symbols-outlined animate-pulse">sensors</span>
                Session is Active
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">bolt</span>
                Start Session
              </>
            )}
          </Link>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav className="sidebar-nav">
        {navItems.map(({ path, icon, label }) => {
          const isActive = pathname === path || (path !== '/dashboard' && path !== '/admin/dashboard' && pathname.startsWith(path));
          return (
            <Link
              key={path}
              to={path}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="material-symbols-outlined">{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom Actions ── */}
      <div className="sidebar-footer">
        <div className="sidebar-divider"></div>
        
        <Link to="#" className="sidebar-bottom-link">
          <span className="material-symbols-outlined">contact_support</span>
          <span>Support</span>
        </Link>
        
        <button className="sidebar-bottom-link" onClick={logout}>
          <span className="material-symbols-outlined">logout</span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
