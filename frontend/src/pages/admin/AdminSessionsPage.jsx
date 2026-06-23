import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/layout/Sidebar';
import api from '../../api/axios';
import Toast from '../../components/ui/Toast';

const AdminSessionsPage = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  const [confirmStopId, setConfirmStopId] = useState(null);

  const fetchSessions = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/admin/sessions/active');
      setSessions(res.data.data.sessions || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleForceStop = (sessionId) => {
    setConfirmStopId(sessionId);
  };

  const confirmForceStop = async () => {
    if (!confirmStopId) return;
    try {
      const res = await api.post(`/sessions/${confirmStopId}/end`, { total_units: 0 });
      setToastMessage(res.data?.message || 'Session force stopped successfully.');
      fetchSessions();
      setConfirmStopId(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to end session');
      setConfirmStopId(null);
    }
  };

  return (
    <div className="page-layout" style={{ backgroundColor: '#0F1729', color: '#F8FAFC', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar />
      <main className="page-main" style={{ padding: '40px', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '30px', fontWeight: 'bold', fontFamily: '"Plus Jakarta Sans", sans-serif', color: 'white' }}>Active Sessions</h2>
              <p style={{ color: '#94A3B8', fontSize: '14px' }}>Monitor and manage live AC sessions across the hostel.</p>
            </div>
          </header>

          {error && <Toast message={error} type="error" onClose={() => setError('')} />}
          {toastMessage && <Toast message={toastMessage} type="success" onClose={() => setToastMessage(null)} />}

          <div className="glass-card" style={{ borderRadius: '24px', backgroundColor: 'rgba(26, 37, 64, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8' }}>
                  <tr>
                    <th style={{ padding: '16px 24px' }}>Room</th>
                    <th style={{ padding: '16px 24px' }}>Started By</th>
                    <th style={{ padding: '16px 24px' }}>Start Time</th>
                    <th style={{ padding: '16px 24px' }}>Duration</th>
                    <th style={{ padding: '16px 24px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody style={{ divideY: '1px solid rgba(255,255,255,0.05)' }}>
                  {isLoading ? (
                    <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>Loading...</td></tr>
                  ) : sessions.length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>No active sessions right now</td></tr>
                  ) : sessions.map(session => (
                    <tr key={session.session_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '16px 24px', fontWeight: 'bold' }}>Room {session.room_no}</td>
                      <td style={{ padding: '16px 24px' }}>{session.creator_name}</td>
                      <td style={{ padding: '16px 24px' }}>{new Date(session.start_time).toLocaleTimeString()}</td>
                      <td style={{ padding: '16px 24px', color: '#00D4AA' }}>{Math.floor(session.running_minutes)} mins</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <button onClick={() => handleForceStop(session.session_id)} className="hover:opacity-80 hover:scale-105 transition-all duration-200" style={{ padding: '8px 16px', backgroundColor: '#FF6B6B', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                          Force Stop
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

export default AdminSessionsPage;
