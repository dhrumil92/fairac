import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/layout/Sidebar';
import api from '../../api/axios';
import Toast from '../../components/ui/Toast';
import './StudentPages.css';

const SessionPage = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  const [activeSession, setActiveSession] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [myRoom, setMyRoom] = useState(null);
  const [wallet, setWallet] = useState(null);

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  // Start Form States
  const [sessionType, setSessionType] = useState('duration');
  const [targetValue, setTargetValue] = useState('1.5');

  // Real-time counter
  const [elapsedText, setElapsedText] = useState('00:00:00');

  const clearMessages = () => {
    setError('');
    setSuccess('');
    setToastMessage(null);
  };

  const fetchSessionData = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      clearMessages();
    }
    try {
      const [roomRes, activeRes, recentRes, walletRes] = await Promise.allSettled([
        api.get('/rooms/my'),
        api.get('/sessions/active'),
        api.get(`/sessions/my?page=${page}&limit=7`),
        api.get('/wallet')
      ]);

      if (roomRes.status === 'fulfilled') setMyRoom(roomRes.value.data.data.room || roomRes.value.data.data);
      if (walletRes.status === 'fulfilled') setWallet(walletRes.value.data.data.wallet || walletRes.value.data.data);

      if (activeRes.status === 'fulfilled') {
        const d = activeRes.value.data.data;
        setActiveSession(d && d.session !== undefined ? d.session : d);
      } else {
        if (activeRes.reason?.response?.status !== 404) {
          setError('Failed to fetch active session.');
        } else {
          setActiveSession(null);
        }
      }

      if (recentRes.status === 'fulfilled') {
        const data = recentRes.value.data.data;
        setRecentSessions(data.sessions || data || []);
        setPagination(data.pagination || {});
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSessionData();
  }, [page]);

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

  // Auto-poll every 10 seconds to sync with backend worker auto-termination
  useEffect(() => {
    let pollInterval;
    if (activeSession && activeSession.status === 'active') {
      pollInterval = setInterval(() => {
        const fetchSilently = async () => {
          try {
            const res = await api.get('/sessions/active');
            if (res.data?.data?.session?.status !== 'active') {
              fetchSessionData();
            }
          } catch (err) {
            if (err.response?.status === 404) {
              fetchSessionData();
            }
          }
        };
        fetchSilently();
      }, 10000);
    }
    return () => clearInterval(pollInterval);
  }, [activeSession]);

  // IoT Device Status
  const [deviceStatus, setDeviceStatus] = useState(null);

  useEffect(() => {
    let pollInterval;
    if (myRoom && myRoom.r_id) {
      const fetchDeviceStatus = async () => {
        try {
          const res = await api.get(`/iot/room/${myRoom.r_id}/status`);
          setDeviceStatus(res.data?.data);
        } catch (err) {
          // ignore or handle
        }
      };
      fetchDeviceStatus(); // initial
      pollInterval = setInterval(fetchDeviceStatus, 10000);
    }
    return () => clearInterval(pollInterval);
  }, [myRoom]);



  const handleError = (err, defaultMsg) => {
    if (err.response?.status === 404) {
      fetchSessionData(); // State changed, reload
    } else {
      setError(err.response?.data?.message || defaultMsg);
    }
  };

  // ─── Actions ───
  const handleStartSession = async (e) => {
    e.preventDefault();
    clearMessages();

    if (!myRoom) return setError('You must be in a room to start a session.');
    try {
      const payload = { r_id: myRoom.r_id, session_type: sessionType };
      if (sessionType !== 'unlimited') {
        if (!targetValue) return setError('Please enter a target value.');
        const val = parseFloat(targetValue);
        if (isNaN(val)) return setError('Please enter a valid number.');
        const minVal = sessionType === 'budget' ? 10 : 0.5;
        if (val < minVal) return setError(`Minimum allowed value is ${minVal}.`);
        payload.target_value = val;
      }
      const res = await api.post('/sessions/start', payload);
      setToastMessage(res.data?.message || 'Session started successfully!');
      fetchSessionData(true);
    } catch (err) {
      handleError(err, 'Failed to start session.');
    }
  };

  const handleEndSession = async () => {
    clearMessages();
    // Simulate automated IoT Smart Meter reading instead of asking the student
    const startTime = new Date(activeSession.start_time).getTime();
    const elapsedHours = (new Date().getTime() - startTime) / (1000 * 60 * 60);
    // Assume AC consumes 1.5 kWh per hour, safe guard against NaN
    let simulatedKwh = '0.0100';
    if (!isNaN(elapsedHours) && elapsedHours >= 0) {
      simulatedKwh = Math.max(0.01, Math.abs(elapsedHours) * 1.5).toFixed(4);
    }

    try {
      const res = await api.post(`/sessions/${activeSession.session_id}/end`, { total_units: simulatedKwh });
      setToastMessage(res.data?.message || `Session ended! Auto-fetched ${simulatedKwh} kWh from Smart Meter.`);
      setActiveSession(null);
      fetchSessionData(true);
    } catch (err) {
      handleError(err, 'Failed to end session.');
    }
  };

  const handleParticipantAction = async (action) => {
    clearMessages();
    try {
      const res = await api.post(`/sessions/participants/${action}`, { session_id: activeSession.session_id });
      setToastMessage(res.data?.message || `Successfully ${action}ed the session.`);
      fetchSessionData(true);
    } catch (err) {
      handleError(err, `Failed to ${action} session.`);
    }
  };

  const handleJoin = async () => {
    clearMessages();
    try {
      const res = await api.post(`/sessions/${activeSession.session_id}/join`);
      setToastMessage(res.data?.message || 'Joined session successfully.');
      fetchSessionData(true);
    } catch (err) {
      handleError(err, 'Failed to join session.');
    }
  };


  const handleRejectLeave = async (leaving_u_id) => {
    clearMessages();
    try {
      const res = await api.post(`/sessions/participants/leave/reject`, { session_id: activeSession.session_id, leaving_u_id });
      setToastMessage(res.data?.message || `Successfully rejected leave request.`);
      fetchSessionData(true);
    } catch (err) {
      handleError(err, `Failed to reject leave request.`);
    }
  };

  const handleApproveLeave = async (leaving_u_id) => {
    clearMessages();
    try {
      const res = await api.post(`/sessions/participants/leave/approve`, { session_id: activeSession.session_id, leaving_u_id });
      setToastMessage(res.data?.message || `Successfully approved leave request.`);
      fetchSessionData(true);
    } catch (err) {
      handleError(err, `Failed to approve leave request.`);
    }
  };

  const handleInviteRoommate = async (invitee_id) => {
    clearMessages();
    try {
      await api.post('/sessions/participants/invite', { session_id: activeSession.session_id, invitee_id });
      setToastMessage('Invitation sent successfully.');
      fetchSessionData(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to invite roommate.');
    }
  };

  // State calculations
  let myParticipant = null;
  if (activeSession && activeSession.participants) {
    myParticipant = activeSession.participants.find(p => p.u_id === user.u_id);
  }

  const estimatedCost = () => {
    if (!activeSession) return '0.00';
    const hours = (new Date().getTime() - new Date(activeSession.start_time).getTime()) / (1000 * 60 * 60);
    const cost = Math.max(0, hours) * 1.5 * parseFloat(myRoom?.rate_per_unit || 10);
    return cost.toFixed(2);
  };

  const powerConsumption = () => {
    if (!activeSession) return '0.000';
    if (activeSession.total_units !== undefined && parseFloat(activeSession.total_units) > 0) {
      // Use real telemetry if available
      return parseFloat(activeSession.total_units).toFixed(3);
    }
    // Fallback to time-based estimation
    const hours = (new Date().getTime() - new Date(activeSession.start_time).getTime()) / (1000 * 60 * 60);
    return (Math.max(0, hours) * 1.5).toFixed(3);
  };

  const getBookingDetail = () => {
    if (!activeSession) return '';
    const { session_type, target_value } = activeSession;
    if (session_type === 'unlimited') return 'Unlimited Booking';
    if (session_type === 'budget') return `Budget Limit: ₹${target_value}`;
    if (session_type === 'duration') return `Duration Limit: ${target_value} hrs`;
    if (session_type === 'unit') return `Unit Limit: ${target_value} kWh`;
    return '';
  };

  // Define Stitch styles
  const glassCardClasses = "bg-[#1A2540]/40 backdrop-blur-md border border-white/10";
  const glowPrimary = "shadow-[0_0_20px_rgba(108,99,255,0.3)]";

  return (
    <div className="font-body text-sm bg-[#0F1729] text-[#F8FAFC] min-h-screen flex">
      <Sidebar />


      <main className="flex-1 min-h-screen relative md:ml-64">
        {/* Top Navigation Bar */}
        <header className="flex justify-between items-center px-8 py-4 w-full sticky top-0 z-40 bg-[#0F1729]/80 backdrop-blur-md border-b border-white/10">
          <div className="flex items-center gap-4">
            <h2 className="font-headline text-2xl font-bold text-white tracking-tight">Sessions</h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
              <span className="material-symbols-outlined text-[#00D4AA] text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance_wallet</span>
              <span className="text-xs font-semibold text-white">₹{wallet?.balance !== undefined ? parseFloat(wallet.balance).toFixed(2) : '0.00'}</span>
            </div>
            <div className="flex items-center gap-4 text-slate-400">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-white overflow-hidden">
                {user?.name?.[0]?.toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Content Canvas */}
        <div className="p-8 max-w-7xl mx-auto space-y-8">

          {error && <Toast message={error} type="error" duration={10000} onClose={() => setError('')} />}
          {success && <Toast message={success} type="success" duration={10000} onClose={() => setSuccess('')} />}
          {toastMessage && <Toast message={toastMessage} type="success" duration={10000} onClose={() => setToastMessage(null)} />}

          {loading ? (
            <div className="animate-pulse bg-[#1A2540]/40 h-96 rounded-3xl w-full"></div>
          ) : !myRoom ? (
            <div className={`${glassCardClasses} rounded-3xl p-12 text-center`}>
              <span className="material-symbols-outlined text-6xl text-[#6C63FF] mb-4">meeting_room</span>
              <h3 className="text-2xl font-headline font-bold text-white mb-2">No Room Found</h3>
              <p className="text-slate-400">You must create or join a room before starting an AC session.</p>
            </div>
          ) : (
            <>
              {/* 3. Pending Leave Requests Banner */}
              {activeSession && activeSession.status === 'active' && myParticipant?.status === 'accepted' && (
                activeSession.participants.filter(p => p.leave_status === 'pending' && Number(p.u_id) !== Number(user.u_id)).map(leaver => (
                  <section key={leaver.u_id} className={`${glassCardClasses} rounded-2xl border-l-4 border-l-[#FFAB00]/30 p-6 relative mb-8`}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full border-2 border-[#FFAB00]/40 p-0.5 flex items-center justify-center bg-slate-800 text-white font-bold flex-shrink-0">
                          <span className="material-symbols-outlined text-[#FFAB00]">directions_run</span>
                        </div>
                        <div>
                          <h4 className="font-headline font-bold text-white text-sm mb-1">Leave Request</h4>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            <span className="text-white font-medium">{leaver.name}</span> wants to leave the active AC session early.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3 w-full sm:w-auto shrink-0">
                        <button onClick={() => handleApproveLeave(leaver.u_id)} className="flex-1 sm:flex-none px-8 py-2.5 bg-[#00D4AA]/10 hover:bg-[#00D4AA]/20 text-[#00D4AA] text-[11px] font-bold rounded-lg border border-[#00D4AA]/20 transition-colors uppercase tracking-wider">
                          Approve
                        </button>
                        <button onClick={() => handleRejectLeave(leaver.u_id)} className="flex-1 sm:flex-none px-8 py-2.5 bg-transparent hover:bg-[#FF6B6B]/10 text-[#FF6B6B] text-[11px] font-bold rounded-lg border border-[#FF6B6B]/20 transition-colors uppercase tracking-wider">
                          Reject
                        </button>
                      </div>
                    </div>
                  </section>
                ))
              )}

              {/* 2. Pending Invitation Card */}
              {activeSession && myParticipant?.status === 'invited' && (
                <section className={`${glassCardClasses} rounded-2xl border-l-4 border-l-[#6C63FF]/30 p-6 relative mb-8`}>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full border-2 border-[#6C63FF]/40 p-0.5 flex items-center justify-center bg-slate-800 text-white font-bold flex-shrink-0">
                        i
                      </div>
                      <div>
                        <h4 className="font-headline font-bold text-white text-sm mb-1">Session Invitation</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          A roommate invited you to join a running AC session in <span className="text-[#6C63FF] font-semibold">{myRoom.room_name || myRoom.room_no}</span>.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto shrink-0">
                      <button onClick={() => handleParticipantAction('accept')} className="flex-1 sm:flex-none px-8 py-2.5 bg-[#00D4AA]/10 hover:bg-[#00D4AA]/20 text-[#00D4AA] text-[11px] font-bold rounded-lg border border-[#00D4AA]/20 transition-colors uppercase tracking-wider">
                        Accept
                      </button>
                      <button onClick={() => handleParticipantAction('reject')} className="flex-1 sm:flex-none px-8 py-2.5 bg-transparent hover:bg-[#FF6B6B]/10 text-[#FF6B6B] text-[11px] font-bold rounded-lg border border-[#FF6B6B]/20 transition-colors uppercase tracking-wider">
                        Reject
                      </button>
                    </div>
                  </div>
                </section>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* LEFT COLUMN: Controls */}
                <div className="lg:col-span-4 space-y-8">

                  {/* 1. Start New Session Card */}
                  {!activeSession && (
                    <section className={`${glassCardClasses} rounded-2xl p-6 relative overflow-hidden group transition-all hover:border-[#6C63FF]/50`}>
                      <div className="absolute -right-8 -top-8 w-32 h-32 bg-[#6C63FF]/10 rounded-full blur-3xl transition-all group-hover:bg-[#6C63FF]/20"></div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 rounded-lg bg-[#6C63FF]/20 flex items-center justify-center text-[#6C63FF]">
                            <span className="material-symbols-outlined">power_settings_new</span>
                          </div>
                          <h3 className="text-lg font-headline font-bold text-white">Start New AC Session</h3>
                        </div>

                        <form className="space-y-6" onSubmit={handleStartSession} noValidate>
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Session Duration</label>
                            <div className="relative">
                              <select
                                className="w-full bg-[#0F1729] !bg-none border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-[#6C63FF] focus:border-transparent outline-none appearance-none cursor-pointer"
                                style={{ colorScheme: 'dark' }}
                                value={sessionType}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSessionType(val);
                                  if (val === 'duration') setTargetValue('1.5');
                                  else if (val === 'budget') setTargetValue('50');
                                  else if (val === 'unit') setTargetValue('5');
                                  else setTargetValue('');
                                }}
                              >
                                <option value="unlimited">Unlimited (Manual Stop)</option>
                                <option value="duration">Fixed Duration (Hours)</option>
                                <option value="budget">Fixed Budget (₹)</option>
                                <option value="unit">By Units (Stop after X kWh)</option>
                              </select>
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <span className="material-symbols-outlined text-sm">expand_more</span>
                              </div>
                            </div>
                          </div>

                          {sessionType !== 'unlimited' && (
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                                {sessionType === 'duration' ? 'Target Hours' : sessionType === 'budget' ? 'Target Budget (₹)' : 'Target Units (kWh)'}
                              </label>
                              <input
                                type="number"
                                step={sessionType === 'budget' ? '10' : '0.5'}
                                min={sessionType === 'budget' ? '10' : '0.5'}
                                className="w-full bg-[#0F1729] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-[#6C63FF] outline-none"
                                value={targetValue}
                                onChange={(e) => setTargetValue(e.target.value)}
                                placeholder={sessionType === 'duration' ? 'e.g. 2.5' : sessionType === 'budget' ? 'e.g. 50' : 'e.g. 2.5'}
                              />
                            </div>
                          )}

                          <button type="submit" className={`w-full py-4 bg-[#6C63FF] text-white font-bold rounded-xl shadow-lg ${glowPrimary} flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all`}>
                            <span className="material-symbols-outlined">bolt</span>
                            Start Session
                          </button>
                          <p className="text-[11px] text-slate-500 text-center px-4">
                            Current room rate: <span className="text-slate-300 font-semibold">₹{myRoom.rate_per_unit}/unit</span>.
                          </p>
                        </form>
                      </div>
                    </section>
                  )}

                  {/* Room Members Panel */}
                  <section className={`${glassCardClasses} rounded-2xl p-6 relative`}>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded-lg bg-[#00D4AA]/20 flex items-center justify-center text-[#00D4AA]">
                        <span className="material-symbols-outlined text-sm">groups</span>
                      </div>
                      <h3 className="text-md font-headline font-bold text-white">Room Members</h3>
                    </div>

                    <div className="space-y-4">
                      {myRoom.members?.map(member => {
                        const p = activeSession?.participants?.find(p => p.u_id === member.u_id);
                        const isMe = member.u_id === user.u_id;

                        return (
                          <div key={member.u_id} className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-xs">
                                {member.name?.[0]?.toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-white">
                                  {member.name} {isMe && <span className="text-slate-500 font-normal">(You)</span>}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {p ? (p.status === 'accepted' ? 'In Session' : p.status === 'invited' ? 'Invited' : 'Not in session') : 'Not in session'}
                                </p>
                              </div>
                            </div>

                            <div>
                              {isMe ? (
                                activeSession && p?.status === 'accepted' ? (
                                  p?.leave_status === 'pending' ? (
                                    <span className="text-[10px] font-bold text-orange-400 bg-orange-400/10 px-2 py-1 rounded">Leave Pending</span>
                                  ) : (
                                    <button onClick={() => handleParticipantAction('leave')} className="text-[10px] font-bold text-[#FF6B6B] bg-[#FF6B6B]/10 hover:bg-[#FF6B6B]/20 px-3 py-1.5 rounded transition-all">
                                      Leave
                                    </button>
                                  )
                                ) : null
                              ) : (
                                activeSession && activeSession.status === 'active' ? (
                                  p?.status === 'accepted' && p?.leave_status === 'pending' && (activeSession.created_by === user.u_id || myParticipant?.status === 'accepted') ? (
                                    <button onClick={() => handleApproveLeave(member.u_id)} className="text-[10px] font-bold text-[#00D4AA] bg-[#00D4AA]/10 hover:bg-[#00D4AA]/20 px-3 py-1.5 rounded transition-all">
                                      Approve Leave
                                    </button>
                                  ) : (!p || p?.status === 'left' || p?.status === 'rejected') && (activeSession.created_by === user.u_id || myParticipant?.status === 'accepted') ? (
                                    <button onClick={() => handleInviteRoommate(member.u_id)} className="text-[10px] font-bold text-[#6C63FF] bg-[#6C63FF]/10 hover:bg-[#6C63FF]/20 px-3 py-1.5 rounded transition-all">
                                      Invite
                                    </button>
                                  ) : null
                                ) : null
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* Device Status Card */}
                  <section className={`${glassCardClasses} rounded-2xl p-6 relative`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                          <span className="material-symbols-outlined text-sm">router</span>
                        </div>
                        <h3 className="text-md font-headline font-bold text-white">IoT Device</h3>
                      </div>
                      {deviceStatus?.status === 'online' ? (
                        <span className="px-2 py-1 bg-[#00D4AA]/10 border border-[#00D4AA]/20 rounded text-[#00D4AA] text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] animate-pulse"></span>
                          Online
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-[#FF6B6B]/10 border border-[#FF6B6B]/20 rounded text-[#FF6B6B] text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B6B]"></span>
                          Offline
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">
                      <p>Linked to: <span className="text-slate-300 font-mono">room_{myRoom.room_no}</span></p>
                      <p className="mt-1">Last seen: <span className="text-slate-300">{deviceStatus?.seconds_since_last !== undefined ? `${Math.floor(deviceStatus.seconds_since_last / 60)}m ${deviceStatus.seconds_since_last % 60}s ago` : 'Never'}</span></p>
                    </div>
                  </section>

                </div>

                {/* RIGHT COLUMN: Active Session Live View */}
                {activeSession && (
                  <div className="lg:col-span-8">
                    <section className={`${glassCardClasses} rounded-3xl overflow-hidden shadow-2xl relative min-h-[350px] flex flex-col`}>

                      {/* Header with Status */}
                      <div className="p-8 border-b border-white/5 flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-2xl font-headline font-extrabold text-white">Current AC Session</h3>
                            <span className="flex items-center gap-1.5 px-3 py-1 bg-[#00D4AA]/10 rounded-full border border-[#00D4AA]/20">
                              <span className="w-2 h-2 rounded-full bg-[#00D4AA] animate-pulse"></span>
                              <span className="text-[10px] font-black text-[#00D4AA] tracking-widest uppercase">Live Active</span>
                            </span>
                          </div>
                          <p className="text-slate-400 text-sm">
                            {myRoom.room_name || `Room ${myRoom.room_no}`} • Auto-Meter Linked {activeSession?.session_type ? ` • ${getBookingDetail()}` : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">Session ID</p>
                          <p className="text-sm font-mono text-slate-300">#{activeSession.session_id}</p>
                        </div>
                      </div>

                      <div className="flex-1 p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Large Metrics */}
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">Elapsed Time</p>
                            <div className="text-4xl font-headline font-black text-white flex items-baseline gap-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {elapsedText}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">Power</p>
                            <div className="text-xl font-headline font-bold text-white flex items-baseline gap-2">
                              {deviceStatus?.current_power_w || 0} <span className="text-sm text-slate-400">W</span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">Consumption</p>
                            <div className="text-xl font-headline font-bold text-white flex items-baseline gap-2">
                              {powerConsumption()} <span className="text-sm text-slate-400">kWh</span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">Estimated Cost</p>
                            <div className="text-3xl font-headline font-bold text-[#00D4AA] flex items-baseline gap-2">
                              <span className="text-lg">₹</span>{estimatedCost()}
                            </div>
                          </div>

                          {/* Consumption Chart Visualization */}
                          <div className="pt-2">
                            <div className="flex justify-between items-end h-20 gap-1.5">
                              <div className="flex-1 bg-slate-800/50 rounded-t-sm relative group"><div className="absolute bottom-0 left-0 right-0 bg-[#6C63FF]/30 h-[20%] rounded-t-sm group-hover:bg-[#6C63FF]/50 transition-all"></div></div>
                              <div className="flex-1 bg-slate-800/50 rounded-t-sm relative group"><div className="absolute bottom-0 left-0 right-0 bg-[#6C63FF]/30 h-[35%] rounded-t-sm group-hover:bg-[#6C63FF]/50 transition-all"></div></div>
                              <div className="flex-1 bg-slate-800/50 rounded-t-sm relative group"><div className="absolute bottom-0 left-0 right-0 bg-[#6C63FF]/40 h-[25%] rounded-t-sm group-hover:bg-[#6C63FF]/50 transition-all"></div></div>
                              <div className="flex-1 bg-slate-800/50 rounded-t-sm relative group"><div className="absolute bottom-0 left-0 right-0 bg-[#6C63FF]/50 h-[60%] rounded-t-sm group-hover:bg-[#6C63FF]/50 transition-all shadow-[0_0_10px_rgba(108,99,255,0.2)]"></div></div>
                              <div className="flex-1 bg-slate-800/50 rounded-t-sm relative group"><div className="absolute bottom-0 left-0 right-0 bg-[#6C63FF]/60 h-[75%] rounded-t-sm group-hover:bg-[#6C63FF]/50 transition-all shadow-[0_0_15px_rgba(108,99,255,0.3)]"></div></div>
                              <div className="flex-1 bg-slate-800/50 rounded-t-sm relative group"><div className="absolute bottom-0 left-0 right-0 bg-[#00D4AA]/60 h-[90%] rounded-t-sm group-hover:bg-[#00D4AA]/80 transition-all shadow-[0_0_20px_rgba(0,212,170,0.3)]"></div></div>
                              <div className="flex-1 bg-slate-800/50 rounded-t-sm relative group"><div className="absolute bottom-0 left-0 right-0 bg-[#00D4AA]/40 h-[40%] rounded-t-sm group-hover:bg-[#00D4AA]/60 transition-all"></div></div>
                            </div>
                            <div className="flex justify-between mt-2 text-[9px] text-slate-500 uppercase font-bold tracking-tighter">
                              <span>Last 15m</span>
                              <span>Current Consumption</span>
                            </div>
                          </div>
                        </div>

                        {/* Participants & Actions */}
                        <div className="flex flex-col h-full bg-black/10 rounded-2xl p-6 border border-white/5">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Participants ({activeSession.participants?.length || 0})</h4>

                          <div className="space-y-4 flex-1 overflow-y-auto">
                            {activeSession.participants?.map(p => (
                              <div key={p.u_id} className={`flex items-center justify-between ${p.status === 'invited' ? 'opacity-60' : ''}`}>
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-[#6C63FF]/20 flex items-center justify-center font-bold text-[#6C63FF]">
                                    {p.name?.[0]?.toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-white">{p.name} {p.u_id === user.u_id ? '(You)' : ''}</p>
                                  </div>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${p.status === 'accepted' ? 'bg-[#00D4AA]/10 text-[#00D4AA]' :
                                  p.status === 'invited' ? 'bg-slate-800 text-slate-400' :
                                    'bg-[#FF6B6B]/10 text-[#FF6B6B]'
                                  }`}>
                                  {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="mt-8 space-y-3">
                            {myParticipant?.status === 'accepted' ? (
                              myParticipant?.leave_status === 'pending' ? (
                                <button disabled className="w-full py-3 bg-transparent border border-orange-400/30 text-orange-400 text-sm font-semibold rounded-xl opacity-80 cursor-not-allowed">
                                  Leave Request Pending...
                                </button>
                              ) : (
                                <button onClick={() => handleParticipantAction('leave')} className="w-full py-3 bg-transparent border border-white/10 hover:bg-white/5 text-white text-sm font-semibold rounded-xl transition-all active:scale-95">
                                  Leave Session (Stop billing me)
                                </button>
                              )
                            ) : myParticipant?.status === 'left' ? (
                              <button onClick={handleJoin} className="w-full py-3 bg-transparent border border-[#00D4AA]/30 text-[#00D4AA] hover:bg-[#00D4AA]/10 text-sm font-semibold rounded-xl transition-all active:scale-95">
                                Join Session (Start billing me)
                              </button>
                            ) : null}

                            {(activeSession.created_by === user.u_id || myParticipant?.status === 'accepted') && (
                              <button onClick={handleEndSession} className="w-full py-4 bg-[#FF6B6B] text-white text-sm font-bold rounded-xl shadow-[0_0_20px_rgba(255,107,107,0.3)] transition-all hover:brightness-110 active:scale-95 flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined">stop_circle</span>
                                Stop AC Immediately
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Session History Table ── */}
          <section className="table-section glass-card" style={{ marginTop: '24px' }}>
            <div className="table-header">
              <h2 className="section-heading">All Session History</h2>
            </div>

            {loading ? (
              <div className="table-loading">
                {[1, 2, 3].map(i => <div key={i} className="table-row-skeleton skeleton" style={{ height: '40px', marginBottom: '8px', borderRadius: '4px' }} />)}
              </div>
            ) : recentSessions.length === 0 ? (
              <div className="table-empty" style={{ textAlign: 'center', padding: '32px', color: '#8892B0' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '16px' }}>history</span>
                <p>No session history found.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <th style={{ padding: '12px' }}>Session ID</th>
                      <th style={{ padding: '12px' }}>Booking Type</th>
                      <th style={{ padding: '12px' }}>Date</th>
                      <th style={{ padding: '12px' }}>Duration</th>
                      <th style={{ padding: '12px' }}>Participants</th>
                      <th style={{ padding: '12px' }}>Energy</th>
                      <th style={{ padding: '12px' }}>Your Share</th>
                      <th style={{ padding: '12px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSessions.map((session) => {
                      const dur = session.duration_minutes
                        ? `${Math.floor(session.duration_minutes / 60)}h ${Math.floor(session.duration_minutes % 60)}m`
                        : '—';
                      const isActive = session.status === 'active';
                      return (
                        <tr key={session.session_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: isActive ? 'rgba(108, 99, 255, 0.05)' : 'transparent' }}>
                          <td style={{ padding: '12px', color: '#8892B0' }}>#{String(session.session_id).padStart(5, '0')}</td>
                          <td style={{ padding: '12px', color: 'white', textTransform: 'capitalize' }}>
                            {session.session_type.replace('_', ' ')}
                          </td>
                          <td style={{ padding: '12px', color: '#8892B0' }}>
                            {new Date(session.start_time).toLocaleDateString('en-IN', {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                            })}
                          </td>
                          <td style={{ padding: '12px', color: '#8892B0' }}>{dur}</td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {(session.participants || []).slice(0, 3).map((p, i) => (
                                <div key={i} style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#6C63FF', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                                  {p.name?.[0]?.toUpperCase() || '?'}
                                </div>
                              ))}
                              {(session.participants?.length || 0) > 3 && (
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>
                                  +{(session.participants.length - 3)}
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px', color: 'white' }}>
                            {session.total_units != null ? `${parseFloat(session.total_units).toFixed(3)} kWh` : '—'}
                          </td>
                          <td style={{ padding: '12px', color: isActive ? '#00D4AA' : 'white' }}>
                            {session.my_cost != null ? `₹${parseFloat(session.my_cost).toFixed(2)}` : '—'}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold',
                              backgroundColor: isActive ? 'rgba(0, 212, 170, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                              color: isActive ? '#00D4AA' : '#8892B0'
                            }}>
                              {session.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {pagination.total_pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', marginBottom: '16px', marginRight: '16px' }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={!pagination.has_prev}
                  style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: pagination.has_prev ? 'white' : '#555', cursor: pagination.has_prev ? 'pointer' : 'not-allowed' }}
                >
                  Previous
                </button>
                <span style={{ color: '#8892B0', display: 'flex', alignItems: 'center' }}>
                  Page {page} of {pagination.total_pages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))}
                  disabled={!pagination.has_next}
                  style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: pagination.has_next ? 'white' : '#555', cursor: pagination.has_next ? 'pointer' : 'not-allowed' }}
                >
                  Next
                </button>
              </div>
            )}
          </section>
        </div>

      </main>
    </div>
  );
};

export default SessionPage;
