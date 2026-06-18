import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/layout/Sidebar';
import api from '../../api/axios';

const AdminRoomsPage = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRooms = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/admin/rooms');
      setRooms(res.data.data.rooms || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load rooms');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  return (
    <div className="page-layout" style={{ backgroundColor: '#0F1729', color: '#F8FAFC', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar />
      <main className="page-main" style={{ padding: '40px', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Header */}
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '30px', fontWeight: 'bold', fontFamily: '"Plus Jakarta Sans", sans-serif', color: 'white' }}>Room Management</h2>
              <p style={{ color: '#94A3B8', fontSize: '14px' }}>Overview of all hostel rooms, occupancy, and active AC sessions.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button style={{ padding: '10px 20px', backgroundColor: '#6C63FF', color: 'white', fontWeight: 'bold', borderRadius: '12px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                Add New Room
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 12px', backgroundColor: '#1A2540', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}>
                <span className="material-symbols-outlined" style={{ color: '#6C63FF' }}>admin_panel_settings</span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: 'white' }}>{user?.name}</span>
              </div>
            </div>
          </header>

          {error && <div style={{ padding: '16px', backgroundColor: 'rgba(255,107,107,0.1)', color: '#FF6B6B', borderRadius: '12px' }}>{error}</div>}

          {/* Rooms Grid / Table */}
          <div className="glass-card" style={{ borderRadius: '24px', backgroundColor: 'rgba(26, 37, 64, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>All Rooms ({rooms.length})</h3>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8' }}>
                  <tr>
                    <th style={{ padding: '16px 24px' }}>Room Number</th>
                    <th style={{ padding: '16px 24px' }}>Capacity / Occupancy</th>
                    <th style={{ padding: '16px 24px' }}>Active Sessions</th>
                    <th style={{ padding: '16px 24px' }}>Rate / Unit</th>
                    <th style={{ padding: '16px 24px' }}>Status</th>
                    <th style={{ padding: '16px 24px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody style={{ divideY: '1px solid rgba(255,255,255,0.05)' }}>
                  {isLoading && rooms.length === 0 ? (
                    <tr><td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>Loading rooms...</td></tr>
                  ) : rooms.length === 0 ? (
                    <tr><td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>No rooms found</td></tr>
                  ) : rooms.map(room => (
                    <tr key={room.r_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
                            <span className="material-symbols-outlined">meeting_room</span>
                          </div>
                          <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'white' }}>Room {room.room_no}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: 'white' }}>{room.member_count}</span>
                          <span style={{ fontSize: '12px', color: '#94A3B8' }}>/ {room.capacity}</span>
                          {parseInt(room.member_count) >= parseInt(room.capacity) && (
                            <span style={{ marginLeft: '8px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', fontSize: '10px', fontWeight: 'bold' }}>FULL</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        {parseInt(room.active_sessions) > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#00D4AA' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>hvac</span>
                            <span style={{ fontSize: '14px', fontWeight: '600' }}>{room.active_sessions} Running</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '14px', color: '#94A3B8' }}>None</span>
                        )}
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '500', color: '#CBD5E1' }}>₹{parseFloat(room.rate_per_unit || 0).toFixed(2)} / kWh</span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        {room.is_active 
                          ? <span style={{ padding: '4px 8px', borderRadius: '9999px', backgroundColor: 'rgba(0, 212, 170, 0.1)', color: '#00D4AA', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Active</span>
                          : <span style={{ padding: '4px 8px', borderRadius: '9999px', backgroundColor: 'rgba(255, 107, 107, 0.1)', color: '#FF6B6B', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Inactive</span>
                        }
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <button style={{ padding: '8px', backgroundColor: 'transparent', color: '#6C63FF', border: '1px solid rgba(108, 99, 255, 0.3)', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>settings</span>
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

export default AdminRoomsPage;
