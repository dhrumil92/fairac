import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/layout/Sidebar';
import api from '../../api/axios';

const AdminRoomsPage = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal States
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [roomDetails, setRoomDetails] = useState(null);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');
  const [inviteIdentifier, setInviteIdentifier] = useState('');

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

  const fetchRoomDetails = async (roomId) => {
    try {
      setIsModalLoading(true);
      setModalError('');
      setModalSuccess('');
      const res = await api.get(`/admin/rooms/${roomId}`);
      setRoomDetails(res.data.data);
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to load room details');
    } finally {
      setIsModalLoading(false);
    }
  };

  const openSettings = (roomId) => {
    setSelectedRoomId(roomId);
    fetchRoomDetails(roomId);
  };

  const closeSettings = () => {
    setSelectedRoomId(null);
    setRoomDetails(null);
    setInviteIdentifier('');
    setModalError('');
    setModalSuccess('');
    fetchRooms(); // Refresh main list to update capacities/sessions
  };

  const handleRemoveMember = async (u_id) => {
    if (!window.confirm("Are you sure you want to remove this student from the room?")) return;
    try {
      setModalError('');
      setModalSuccess('');
      const res = await api.patch(`/admin/rooms/${selectedRoomId}/remove-member`, { u_id });
      setModalSuccess(res.data.message);
      fetchRoomDetails(selectedRoomId); // Refresh modal data
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleInviteStudent = async (e) => {
    e.preventDefault();
    if (!inviteIdentifier.trim()) return;
    try {
      setModalError('');
      setModalSuccess('');
      const res = await api.post(`/admin/rooms/${selectedRoomId}/invite`, { student_identifier: inviteIdentifier.trim() });
      setModalSuccess(res.data.message);
      setInviteIdentifier('');
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to send invitation');
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
                        <button 
                          onClick={() => openSettings(room.r_id)}
                          style={{ padding: '8px', backgroundColor: 'transparent', color: '#6C63FF', border: '1px solid rgba(108, 99, 255, 0.3)', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
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

        {/* Room Settings Modal */}
        {selectedRoomId && (
          <div className="modal-overlay" style={{ zIndex: 2000 }}>
            <div className="modal-content glass-card" style={{ maxWidth: '600px', backgroundColor: '#1A2540' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 className="modal-title" style={{ margin: 0 }}>Room Settings</h3>
                <button onClick={closeSettings} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {isModalLoading ? (
                <div style={{ color: '#94A3B8', textAlign: 'center', padding: '20px' }}>Loading details...</div>
              ) : roomDetails ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* Room Status Banner */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Room Number</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>{roomDetails.room.room_no}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Capacity</div>
                      <div style={{ fontSize: '16px', color: 'white' }}>{roomDetails.members.length} / {roomDetails.room.capacity}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '4px' }}>Status</div>
                      <div style={{ color: roomDetails.room.is_active ? '#00D4AA' : '#FF6B6B', fontWeight: 'bold' }}>
                        {roomDetails.room.is_active ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                  </div>

                  {modalError && <div style={{ padding: '12px', backgroundColor: 'rgba(255,107,107,0.1)', color: '#FF6B6B', borderRadius: '8px', fontSize: '14px' }}>{modalError}</div>}
                  {modalSuccess && <div style={{ padding: '12px', backgroundColor: 'rgba(0,212,170,0.1)', color: '#00D4AA', borderRadius: '8px', fontSize: '14px' }}>{modalSuccess}</div>}

                  {/* Members List */}
                  <div>
                    <h4 style={{ fontSize: '14px', color: '#CBD5E1', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Members</h4>
                    {roomDetails.members.length === 0 ? (
                      <div style={{ color: '#64748B', fontSize: '14px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>Room is empty.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {roomDetails.members.map(member => (
                          <div key={member.u_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div>
                              <div style={{ color: 'white', fontWeight: '500', fontSize: '15px' }}>{member.name} {member.role === 'owner' && <span style={{ color: '#F59E0B', fontSize: '12px', marginLeft: '8px' }}>(Owner)</span>}</div>
                              <div style={{ color: '#94A3B8', fontSize: '12px' }}>{member.email} | {member.mobile}</div>
                            </div>
                            <button 
                              onClick={() => handleRemoveMember(member.u_id)}
                              style={{ padding: '6px 12px', backgroundColor: 'rgba(255,107,107,0.1)', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.2)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add Student Section */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '24px' }}>
                    <h4 style={{ fontSize: '14px', color: '#CBD5E1', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invite Student</h4>
                    <form onSubmit={handleInviteStudent} style={{ display: 'flex', gap: '12px' }}>
                      <input 
                        type="text" 
                        placeholder="Enter Student Email or Mobile..." 
                        value={inviteIdentifier}
                        onChange={(e) => setInviteIdentifier(e.target.value)}
                        style={{ flex: 1, padding: '10px 16px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', fontSize: '14px' }}
                        required
                      />
                      <button 
                        type="submit"
                        disabled={roomDetails.members.length >= roomDetails.room.capacity}
                        style={{ padding: '10px 20px', backgroundColor: roomDetails.members.length >= roomDetails.room.capacity ? '#475569' : '#6C63FF', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: roomDetails.members.length >= roomDetails.room.capacity ? 'not-allowed' : 'pointer' }}
                      >
                        Send Invite
                      </button>
                    </form>
                    {roomDetails.members.length >= roomDetails.room.capacity && (
                      <div style={{ color: '#F59E0B', fontSize: '12px', marginTop: '8px' }}>Cannot invite: Room is at full capacity.</div>
                    )}
                  </div>

                </div>
              ) : null}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminRoomsPage;
