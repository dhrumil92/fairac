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
  { path: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { path: '/room', icon: 'meeting_room', label: 'My Room' },
  { path: '/sessions', icon: 'history', label: 'Sessions' },
  { path: '/wallet', icon: 'account_balance_wallet', label: 'Wallet' },
  { path: '/profile', icon: 'settings', label: 'Settings' },
];

const ADMIN_NAV_ITEMS = [
  { path: '/admin/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { path: '/admin/students', icon: 'groups', label: 'Students' },
  { path: '/admin/rooms', icon: 'meeting_room', label: 'Rooms' },
  { path: '/admin/sessions', icon: 'history', label: 'Sessions' },
  { path: '/admin/wallet', icon: 'account_balance_wallet', label: 'Wallet Ops' },
  { path: '/admin/reports', icon: 'bar_chart', label: 'Reports' },
];

const Sidebar = () => {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [openTicketCount, setOpenTicketCount] = useState(0);

  // Custom tooltip state
  const [isCopied, setIsCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleCopyCode = () => {
    if (user?.hostel_code) {
      navigator.clipboard.writeText(user.hostel_code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

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
      const interval = setInterval(checkSession, 10000);
      return () => clearInterval(interval);
    } else {
      // Single lightweight call on mount — no polling, no server load
      api.get('/support/unseen-count')
        .then(res => setOpenTicketCount(res.data.count || 0))
        .catch(() => {});
    }
  }, [isAdmin]);

  const navItems = [...(isAdmin ? ADMIN_NAV_ITEMS : NAV_ITEMS)];

  if (user?.role === 'super_admin') {
    navItems.splice(1, 0, { path: '/admin/hostels', icon: 'domain', label: 'Hostels' });
  }

  return (
    <aside className="sidebar">
      {/* ── Logo ── */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <span className="material-symbols-outlined text-sm">ac_unit</span>
        </div>
        <div>
          <h2 className="sidebar-logo-text">FairAC</h2>
          {isAdmin && (
            <>
              <p className="sidebar-logo-sub" style={{ fontSize: '15px', color: '#00D4AA', marginTop: '2px', fontWeight: 'bold' }}>{user?.hostel_name}</p>
              <div
                style={{ position: 'relative', display: 'block' }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => {
                  setIsHovered(false);
                  setTimeout(() => setIsCopied(false), 300); // Wait for transition to finish before resetting text
                }}
              >
                <p
                  className="sidebar-logo-sub"
                  style={{ fontSize: '12px', color: '#94A3B8', marginTop: '1px', cursor: 'pointer', transition: 'color 0.2s', ...(isHovered ? { color: '#ffffff' } : {}) }}
                  onClick={handleCopyCode}
                >
                  {user?.hostel_code}
                </p>
                {/* Custom Tooltip */}
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '0',
                  marginTop: '8px',
                  padding: '6px 12px',
                  backgroundColor: '#6C63FF',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: '600',
                  borderRadius: '6px',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  opacity: isHovered ? 1 : 0,
                  transform: isHovered ? 'translateY(0)' : 'translateY(-4px)',
                  transition: 'opacity 0.2s ease, transform 0.2s ease',
                  zIndex: 50,
                  boxShadow: '0 4px 12px rgba(108, 99, 255, 0.3)'
                }}>
                  {isCopied ? 'Copied to clipboard!' : 'Copy Secret Code'}
                  {/* Little triangle arrow */}
                  <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '12px',
                    width: 0,
                    height: 0,
                    borderLeft: '4px solid transparent',
                    borderRight: '4px solid transparent',
                    borderBottom: '4px solid #6C63FF'
                  }}></div>
                </div>
              </div>
            </>
          )}
        </div>
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
          const isActive = location.pathname === path || (path !== '/dashboard' && path !== '/admin/dashboard' && location.pathname.startsWith(path));
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

        <Link to={isAdmin ? "/admin/support" : "/support"} className="sidebar-bottom-link" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="material-symbols-outlined">contact_support</span>
          <span style={{ flex: 1 }}>Support</span>
          {isAdmin && openTicketCount > 0 && (
            <span className="ticket-badge" title={`${openTicketCount} open ticket${openTicketCount > 1 ? 's' : ''}`} />
          )}
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
