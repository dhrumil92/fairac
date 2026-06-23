// =============================================================================
// src/pages/student/DashboardPage.jsx
// Student Dashboard — Stitch Design + Live API Data
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import Toast from '../../components/ui/Toast';
import './StudentPages.css';

// ─── Stat Card Component ──────────────────────────────────────────────────────
const StatCard = ({ icon, iconColor, iconBg, label, value, badge, badgeColor, onClick }) => (
  <div className={`stat-card glass-card ${onClick ? 'cursor-pointer hover:scale-105 transition-all duration-200' : ''}`} onClick={onClick}>
    <div className="stat-card-header">
      <div className="stat-card-icon" style={{ background: iconBg, color: iconColor }}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <span className="stat-badge" style={{ color: badgeColor, background: badgeColor + '15' }}>
        {badge}
      </span>
    </div>
    <p className="stat-label">{label}</p>
    <p className="stat-value">{value}</p>
  </div>
);

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
const Skeleton = ({ className }) => (
  <div className={`skeleton ${className}`} />
);

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [wallet, setWallet]           = useState(null);
  const [monthlyStats, setMonthly]    = useState(null);
  const [activeSession, setActive]    = useState(null);
  const [recentSessions, setRecent]   = useState([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [roomInfo, setRoomInfo]       = useState(null);
  const [pendingInvites, setPending]  = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  
  const [elapsedText, setElapsedText] = useState('00:00:00');

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // ─── Fetch all dashboard data in parallel ────────────────────────────────
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
      try {
        const [walletRes, sessionsRes, activeSessionRes, roomRes, invitesRes] = await Promise.allSettled([
          api.get('/wallet'),
          api.get('/sessions/my'),
          api.get('/sessions/active'),
          api.get('/rooms/my'),
          api.get('/rooms/invitations'),
        ]);

        if (walletRes.status === 'fulfilled') {
          const wData = walletRes.value.data.data;
          setWallet(wData.wallet || wData);
          setMonthly(wData.this_month || null);
        }
        if (sessionsRes.status === 'fulfilled') {
          const data = sessionsRes.value.data.data;
          setRecent(data.sessions || data || []);
          setTotalSessions(data.pagination?.total || data.sessions?.length || data?.length || 0);
        }
        if (activeSessionRes.status === 'fulfilled') {
          const d = activeSessionRes.value.data.data;
          setActive(d && d.session !== undefined ? d.session : d);
        } else if (activeSessionRes.reason?.response?.status === 404) {
          setActive(null);
        }
        if (roomRes.status === 'fulfilled') {
          setRoomInfo(roomRes.value.data.data.room || roomRes.value.data.data);
        }
        if (invitesRes.status === 'fulfilled') {
          setPending(invitesRes.value.data.data.invitations || []);
        }
      } catch (e) {
        setError('Failed to load some dashboard data.');
      } finally {
        setLoading(false);
      }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleParticipantAction = async (e, action) => {
    e.stopPropagation();
    setError('');
    try {
      const res = await api.post(`/sessions/participants/${action}`, { session_id: activeSession.session_id });
      setToastMessage(res.data?.message || `Successfully ${action}ed session invite.`);
      fetchDashboardData();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${action} session invite.`);
    }
  };

  const handleRoomInviteAction = async (e, invitation_id, action) => {
    e.stopPropagation();
    setError('');
    try {
      const endpoint = action === 'accept' ? '/rooms/invite/accept' : '/rooms/invite/reject';
      const res = await api.post(endpoint, { invitation_id });
      setToastMessage(res.data?.message || `Successfully ${action}ed room invite.`);
      fetchDashboardData();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${action} room invite.`);
    }
  };

  const handleLeaveAction = async (e, leaving_u_id, action) => {
    e.stopPropagation();
    setError('');
    try {
      const res = await api.post(`/sessions/participants/leave/${action}`, { session_id: activeSession.session_id, leaving_u_id });
      setToastMessage(res.data?.message || `Leave request ${action}ed.`);
      fetchDashboardData();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${action} leave request.`);
    }
  };

  // Update elapsed time every second if active session exists
  useEffect(() => {
    let interval;
    if (activeSession && activeSession.status === 'active') {
      const startTime = new Date(activeSession.start_time).getTime();
      interval = setInterval(() => {
        const now = new Date().getTime();
        const diff = now - startTime;
        
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        
        setElapsedText(
          `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        );
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeSession]);

  useEffect(() => {
    let pollInterval;
    if (activeSession && activeSession.status === 'active') {
      pollInterval = setInterval(() => {
        const fetchSilently = async () => {
          try {
            const res = await api.get('/sessions/active');
            const fetchedSession = res.data?.data?.session;
            if (fetchedSession?.status !== 'active') {
              // Backend ended the session, refresh dashboard
              fetchDashboardData();
            } else {
              // Update the active session so consumption and cost stay live
              setActive(fetchedSession);
            }
          } catch (err) {
            if (err.response?.status === 404) {
              fetchDashboardData(); // Session ended and is gone
            }
          }
        };
        fetchSilently();
      }, 10000);
    }
    return () => clearInterval(pollInterval);
  }, [activeSession, fetchDashboardData]);

  let myParticipant = null;
  if (activeSession && activeSession.participants) {
    myParticipant = activeSession.participants.find(p => Number(p.u_id) === Number(user.u_id));
  }

  const estimatedCost = () => {
    if (!activeSession || !roomInfo) return '0.00';
    let units = 0;
    if (activeSession.total_units !== undefined && parseFloat(activeSession.total_units) > 0) {
      units = parseFloat(activeSession.total_units);
    } else {
      const hours = (new Date().getTime() - new Date(activeSession.start_time).getTime()) / (1000 * 60 * 60);
      units = Math.max(0, hours) * 1.4;
    }
    const cost = units * parseFloat(roomInfo.rate_per_unit || 10);
    return cost.toFixed(2);
  };

  const powerConsumption = () => {
    if (!activeSession) return '0.000';
    if (activeSession.total_units !== undefined && parseFloat(activeSession.total_units) > 0) {
      return parseFloat(activeSession.total_units).toFixed(3);
    }
    const hours = (new Date().getTime() - new Date(activeSession.start_time).getTime()) / (1000 * 60 * 60);
    return (Math.max(0, hours) * 1.4).toFixed(3);
  };

  const firstName = user?.name?.split(' ')[0] || 'Student';

  return (
    <div className="page-layout">
      <Sidebar />

      <main className="page-main">
        {/* ── Top Header ── */}
        <header className="page-header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">
              {greeting()}, {firstName} 👋 &nbsp;<span className="divider">|</span>&nbsp; {today}
            </p>
          </div>
          <div className="header-actions">
            <button className="icon-btn" title="Notifications">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <Link to="/sessions" className="btn-primary-sm" id="new-session-btn">
              <span className="material-symbols-outlined">bolt</span>
              New Session
            </Link>
          </div>
        </header>

        {error && <Toast message={error} type="error" duration={10000} onClose={() => setError('')} />}
        {toastMessage && <Toast message={toastMessage} type="success" duration={10000} onClose={() => setToastMessage(null)} />}
        
        {myParticipant?.status === 'invited' && (
          <div 
            onClick={() => navigate('/sessions')}
            style={{marginBottom: '24px', padding: '16px', background: 'rgba(108, 99, 255, 0.1)', color: '#6C63FF', borderRadius: '12px', border: '1px solid rgba(108, 99, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s'}}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(108, 99, 255, 0.15)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(108, 99, 255, 0.1)'}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <span className="material-symbols-outlined">bolt</span>
              <strong>You have been invited to join an active AC session!</strong>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={(e) => handleParticipantAction(e, 'accept')} 
                style={{
                  padding: '10px 32px', 
                  backgroundColor: 'rgba(0, 212, 170, 0.1)', 
                  color: '#00D4AA', 
                  fontSize: '11px', 
                  fontWeight: 'bold', 
                  borderRadius: '8px', 
                  border: '1px solid rgba(0, 212, 170, 0.2)', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 212, 170, 0.2)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 212, 170, 0.1)'}
              >
                Accept
              </button>
              <button 
                onClick={(e) => handleParticipantAction(e, 'reject')} 
                style={{
                  padding: '10px 32px', 
                  backgroundColor: 'transparent', 
                  color: '#FF6B6B', 
                  fontSize: '11px', 
                  fontWeight: 'bold', 
                  borderRadius: '8px', 
                  border: '1px solid rgba(255, 107, 107, 0.2)', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 107, 107, 0.1)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Reject
              </button>
            </div>
          </div>
        )}

        {pendingInvites.map(invite => (
          <div 
            key={invite.invitation_id}
            onClick={() => navigate('/room')}
            style={{marginBottom: '24px', padding: '16px', background: 'rgba(251, 146, 60, 0.1)', color: '#FB923C', borderRadius: '12px', border: '1px solid rgba(251, 146, 60, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s'}}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(251, 146, 60, 0.15)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(251, 146, 60, 0.1)'}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <span className="material-symbols-outlined">notifications_active</span>
              <strong>{invite.invited_by_name || 'Someone'} invited you to join {invite.room_name || `Room ${invite.room_no}`}!</strong>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={(e) => handleRoomInviteAction(e, invite.invitation_id, 'accept')} 
                style={{
                  padding: '10px 32px', 
                  backgroundColor: 'rgba(0, 212, 170, 0.1)', 
                  color: '#00D4AA', 
                  fontSize: '11px', 
                  fontWeight: 'bold', 
                  borderRadius: '8px', 
                  border: '1px solid rgba(0, 212, 170, 0.2)', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 212, 170, 0.2)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 212, 170, 0.1)'}
              >
                Accept
              </button>
              <button 
                onClick={(e) => handleRoomInviteAction(e, invite.invitation_id, 'reject')} 
                style={{
                  padding: '10px 32px', 
                  backgroundColor: 'transparent', 
                  color: '#FF6B6B', 
                  fontSize: '11px', 
                  fontWeight: 'bold', 
                  borderRadius: '8px', 
                  border: '1px solid rgba(255, 107, 107, 0.2)', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 107, 107, 0.1)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Reject
              </button>
            </div>
          </div>
        ))}

        {/* ── Pending Leave Requests Banner ── */}
        {activeSession && activeSession.status === 'active' && myParticipant?.status === 'accepted' &&
          activeSession.participants.filter(p => p.leave_status === 'pending' && Number(p.u_id) !== Number(user.u_id)).map(leaver => (
            <div 
              key={leaver.u_id} 
              onClick={() => navigate('/sessions')}
              style={{marginBottom: '24px', padding: '16px', background: 'rgba(255, 171, 0, 0.1)', color: '#FFAB00', borderRadius: '12px', border: '1px solid rgba(255, 171, 0, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s'}}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 171, 0, 0.15)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 171, 0, 0.1)'}
            >
              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <span className="material-symbols-outlined">directions_run</span>
                <strong>{leaver.name} wants to leave the active AC session early.</strong>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={(e) => handleLeaveAction(e, leaver.u_id, 'approve')} 
                  style={{
                    padding: '10px 32px', 
                    backgroundColor: 'rgba(0, 212, 170, 0.1)', 
                    color: '#00D4AA', 
                    fontSize: '11px', 
                    fontWeight: 'bold', 
                    borderRadius: '8px', 
                    border: '1px solid rgba(0, 212, 170, 0.2)', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 212, 170, 0.2)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 212, 170, 0.1)'}
                >
                  Accept
                </button>
                <button 
                  onClick={(e) => handleLeaveAction(e, leaver.u_id, 'reject')} 
                  style={{
                    padding: '10px 32px', 
                    backgroundColor: 'transparent', 
                    color: '#FF6B6B', 
                    fontSize: '11px', 
                    fontWeight: 'bold', 
                    borderRadius: '8px', 
                    border: '1px solid rgba(255, 107, 107, 0.2)', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 107, 107, 0.1)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  Reject
                </button>
              </div>
            </div>
          ))
        }

        {/* ── Stats Row ── */}
        <div className="stats-grid">
          {loading ? (
            <>
              <Skeleton className="stat-card-skeleton" />
              <Skeleton className="stat-card-skeleton" />
              <Skeleton className="stat-card-skeleton" />
              <Skeleton className="stat-card-skeleton" />
            </>
          ) : (
            <>
              <StatCard
                icon="payments"
                iconColor="#00D4AA"
                iconBg="rgba(0,212,170,0.15)"
                label="Wallet Balance"
                value={wallet ? `₹${parseFloat(wallet.balance).toFixed(2)}` : '₹0.00'}
                badge={wallet ? `₹${parseFloat(wallet.total_recharged || 0).toFixed(0)} total` : 'No wallet'}
                badgeColor="#00D4AA"
              />
              <StatCard
                icon="receipt_long"
                iconColor="#6C63FF"
                iconBg="rgba(108,99,255,0.15)"
                label="This Month Spent"
                value={monthlyStats ? `₹${parseFloat(monthlyStats.cost || 0).toFixed(2)}` : '₹0.00'}
                badge="AC billing"
                badgeColor="#6C63FF"
              />
              <StatCard
                icon="lan"
                iconColor="#60A5FA"
                iconBg="rgba(96,165,250,0.15)"
                label="Sessions This Month"
                value={totalSessions || '0'}
                badge="Usage sessions"
                badgeColor="#60A5FA"
                onClick={() => navigate('/sessions#history')}
              />
              <StatCard
                icon="home_work"
                iconColor="#FB923C"
                iconBg="rgba(251,146,60,0.15)"
                label="Room"
                value={roomInfo ? roomInfo.room_number || roomInfo.room_name || 'Room —' : 'No room'}
                badge={roomInfo ? roomInfo.hostel_name || 'Hostel' : 'Join a room'}
                badgeColor="#FB923C"
                onClick={() => navigate('/room')}
              />
            </>
          )}
        </div>

        {/* ── Middle: Active Session + Quick Recharge ── */}
        <div className="middle-grid">
          {/* Active Session */}
          <div className={`active-session-card glass-card ${activeSession ? 'active' : 'no-session'}`}>
            {activeSession ? (
              <>
                <div className="session-status-badge">
                  <div className="pulse-dot" />
                  <span>Session Active</span>
                </div>
                <h2 className="section-heading">Current AC Session</h2>
                <div className="session-details">
                  <div className="session-detail-row">
                    <div className="detail-icon"><span className="material-symbols-outlined">schedule</span></div>
                    <div>
                      <p className="detail-label">Elapsed Time</p>
                      <p className="detail-value text-xl font-bold font-mono tracking-widest">{elapsedText}</p>
                    </div>
                  </div>
                  <div className="session-detail-row">
                    <div className="detail-icon"><span className="material-symbols-outlined">group</span></div>
                    <div>
                      <p className="detail-label">My Status</p>
                      <p className="detail-value font-bold" style={{ color: myParticipant?.status === 'accepted' ? '#00D4AA' : '#FF6B6B' }}>
                        {myParticipant?.status === 'accepted' ? 'In Session' : myParticipant?.status === 'invited' ? 'Invited' : 'Not in session'}
                      </p>
                    </div>
                  </div>
                  <div className="session-detail-row">
                    <div className="detail-icon"><span className="material-symbols-outlined">electric_meter</span></div>
                    <div>
                      <p className="detail-label">Consumption</p>
                      <p className="detail-value text-xl font-bold font-mono tracking-widest">{powerConsumption()} kWh</p>
                    </div>
                  </div>
                  <div className="session-detail-row">
                    <div className="detail-icon"><span className="material-symbols-outlined">currency_rupee</span></div>
                    <div>
                      <p className="detail-label">Estimated Cost</p>
                      <p className="detail-value text-xl font-bold" style={{ color: '#00D4AA' }}>~₹{estimatedCost()}</p>
                    </div>
                  </div>
                </div>
                <Link to="/sessions" className="btn-gradient" id="view-session-btn">
                  Manage Session
                </Link>
              </>
            ) : (
              <div className="no-session-content">
                <div className="no-session-icon">
                  <span className="material-symbols-outlined">air</span>
                </div>
                <h3>No Active Session</h3>
                <p>Start a session when you turn on the AC. Your roommates will be auto-notified.</p>
                <Link to="/sessions" className="btn-gradient" id="start-session-btn">
                  <span className="material-symbols-outlined">bolt</span>
                  Start a Session
                </Link>
              </div>
            )}
          </div>

          {/* Quick Recharge Card */}
          <div className="quick-recharge-card glass-card">
            <div className="quick-recharge-glow" />
            <h3 className="section-heading">Quick Recharge</h3>
            <div className="recharge-amounts">
              {[100, 250, 500, 1000].map(amount => (
                <button key={amount} className="recharge-amount-btn" id={`recharge-${amount}-btn`}>
                  <span>₹{amount}</span>
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              ))}
            </div>
            <Link to="/wallet" className="recharge-custom-link">Custom Amount →</Link>
          </div>
        </div>

        {/* ── Recent Sessions Table ── */}
        <section className="table-section glass-card">
          <div className="table-header">
            <h2 className="section-heading">Recent Sessions</h2>
            <Link to="/sessions" className="table-see-all" id="see-all-sessions-link">
              See All History
              <span className="material-symbols-outlined">open_in_new</span>
            </Link>
          </div>

          {loading ? (
            <div className="table-loading">
              {[1,2,3].map(i => <Skeleton key={i} className="table-row-skeleton" />)}
            </div>
          ) : recentSessions.length === 0 ? (
            <div className="table-empty">
              <span className="material-symbols-outlined">history</span>
              <p>No sessions yet. Start your first AC session!</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Session ID</th>
                    <th>Booking Type</th>
                    <th>Date</th>
                    <th>Duration</th>
                    <th>Participants</th>
                    <th>Energy</th>
                    <th>Your Share</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSessions.slice(0, 4).map((session) => {
                    const dur = session.duration_minutes
                      ? `${Math.floor(session.duration_minutes / 60)}h ${Math.floor(session.duration_minutes % 60)}m`
                      : '—';
                    const isActive = session.status === 'active';
                    return (
                      <tr key={session.session_id} className={isActive ? 'row-active' : ''}>
                        <td className="cell-id">
                          <span className="text-slate-400">
                            #{String(session.session_id).padStart(5, '0')}
                          </span>
                        </td>
                        <td className="cell-white" style={{textTransform: 'capitalize'}}>
                          {session.session_type.replace('_', ' ')}
                        </td>
                        <td className="cell-muted">
                          {new Date(session.start_time).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                        <td className="cell-muted">{dur}</td>
                        <td>
                          <div className="avatar-stack">
                            {(session.participants || []).slice(0, 3).map((p, i) => (
                              <div key={i} className="avatar-mini">
                                {p.name?.[0]?.toUpperCase() || '?'}
                              </div>
                            ))}
                            {(session.participants?.length || 0) > 3 && (
                              <div className="avatar-mini avatar-more">
                                +{(session.participants.length - 3)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="cell-white">
                          {session.total_units != null ? `${parseFloat(session.total_units).toFixed(3)} kWh` : '—'}
                        </td>
                        <td className={isActive ? 'cell-success' : 'cell-white'}>
                          {session.my_cost != null ? `₹${parseFloat(session.my_cost).toFixed(2)}` : '—'}
                        </td>
                        <td>
                          <span className={`status-badge ${session.status}`}>
                            {session.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default DashboardPage;
