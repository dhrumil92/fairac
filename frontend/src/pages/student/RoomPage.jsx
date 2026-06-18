// =============================================================================
// src/pages/student/RoomPage.jsx
// My Room Dashboard - Stitch Design + React + Axios
// =============================================================================

import { useState, useEffect } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import Toast from '../../components/ui/Toast';
import './StudentPages.css'; // Inherit layout utilities
import './RoomPage.css'; // Room specific styling

const RoomPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  // States for State A: Has Room
  const [room, setRoom] = useState(null);
  const [inviteIdentifier, setInviteIdentifier] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  // States for State B: No Room
  const [hostels, setHostels] = useState([]);
  const [invitations, setInvitations] = useState([]);
  
  // New Room Form
  const [newRoomHostelId, setNewRoomHostelId] = useState('');
  const [newRoomNo, setNewRoomNo] = useState('');
  const [newRoomCapacity, setNewRoomCapacity] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchRoomData = async () => {
    setLoading(true);
    setError('');
    try {
      // Check if user has a room
      const roomRes = await api.get('/rooms/my');
      setRoom(roomRes.data.data.room);
    } catch (err) {
      if (err.response?.status === 404) {
        // No room found, so fetch hostels and pending invitations
        setRoom(null);
        fetchNoRoomData();
      } else {
        setError('Failed to load room data.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchNoRoomData = async () => {
    try {
      const [hostelsRes, invRes] = await Promise.all([
        api.get('/rooms/hostels'),
        api.get('/rooms/invitations')
      ]);
      setHostels(hostelsRes.data.data.hostels || []);
      setInvitations(invRes.data.data.invitations || []);
      
      if (hostelsRes.data.data.hostels?.length > 0) {
        setNewRoomHostelId(hostelsRes.data.data.hostels[0].hostel_id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchRoomData();
  }, []);

  const clearMessages = () => {
    setError('');
    setSuccessMsg('');
  };

  // --- Handlers for Active Room ---
  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteIdentifier.trim()) return;
    clearMessages();
    setIsInviting(true);
    try {
      const res = await api.post('/rooms/invite', {
        room_id: room.r_id,
        identifier: inviteIdentifier
      });
      setToastMessage(res.data.message);
      setInviteIdentifier('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send invite.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!window.confirm('Are you sure you want to leave this room?')) return;
    clearMessages();
    try {
      await api.patch(`/rooms/${room.r_id}/leave`);
      setSuccessMsg('Successfully left the room.');
      setRoom(null);
      fetchNoRoomData(); // load the no-room state data
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to leave room.');
    }
  };

  // --- Handlers for No Room State ---
  const handleCreateRoom = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!newRoomHostelId || !newRoomNo || !newRoomCapacity) {
      setError('Please fill all fields to create a room.');
      return;
    }
    setIsCreating(true);
    try {
      const res = await api.post('/rooms', {
        hostel_id: parseInt(newRoomHostelId, 10),
        room_no: newRoomNo,
        room_name: `Room ${newRoomNo}`,
        capacity: parseInt(newRoomCapacity, 10),
        rate_per_unit: 10.50 // Default mocked value for MVP
      });
      setSuccessMsg(res.data.message);
      fetchRoomData(); // Reload to get room details
    } catch (err) {
      if (err.response?.data?.errors) {
        setError(err.response.data.errors.map(e => e.message).join(' | '));
      } else {
        setError(err.response?.data?.message || 'Failed to create room.');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleInvitationAction = async (invitationId, action) => {
    clearMessages();
    try {
      const endpoint = action === 'accept' ? '/rooms/invite/accept' : '/rooms/invite/reject';
      const res = await api.post(endpoint, { invitation_id: invitationId });
      setSuccessMsg(res.data.message);
      if (action === 'accept') {
        fetchRoomData(); // User is now in a room
      } else {
        // Remove invitation from list
        setInvitations(invitations.filter(i => i.invitation_id !== invitationId));
      }
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${action} invitation.`);
    }
  };

  return (
    <div className="page-layout">
      <Sidebar />
      {toastMessage && <Toast message={toastMessage} duration={10000} onClose={() => setToastMessage(null)} />}
      <main className="page-main">
        {error && <div className="page-error" style={{marginBottom: '20px', padding: '12px', background: 'rgba(255, 107, 107, 0.1)', color: '#FF6B6B', borderRadius: '8px', border: '1px solid rgba(255, 107, 107, 0.2)'}}>⚠️ {error}</div>}
        {successMsg && <div className="page-success" style={{marginBottom: '20px', padding: '12px', background: 'rgba(0, 212, 170, 0.1)', color: '#00D4AA', borderRadius: '8px', border: '1px solid rgba(0, 212, 170, 0.2)'}}>✅ {successMsg}</div>}

        {loading ? (
          <div style={{color: '#fff'}}>Loading room data...</div>
        ) : room ? (
          /* SECTION 1: STATE A (HAS ROOM) */
          <section className="room-state-wrapper">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <h2 className="page-title">My Room</h2>
              <span className="status-badge active">Active Room</span>
            </div>

            {/* Room Info Card */}
            <div className="room-info-card glass-card">
              <div className="room-bg-glow"></div>
              <div className="room-header">
                <span className="room-number-label">{room.room_name || `Room ${room.room_no}`}</span>
                <div className="hostel-name">{room.hostel_name || 'Hostel'}</div>
              </div>
              <div className="room-stats-grid">
                <div className="stat-group">
                  <p className="label">Capacity</p>
                  <p className="value">{room.capacity} Persons</p>
                </div>
                <div className="stat-group">
                  <p className="label">Billing Rate</p>
                  <p className="value primary">₹{room.rate_per_unit}<span style={{fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 'normal'}}>/unit</span></p>
                </div>
              </div>
            </div>

            {/* Room Members */}
            <div className="members-section">
              <h3 className="section-heading" style={{marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                <span className="material-symbols-outlined" style={{color: '#6C63FF'}}>group</span>
                Room Members
              </h3>
              <div className="members-list">
                {room.members && room.members.map((member) => {
                  const isOwner = member.role === 'owner';
                  return (
                    <div key={member.u_id} className="member-item glass-card" style={{borderRadius: '16px'}}>
                      <div className="member-info">
                        <div className={`member-avatar ${isOwner ? 'owner' : 'member'}`}>
                          <span className="material-symbols-outlined">person</span>
                        </div>
                        <div className="member-details">
                          <h4>{member.name} {user?.u_id === member.u_id ? '(You)' : ''}</h4>
                          <p>{member.email}</p>
                        </div>
                      </div>
                      <span className={`role-badge ${isOwner ? 'owner' : 'member'}`}>
                        {isOwner ? 'Owner' : 'Member'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Invite Section (Only Owner) */}
            {room.my_role === 'owner' && (
              <div className="glass-card" style={{padding: '24px', borderRadius: '16px'}}>
                <h3 className="section-heading" style={{fontSize: '1rem', marginBottom: '16px'}}>Invite Roommate</h3>
                <form className="form-row" onSubmit={handleInvite}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Email or Mobile"
                    value={inviteIdentifier}
                    onChange={(e) => setInviteIdentifier(e.target.value)}
                  />
                  <button type="submit" className="btn-primary-sm" disabled={isInviting}>
                    {isInviting ? 'Sending...' : 'Send Invite'}
                  </button>
                </form>
              </div>
            )}

            {/* Leave Room */}
            <div style={{marginTop: '16px'}}>
              <button className="btn-danger-outline" onClick={handleLeaveRoom}>
                <span className="material-symbols-outlined">logout</span>
                Leave Room
              </button>
            </div>
          </section>
        ) : (
          /* SECTION 2: STATE B (NO ROOM) */
          <section className="room-state-wrapper">
            <div className="empty-state-wrapper">
              <div className="empty-state-icon">
                {/* SVG Illustration Placeholder or Image */}
                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBrxiW71ct2oRZmq-zXp37SCsJcpQrrJy0UVEfuTB49nHn_AZtZ0Q5SIPh46haVdyN0sF3sHqfwpqlY0Mo2ARbUw7e8S522KIqGeaAMSxaLSaDPKKEJYpu9TTkg7Yfn5Tr-7fXmBPHCKnpt21pLLedY0lAFEE3qlmvHhxLNNlcORwDZYzkehtwlsZXmwJuiwzoTXWFZcA6sfMtBVyeLY6522rFAlzbtjZ9f4YvbD1G3g2jiGEo0AP2eK-Iqr2eTiKP0kxoHcX-K5AA" alt="Empty Room" style={{width: '100%', height: '100%', objectFit: 'contain'}} />
              </div>
              <h2>You haven't joined a room yet.</h2>
              <p>Create a new room or check your invitations to get started.</p>
            </div>

            {/* Pending Invitations */}
            {invitations.length > 0 && (
              <div className="invitations-section">
                <h3 className="section-heading" style={{marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#FB923C'}}>
                  <span className="material-symbols-outlined">notifications</span>
                  Pending Invitations
                </h3>
                <div className="members-list">
                  {invitations.map(inv => (
                    <div key={inv.invitation_id} className="invite-card glass-card" style={{borderRadius: '16px'}}>
                      <div className="invite-info">
                        <div className="invite-icon">
                          <span className="material-symbols-outlined">person_add</span>
                        </div>
                        <div className="member-details">
                          <p style={{color: '#fff', fontSize: '0.95rem'}}>
                            <span style={{fontWeight: 'bold'}}>{inv.invited_by_name || `User ID: ${inv.sent_by}`}</span> invited you to <span style={{color: '#6C63FF', fontWeight: 'bold'}}>{inv.room_name || `Room ${inv.room_no}`}</span>
                          </p>
                          <p style={{marginTop: '4px'}}>Status: Pending</p>
                        </div>
                      </div>
                      <div className="invite-actions">
                        <button className="btn-success" onClick={() => handleInvitationAction(inv.invitation_id, 'accept')}>Accept</button>
                        <button className="btn-danger" onClick={() => handleInvitationAction(inv.invitation_id, 'reject')}>Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Create New Room */}
            <div className="create-room-card glass-card" style={{borderRadius: '16px'}}>
              <div className="create-room-header">
                <div className="create-room-icon">
                  <span className="material-symbols-outlined">add_home</span>
                </div>
                <h3>Create New Room</h3>
              </div>
              <form className="room-form" onSubmit={handleCreateRoom}>
                <div className="form-group-col">
                  <label>Select Hostel</label>
                  <select className="input-field" value={newRoomHostelId} onChange={e => setNewRoomHostelId(e.target.value)} required>
                    <option value="" disabled>Select a hostel</option>
                    {hostels.map(h => (
                      <option key={h.hostel_id} value={h.hostel_id}>{h.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid-cols-2">
                  <div className="form-group-col">
                    <label>Room Number</label>
                    <input type="text" className="input-field" placeholder="e.g. 204" value={newRoomNo} onChange={e => setNewRoomNo(e.target.value)} required />
                  </div>
                  <div className="form-group-col">
                    <label>Capacity</label>
                    <input type="number" className="input-field" placeholder="2-4" min="1" max="10" value={newRoomCapacity} onChange={e => setNewRoomCapacity(e.target.value)} required />
                  </div>
                </div>
                <button type="submit" className="btn-primary-block" disabled={isCreating} style={{marginTop: '8px'}}>
                  {isCreating ? 'Creating...' : 'Create Room'}
                </button>
              </form>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default RoomPage;
