import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/layout/Sidebar';
import api from '../../api/axios';

const AdminSessionsPage = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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

  const handleForceStop = async (sessionId) => {
    if (!window.confirm('Are you sure you want to force stop this session?')) return;
    try {
      await api.post(`/sessions/${sessionId}/end`, { total_units: 1 });
      fetchSessions();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to end session');
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

          {error && <div style={{ padding: '16px', backgroundColor: 'rgba(255,107,107,0.1)', color: '#FF6B6B', borderRadius: '12px' }}>{error}</div>}

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
                      <td style={{ padding: '16px 24px' }}>{session.started_by_name}</td>
                      <td style={{ padding: '16px 24px' }}>{new Date(session.start_time).toLocaleTimeString()}</td>
                      <td style={{ padding: '16px 24px', color: '#00D4AA' }}>{Math.floor(session.running_minutes)} mins</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <button onClick={() => handleForceStop(session.session_id)} style={{ padding: '8px 16px', backgroundColor: '#FF6B6B', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
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
    </div>
  );
};

export default AdminSessionsPage;
