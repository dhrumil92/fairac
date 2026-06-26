// =============================================================================
// src/pages/student/RoomPage.jsx
// My Room Dashboard - Stitch Design + React + Axios
// =============================================================================

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  const [wallet, setWallet] = useState(null);
  const [inviteIdentifier, setInviteIdentifier] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // States for State B: No Room
  const [invitations, setInvitations] = useState([]);

  // New Room Form
  const [newRoomNo, setNewRoomNo] = useState('');
  const [newRoomCapacity, setNewRoomCapacity] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchRoomData = async () => {
    setLoading(true);
    setError('');
    try {
      const [roomRes, walletRes] = await Promise.allSettled([
        api.get('/rooms/my'),
        api.get('/wallet')
      ]);

      if (walletRes.status === 'fulfilled') {
        const wData = walletRes.value.data.data;
        setWallet(wData.wallet || wData);
      }

      if (roomRes.status === 'fulfilled') {
        setRoom(roomRes.value.data.data.room || roomRes.value.data.data);
      } else {
        if (roomRes.reason?.response?.status === 404) {
          setRoom(null);
          fetchNoRoomData();
        } else {
          setError('Failed to load room data.');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const fetchNoRoomData = async () => {
    try {
      const invRes = await api.get('/rooms/invitations');
      setInvitations(invRes.data.data.invitations || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const handleLeaveRoomClick = () => {
    setShowLeaveConfirm(true);
  };

  const executeLeaveRoom = async () => {
    setShowLeaveConfirm(false);
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
    if (!newRoomNo || !newRoomCapacity) {
      setError('Please fill all fields to create a room.');
      return;
    }
    setIsCreating(true);
    try {
      const res = await api.post('/rooms', {
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
      {toastMessage && <Toast message={toastMessage} type="success" duration={10000} onClose={() => setToastMessage(null)} />}
      {error && <Toast message={error} type="error" duration={10000} onClose={() => setError('')} />}
      {successMsg && <Toast message={successMsg} type="success" duration={10000} onClose={() => setSuccessMsg('')} />}
      <main className="page-main" style={{ padding: '0' }}>
        {/* Top Navigation Bar */}
        <header className="flex justify-between items-center px-8 py-4 w-full sticky top-0 z-40 bg-[#0F1729]/80 backdrop-blur-md border-b border-white/10" style={{ marginBottom: '24px' }}>
          <div className="flex items-center gap-4">
            <h2 className="font-headline text-2xl font-bold text-white tracking-tight" style={{ marginLeft: '16px' }}>My Room</h2>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/wallet" className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 cursor-pointer rounded-full border border-white/10 transition-colors" style={{ textDecoration: 'none' }}>
              <span className="material-symbols-outlined text-[#00D4AA] text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance_wallet</span>
              <span className="text-xs font-semibold text-white">₹{wallet?.balance !== undefined ? parseFloat(wallet.balance).toFixed(2) : '0.00'}</span>
            </Link>
            <Link to="/profile" className="flex items-center gap-2 px-4 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 cursor-pointer rounded-full border border-white/10 transition-colors" style={{ textDecoration: 'none' }}>
              <span className="material-symbols-outlined text-sm text-slate-400">person</span>
              <span className="text-sm font-medium text-white">{user?.name}</span>
            </Link>
          </div>
        </header>

        <div style={{ padding: '0 40px 40px' }}>        {loading ? (
          <div style={{ color: '#fff' }}>Loading room data...</div>
        ) : room ? (
          /* SECTION 1: STATE A (HAS ROOM) */
          <section className="room-state-wrapper">
            

            <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
              {/* Left Column */}
              <div className="flex flex-col gap-6 w-full lg:w-7/12">
                {/* Room Info Card */}
                <div className="room-info-card glass-card">
                  <div className="room-bg-glow"></div>
                  <div className="room-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="material-symbols-outlined" style={{ color: '#6C63FF', fontSize: '18px' }}>apartment</span>
                      <span className="hostel-subtitle">{room.hostel_name || 'Hostel'}</span>
                    </div>
                    <div className="room-main-title">{room.room_name || `Room ${room.room_no}`}</div>
                  </div>
                  <div className="room-stats-grid">
                    <div className="stat-group">
                      <p className="label">Capacity</p>
                      <p className="value">{room.capacity} Persons</p>
                    </div>
                    <div className="stat-group">
                      <p className="label">Billing Rate</p>
                      <p className="value primary">₹{room.rate_per_unit}<span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 'normal' }}>/unit</span></p>
                    </div>
                  </div>
                </div>

                {/* Invite Section (Only Owner) */}
                {room.my_role === 'owner' && room.members?.length < room.capacity && (
                  <div className="glass-card" style={{ padding: '24px', borderRadius: '16px' }}>
                    <h3 className="section-heading" style={{ fontSize: '1rem', marginBottom: '16px' }}>Invite Roommate</h3>
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
              </div>

              {/* Right Column */}
              <div className="flex flex-col gap-6 w-full lg:w-5/12">
                {/* Room Members */}
                <div className="members-section">
                  <h3 className="section-heading" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="material-symbols-outlined" style={{ color: '#6C63FF' }}>group</span>
                    Room Members
                  </h3>
                  <div className="members-list">
                    {room.members && room.members.map((member) => {
                      const isOwner = member.role === 'owner';
                      return (
                        <div key={member.u_id} className="member-item glass-card" style={{ borderRadius: '16px' }}>
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

                {/* Leave Room */}
                <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                  <button className="btn-danger-outline" onClick={handleLeaveRoomClick}>
                    <span className="material-symbols-outlined">logout</span>
                    Leave Room
                  </button>
                </div>
              </div>
            </div>

            {/* Custom Confirm Modal for Leave Room */}
            {showLeaveConfirm && (
              <div className="modal-overlay">
                <div className="modal-content glass-card">
                  <h3 className="modal-title">Leave Room?</h3>
                  <p className="modal-body" style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '24px' }}>
                    Are you sure you want to leave this room? You will lose access to it and will need an invitation to rejoin.
                  </p>
                  <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button className="btn-outline" onClick={() => setShowLeaveConfirm(false)}>Cancel</button>
                    <button className="btn-danger" onClick={executeLeaveRoom}>Yes, Leave</button>
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : (
          /* SECTION 2: STATE B (NO ROOM) */
          <section className="room-state-wrapper">
            <div className="empty-state-wrapper glass-card" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: '48px', padding: '48px 32px', borderRadius: '16px', textAlign: 'left' }}>
              <div className="empty-state-icon" style={{ margin: 0, width: '180px', height: '180px', flexShrink: 0 }}>
                {/* SVG Illustration Placeholder or Image */}
                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBrxiW71ct2oRZmq-zXp37SCsJcpQrrJy0UVEfuTB49nHn_AZtZ0Q5SIPh46haVdyN0sF3sHqfwpqlY0Mo2ARbUw7e8S522KIqGeaAMSxaLSaDPKKEJYpu9TTkg7Yfn5Tr-7fXmBPHCKnpt21pLLedY0lAFEE3qlmvHhxLNNlcORwDZYzkehtwlsZXmwJuiwzoTXWFZcA6sfMtBVyeLY6522rFAlzbtjZ9f4YvbD1G3g2jiGEo0AP2eK-Iqr2eTiKP0kxoHcX-K5AA" alt="Empty Room" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div>
                <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '2rem', fontWeight: '800', color: '#fff', marginBottom: '12px' }}>You haven't joined a room yet.</h2>
                <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '1.1rem' }}>Create a new room or check your invitations to get started.</p>
              </div>
            </div>

            {/* Pending Invitations */}
            {invitations.length > 0 && (
              <div className="invitations-section">
                <h3 className="section-heading" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#FB923C' }}>
                  <span className="material-symbols-outlined">notifications</span>
                  Pending Invitations
                </h3>
                <div className="members-list">
                  {invitations.map(inv => (
                    <div key={inv.invitation_id} className="invite-card glass-card" style={{ borderRadius: '16px' }}>
                      <div className="invite-info">
                        <div className="invite-icon">
                          <span className="material-symbols-outlined">person_add</span>
                        </div>
                        <div className="member-details">
                          <p style={{ color: '#fff', fontSize: '0.95rem' }}>
                            <span style={{ fontWeight: 'bold' }}>{inv.invited_by_name || `User ID: ${inv.sent_by}`}</span> invited you to <span style={{ color: '#6C63FF', fontWeight: 'bold' }}>{inv.room_name || `Room ${inv.room_no}`}</span>
                          </p>
                          <p style={{ marginTop: '4px' }}>Status: Pending</p>
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
            <div className="create-room-card glass-card" style={{ borderRadius: '16px' }}>
              <div className="create-room-header">
                <div className="create-room-icon">
                  <span className="material-symbols-outlined">add_home</span>
                </div>
                <h3>Create New Room</h3>
              </div>
              <form className="room-form" onSubmit={handleCreateRoom}>
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
                <button type="submit" className="btn-primary-block" disabled={isCreating} style={{ marginTop: '8px' }}>
                  {isCreating ? 'Creating...' : 'Create Room'}
                </button>
              </form>
            </div>
          </section>
        )}
        </div>
      </main>
    </div>
  );
};

export default RoomPage;
