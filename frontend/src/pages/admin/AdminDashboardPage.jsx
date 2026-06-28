import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/layout/Sidebar';
import api from '../../api/axios';
import Toast from '../../components/ui/Toast';

const AdminDashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  const [confirmStopId, setConfirmStopId] = useState(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [overviewRes, sessionsRes, roomsRes, studentsRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/sessions/active'),
        api.get('/admin/rooms'),
        api.get('/admin/students')
      ]);

      setOverview(overviewRes.data.data.overview);
      setActiveSessions(sessionsRes.data.data.sessions || []);
      setRooms(roomsRes.data.data.rooms ? roomsRes.data.data.rooms.slice(0, 5) : []);
      setStudents(studentsRes.data.data.students ? studentsRes.data.data.students.slice(0, 5) : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Simulate real-time data fetch every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleForceStop = (sessionId) => {
    setConfirmStopId(sessionId);
  };

  const confirmForceStop = async () => {
    if (!confirmStopId) return;
    try {
      const res = await api.post(`/sessions/${confirmStopId}/end`, { total_units: 0 });
      setToastMessage(res.data?.message || 'Session force stopped successfully.');
      fetchData();
      setConfirmStopId(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to end session');
      setConfirmStopId(null);
    }
  };

  if (isLoading && !overview) {
    return (
      <div className="page-layout" style={{ backgroundColor: '#0F1729', minHeight: '100vh', display: 'flex' }}>
        <Sidebar />
        <main className="page-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6C63FF' }}>
          <h2>Loading Dashboard...</h2>
        </main>
      </div>
    );
  }

  return (
    <div className="page-layout" style={{ backgroundColor: '#0F1729', color: '#F8FAFC', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar />
      <main className="page-main" style={{ padding: '0' }}>
        
        {/* Top Navigation Bar */}
        <header className="flex justify-between items-center px-8 py-4 w-full sticky top-0 z-40 bg-[#0F1729]/80 backdrop-blur-md border-b border-white/10" style={{ marginBottom: '24px' }}>
          <div className="flex flex-col gap-1" style={{ marginLeft: '16px' }}>
            <h2 className="font-headline text-2xl font-bold text-white tracking-tight m-0 leading-none">Admin Overview</h2>
            <p className="text-slate-400 text-sm m-0 mt-1 leading-none">Welcome back. Here is what's happening with the system today.</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-800/50 rounded-full border border-white/10">
              <span className="material-symbols-outlined text-sm text-slate-400">admin_panel_settings</span>
              <span className="text-sm font-medium text-white">{user?.name}</span>
            </div>
          </div>
        </header>

        <div style={{ padding: '0 40px 40px' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {error && <Toast message={error} type="error" onClose={() => setError('')} />}
          {toastMessage && <Toast message={toastMessage} type="success" onClose={() => setToastMessage(null)} />}

          {/* Top Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
            <StatCard icon="group" title="Total Students" value={overview?.total_students || 0} color="#6C63FF" onClick={() => navigate('/admin/students')} />
            <StatCard icon="meeting_room" title="Total Rooms" value={overview?.total_rooms || 0} color="#F59E0B" onClick={() => navigate('/admin/rooms')} />
            <StatCard icon="bolt" title="Active Sessions" value={overview?.active_sessions || 0} color="#6C63FF" highlight onClick={() => navigate('/admin/sessions')} />
            <StatCard icon="energy_savings_leaf" title="Monthly Power (kWh)" value={overview?.total_units_consumed || 0} color="#06B6D4" />
            <StatCard icon="payments" title="Total Billed" value={`₹${overview?.total_billed || 0}`} color="#00D4AA" />
            <StatCard icon="account_balance" title="Wallet Pool" value={`₹${overview?.total_recharged || 0}`} color="#6366F1" />
          </div>

          {/* Live System Overview */}
          <section className="glass-card" style={{ padding: '32px', borderRadius: '24px', backgroundColor: 'rgba(26, 37, 64, 0.6)', border: '1px solid rgba(108, 99, 255, 0.2)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(108, 99, 255, 0.1), transparent)', pointerEvents: 'none' }}></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '32px', position: 'relative', zIndex: 10 }}>
              <div style={{ maxWidth: '400px' }}>
                <div style={{ display: 'inline-flex', items: 'center', gap: '8px', padding: '4px 12px', borderRadius: '9999px', backgroundColor: 'rgba(108,99,255,0.2)', color: '#6C63FF', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6C63FF' }}></span> Live System Metrics
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', marginBottom: '8px', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Real-time Performance</h2>
                <p style={{ color: '#94A3B8', fontSize: '14px' }}>Aggregated live tracking of all IoT-enabled AC units.</p>
              </div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <LiveMetricCard value={overview?.total_rooms || 0} label="Active Rooms" />
                <LiveMetricCard value={overview?.active_sessions || 0} label="Live Sessions" />
                <LiveMetricCard value={overview?.total_students || 0} label="Students" />
                <LiveMetricCard value={`${overview?.total_units_consumed || 0}`} label="kW Power" color="#6C63FF" />
                <LiveMetricCard value={`₹${overview?.total_billed || 0}`} label="Cost" color="#00D4AA" bg="rgba(0, 212, 170, 0.1)" borderColor="rgba(0, 212, 170, 0.2)" />
              </div>
            </div>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
            {/* Main Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              
              {/* Room Activity Table */}
              <div className="glass-card" style={{ borderRadius: '24px', overflow: 'hidden' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Room Management</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8' }}>
                      <tr>
                        <th style={{ padding: '16px 24px' }}>Room #</th>
                        <th style={{ padding: '16px 24px' }}>Members</th>
                        <th style={{ padding: '16px 24px' }}>Active Sessions</th>
                        <th style={{ padding: '16px 24px', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody style={{ divideY: '1px solid rgba(255,255,255,0.05)' }}>
                      {rooms.length === 0 ? (
                        <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>No rooms found</td></tr>
                      ) : rooms.map(room => (
                        <tr key={room.r_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: '500', color: 'white' }}>{room.room_no}</td>
                          <td style={{ padding: '16px 24px', fontSize: '14px', color: '#CBD5E1' }}>{room.member_count}</td>
                          <td style={{ padding: '16px 24px' }}>
                            {room.active_sessions > 0 
                              ? <span style={{ padding: '4px 8px', borderRadius: '9999px', backgroundColor: 'rgba(0, 212, 170, 0.1)', color: '#00D4AA', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Active</span>
                              : <span style={{ padding: '4px 8px', borderRadius: '9999px', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#94A3B8', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Inactive</span>
                            }
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                            <button onClick={() => navigate('/admin/rooms')} className="hover:opacity-80 hover:scale-105 transition-all duration-200" style={{ padding: '6px 16px', backgroundColor: '#6C63FF', color: 'white', fontSize: '12px', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>View Details</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Student Directory Table */}
              <div className="glass-card" style={{ borderRadius: '24px', overflow: 'hidden' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Student Directory</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8' }}>
                      <tr>
                        <th style={{ padding: '16px 24px' }}>Student</th>
                        <th style={{ padding: '16px 24px' }}>Room</th>
                        <th style={{ padding: '16px 24px' }}>Wallet Bal.</th>
                        <th style={{ padding: '16px 24px', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody style={{ divideY: '1px solid rgba(255,255,255,0.05)' }}>
                      {students.length === 0 ? (
                        <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>No students found</td></tr>
                      ) : students.map(st => (
                        <tr key={st.u_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '16px 24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(108, 99, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6C63FF', fontSize: '12px', fontWeight: 'bold' }}>
                                {st.name.substring(0, 2).toUpperCase()}
                              </div>
                              <span style={{ fontSize: '14px', fontWeight: '500', color: 'white' }}>{st.name}</span>
                            </div>
                          </td>
                          <td style={{ padding: '16px 24px', fontSize: '14px', color: '#CBD5E1' }}>{st.room_no || 'None'}</td>
                          <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: '600', color: parseFloat(st.balance) > 100 ? '#00D4AA' : '#FF6B6B' }}>₹{st.balance || 0}</td>
                          <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                            <button onClick={() => navigate('/admin/students')} className="hover:opacity-80 hover:scale-105 transition-all duration-200" style={{ padding: '6px 16px', backgroundColor: '#6C63FF', color: 'white', fontSize: '12px', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>View Details</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              
              {/* Active Sessions Panel */}
              <div className="glass-card" style={{ borderRadius: '24px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Running Sessions</h3>
                    <span style={{ padding: '4px 8px', borderRadius: '4px', backgroundColor: 'rgba(108,99,255,0.2)', color: '#6C63FF', fontSize: '10px', fontWeight: 'bold' }}>{activeSessions.length} LIVE</span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#94A3B8' }}>Critical control for ongoing usage</p>
                </div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '400px', overflowY: 'auto' }}>
                  {activeSessions.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#64748B', fontSize: '14px', padding: '20px 0' }}>No active sessions.</p>
                  ) : activeSessions.map(session => (
                    <div key={session.session_id} style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(0, 212, 170, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00D4AA' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>hvac</span>
                        </div>
                        <div>
                          <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: 'white', margin: 0 }}>Room {session.room_no}</h4>
                          <p style={{ fontSize: '10px', color: '#94A3B8', margin: '4px 0 0 0' }}>Started: {Math.floor(session.running_minutes)} mins ago</p>
                        </div>
                      </div>
                      <button onClick={() => handleForceStop(session.session_id)} className="hover:opacity-80 hover:scale-105 transition-all duration-200" style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#FF6B6B', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>power_settings_new</span>
                        <span style={{ fontSize: '10px', fontWeight: 'bold' }}>STOP</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Wallet Management Quick Actions */}
              <div className="glass-card" style={{ borderRadius: '24px', padding: '24px', borderLeft: '4px solid #00D4AA' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', marginBottom: '16px', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Wallet Management</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button onClick={() => navigate('/admin/wallet')} className="hover:opacity-80 hover:scale-105 transition-all duration-200" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderRadius: '12px', backgroundColor: '#6C63FF', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', boxShadow: '0 4px 12px rgba(108, 99, 255, 0.2)' }}>
                    <span className="material-symbols-outlined">add_circle</span> Manual Credit Transfer
                  </button>
                  <button onClick={() => navigate('/admin/wallet')} className="hover:bg-white/10 transition-colors duration-200" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                    <span className="material-symbols-outlined">receipt_long</span> View Master Ledger
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
      </main>

      {confirmStopId && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#1A2540', padding: '32px', borderRadius: '24px', maxWidth: '400px', width: '90%', border: '1px solid rgba(255,107,107,0.2)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', color: '#FF6B6B' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>warning</span>
              <h3 style={{ margin: 0, color: 'white', fontSize: '22px', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Force Stop Session?</h3>
            </div>
            <p style={{ color: '#94A3B8', fontSize: '15px', marginBottom: '32px', lineHeight: '1.5' }}>Are you sure you want to forcibly stop this AC session? The current consumption will be billed to the participants.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setConfirmStopId(null)} className="hover:bg-white/10 transition-colors duration-200" style={{ padding: '10px 20px', backgroundColor: 'transparent', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
              <button onClick={confirmForceStop} className="hover:opacity-80 hover:scale-105 transition-all duration-200" style={{ padding: '10px 20px', backgroundColor: '#FF6B6B', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>power_settings_new</span>
                Confirm Stop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon, title, value, color, highlight, onClick }) => (
  <div 
    className="glass-card" 
    style={{ 
      padding: '24px', 
      borderRadius: '16px', 
      borderLeft: highlight ? `2px solid ${color}` : 'none',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.2s ease'
    }}
    onClick={onClick}
    onMouseOver={onClick ? e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.transform = 'scale(1.02)'; } : undefined}
    onMouseOut={onClick ? e => { e.currentTarget.style.background = 'rgba(26, 37, 64, 0.4)'; e.currentTarget.style.transform = 'scale(1)'; } : undefined}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: `${color}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color }}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      {highlight && (
        <span style={{ display: 'flex', height: '8px', width: '8px', position: 'relative' }}>
          <span style={{ animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite', position: 'absolute', display: 'inline-flex', height: '100%', width: '100%', borderRadius: '50%', backgroundColor: color, opacity: 0.75 }}></span>
          <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', height: '8px', width: '8px', backgroundColor: color }}></span>
        </span>
      )}
    </div>
    <p style={{ color: '#94A3B8', fontSize: '12px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px 0' }}>{title}</p>
    <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', fontFamily: '"Plus Jakarta Sans", sans-serif', margin: 0 }}>{value}</h3>
  </div>
);

const LiveMetricCard = ({ value, label, color = 'white', bg = 'rgba(255,255,255,0.05)', borderColor = 'rgba(255,255,255,0.05)' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 24px', borderRadius: '16px', backgroundColor: bg, border: `1px solid ${borderColor}`, minWidth: '120px' }}>
    <span style={{ fontSize: '24px', fontWeight: 'bold', color: color }}>{value}</span>
    <span style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: '600', marginTop: '4px' }}>{label}</span>
  </div>
);

export default AdminDashboardPage;
