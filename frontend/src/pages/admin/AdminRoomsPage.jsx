import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/layout/Sidebar';
import api from '../../api/axios';

// Generates page numbers to show: always First, Last, current ±1, with '...' gaps
const getPaginationRange = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  const addPage = (p) => { if (!pages.includes(p)) pages.push(p); };
  addPage(1);
  if (current > 3) pages.push('...');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) addPage(p);
  if (current < total - 2) pages.push('...');
  addPage(total);
  return pages;
};

const AdminRoomsPage = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Room Number Filter
  const [filterRoomNo, setFilterRoomNo] = useState('all');
  const [isRoomDropdownOpen, setIsRoomDropdownOpen] = useState(false);
  const roomDropdownRef = useRef(null);
  const portalRoomDropdownRef = useRef(null);
  const [roomDropdownRect, setRoomDropdownRect] = useState(null);

  // Active Session Filter
  const [filterSession, setFilterSession] = useState('all');
  const [isSessionDropdownOpen, setIsSessionDropdownOpen] = useState(false);
  const sessionDropdownRef = useRef(null);
  const portalSessionDropdownRef = useRef(null);
  const [sessionDropdownRect, setSessionDropdownRect] = useState(null);

  // Status Filter
  const [filterStatus, setFilterStatus] = useState('all');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef(null);
  const portalStatusDropdownRef = useRef(null);
  const [statusDropdownRect, setStatusDropdownRect] = useState(null);

  const [roomPage, setRoomPage] = useState(1);
  const ROOMS_PER_PAGE = 7;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (roomDropdownRef.current && !roomDropdownRef.current.contains(event.target) && (!portalRoomDropdownRef.current || !portalRoomDropdownRef.current.contains(event.target))) setIsRoomDropdownOpen(false);
      if (sessionDropdownRef.current && !sessionDropdownRef.current.contains(event.target) && (!portalSessionDropdownRef.current || !portalSessionDropdownRef.current.contains(event.target))) setIsSessionDropdownOpen(false);
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target) && (!portalStatusDropdownRef.current || !portalStatusDropdownRef.current.contains(event.target))) setIsStatusDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredRooms = rooms.filter(r => {
    if (filterRoomNo !== 'all' && String(r.room_no) !== String(filterRoomNo)) return false;
    if (filterSession === 'active' && parseInt(r.active_sessions) === 0) return false;
    if (filterSession === 'inactive' && parseInt(r.active_sessions) > 0) return false;
    if (filterStatus === 'active' && r.is_active !== true) return false;
    if (filterStatus === 'inactive' && r.is_active !== false) return false;
    return true;
  });

  // Modal States
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [roomDetails, setRoomDetails] = useState(null);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');
  const [inviteIdentifier, setInviteIdentifier] = useState('');

  // Add Room Modal States
  const [isAddRoomModalOpen, setIsAddRoomModalOpen] = useState(false);
  const [newRoomNo, setNewRoomNo] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCapacity, setNewRoomCapacity] = useState('');
  const [addRoomError, setAddRoomError] = useState('');
  const [isAddingRoom, setIsAddingRoom] = useState(false);

  // Global Room Settings Modal States
  const [isGlobalSettingsOpen, setIsGlobalSettingsOpen] = useState(false);
  const [globalSettingsTab, setGlobalSettingsTab] = useState('overview'); // 'overview' | 'add' | 'danger'
  const [globalSettingsMsg, setGlobalSettingsMsg] = useState({ type: '', text: '' });
  const [isBulkToggling, setIsBulkToggling] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);

  const handleAddRoom = async (e) => {
    e.preventDefault();
    if (!newRoomNo.trim() || !newRoomCapacity) return;
    try {
      setIsAddingRoom(true);
      setAddRoomError('');
      await api.post('/admin/rooms', {
        room_no: newRoomNo.trim(),
        room_name: newRoomName.trim(),
        capacity: parseInt(newRoomCapacity)
      });
      setNewRoomNo('');
      setNewRoomName('');
      setNewRoomCapacity('');
      setGlobalSettingsMsg({ type: 'success', text: 'Room created successfully!' });
      setGlobalSettingsTab('overview');
      fetchRooms();
    } catch (err) {
      setAddRoomError(err.response?.data?.message || 'Failed to add room');
    } finally {
      setIsAddingRoom(false);
    }
  };

  const handleBulkToggle = async (is_active) => {
    try {
      setIsBulkToggling(true);
      setGlobalSettingsMsg({ type: '', text: '' });
      const res = await api.post('/admin/rooms/bulk-toggle', { is_active });
      setGlobalSettingsMsg({ type: 'success', text: res.data.message });
      fetchRooms();
    } catch (err) {
      setGlobalSettingsMsg({ type: 'error', text: err.response?.data?.message || 'Operation failed.' });
    } finally {
      setIsBulkToggling(false);
      setShowDeactivateConfirm(false);
    }
  };

  const openGlobalSettings = () => {
    setIsGlobalSettingsOpen(true);
    setGlobalSettingsTab('overview');
    setGlobalSettingsMsg({ type: '', text: '' });
    setShowDeactivateConfirm(false);
  };

  const fetchRooms = async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      const res = await api.get('/admin/rooms');
      setRooms(res.data.data.rooms || []);
    } catch (err) {
      if (!isSilent) setError(err.response?.data?.message || 'Failed to load rooms');
    } finally {
      if (!isSilent) setIsLoading(false);
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

  const handleToggleRoomStatus = async () => {
    if (!roomDetails) return;
    try {
      setModalError('');
      setModalSuccess('');
      const newStatus = !roomDetails.room.is_active;
      const res = await api.post(`/admin/rooms/${selectedRoomId}/toggle-status`, { is_active: newStatus });
      setModalSuccess(res.data.message);
      fetchRoomDetails(selectedRoomId); // Refresh modal data
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to toggle room status');
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
    const interval = setInterval(() => {
      fetchRooms(true); // silent fetch
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="page-layout" style={{ backgroundColor: '#0F1729', color: '#F8FAFC', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar />
      <main className="page-main" style={{ padding: '0' }}>

        {/* Top Navigation Bar */}
        <header className="flex justify-between items-center px-8 py-4 w-full sticky top-0 z-40 bg-[#0F1729]/80 backdrop-blur-md border-b border-white/10" style={{ marginBottom: '24px' }}>
          <div className="flex flex-col gap-1" style={{ marginLeft: '16px' }}>
            <h2 className="font-headline text-2xl font-bold text-white tracking-tight m-0 leading-none">Room Management</h2>
            <p className="text-slate-400 text-sm m-0 mt-1 leading-none">Overview of all hostel rooms, occupancy, and active AC sessions.</p>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={openGlobalSettings}
              style={{ padding: '8px 16px', backgroundColor: 'rgba(108, 99, 255, 0.15)', color: '#A5B4FC', fontWeight: 'bold', borderRadius: '12px', border: '1px solid rgba(108, 99, 255, 0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>settings</span>
              Room Settings
            </button>
            <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-800/50 rounded-full border border-white/10">
              <span className="material-symbols-outlined text-sm text-slate-400">admin_panel_settings</span>
              <span className="text-sm font-medium text-white">{user?.name} (Admin)</span>
            </div>
          </div>
        </header>

        <div style={{ padding: '0 40px 40px' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {error && <div style={{ padding: '16px', backgroundColor: 'rgba(255,107,107,0.1)', color: '#FF6B6B', borderRadius: '12px' }}>{error}</div>}

            {/* Rooms Grid / Table */}
            <div className="glass-card" style={{ borderRadius: '24px', backgroundColor: 'rgba(26, 37, 64, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8' }}>
                    <tr>
                      <th style={{ padding: '16px 24px' }}>
                        <div ref={roomDropdownRef} style={{ position: 'relative', display: 'inline-block', width: '150px' }}>
                          <div
                            className="bg-[#0F1729] border border-white/10 rounded-lg py-1.5 px-3 text-xs text-white cursor-pointer flex justify-between items-center hover:border-white/20 transition-colors"
                            onClick={() => {
                              if (!isRoomDropdownOpen && roomDropdownRef.current) setRoomDropdownRect(roomDropdownRef.current.getBoundingClientRect());
                              setIsRoomDropdownOpen(!isRoomDropdownOpen);
                            }}
                            style={{ height: '31px' }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {filterRoomNo === 'all' ? `ROOM: ALL (${rooms.length})` : `ROOM: ${filterRoomNo}`}
                            </span>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#6C63FF' }}>keyboard_arrow_down</span>
                          </div>
                          {isRoomDropdownOpen && roomDropdownRect && createPortal(
                            <div
                              ref={portalRoomDropdownRef}
                              style={{
                                position: 'fixed', top: roomDropdownRect.bottom + 4, left: roomDropdownRect.left, width: roomDropdownRect.width,
                                backgroundColor: '#0F1729', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px', zIndex: 9999, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden'
                              }}
                            >
                              <div
                                style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', color: filterRoomNo === 'all' ? 'white' : '#8892B0', backgroundColor: filterRoomNo === 'all' ? 'rgba(108, 99, 255, 0.2)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)', position: 'sticky', top: 0, zIndex: 10 }}
                                onMouseEnter={(e) => { if (filterRoomNo !== 'all') e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)' }}
                                onMouseLeave={(e) => { if (filterRoomNo !== 'all') e.currentTarget.style.backgroundColor = 'transparent' }}
                                onClick={() => { setFilterRoomNo('all'); setRoomPage(1); setIsRoomDropdownOpen(false); }}
                              >
                                ROOM: ALL ({rooms.length})
                              </div>
                              <div style={{ maxHeight: '270px', overflowY: 'auto' }}>
                                {rooms.map(r => r.room_no).map(no => (
                                  <div
                                    key={no}
                                    style={{ padding: '10px 12px', fontSize: '12px', cursor: 'pointer', color: String(filterRoomNo) === String(no) ? 'white' : '#8892B0', backgroundColor: String(filterRoomNo) === String(no) ? 'rgba(108, 99, 255, 0.2)' : 'transparent' }}
                                    onMouseEnter={(e) => { if (String(filterRoomNo) !== String(no)) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)' }}
                                    onMouseLeave={(e) => { if (String(filterRoomNo) !== String(no)) e.currentTarget.style.backgroundColor = 'transparent' }}
                                    onClick={() => { setFilterRoomNo(no); setRoomPage(1); setIsRoomDropdownOpen(false); }}
                                  >
                                    {no}
                                  </div>
                                ))}
                              </div>
                            </div>, document.body
                          )}
                        </div>
                      </th>                    <th style={{ padding: '16px 24px' }}>
                        <div ref={sessionDropdownRef} style={{ position: 'relative', display: 'inline-block', width: '160px' }}>
                          <div
                            className="bg-[#0F1729] border border-white/10 rounded-lg py-1.5 px-3 text-xs text-white cursor-pointer flex justify-between items-center hover:border-white/20 transition-colors"
                            onClick={() => {
                              if (!isSessionDropdownOpen && sessionDropdownRef.current) setSessionDropdownRect(sessionDropdownRef.current.getBoundingClientRect());
                              setIsSessionDropdownOpen(!isSessionDropdownOpen);
                            }}
                            style={{ height: '31px' }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {filterSession === 'all' ? 'SESSIONS: ALL' : filterSession === 'active' ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#6C63FF' }}>keyboard_arrow_down</span>
                          </div>
                          {isSessionDropdownOpen && sessionDropdownRect && createPortal(
                            <div
                              ref={portalSessionDropdownRef}
                              style={{
                                position: 'fixed', top: sessionDropdownRect.bottom + 4, left: sessionDropdownRect.left, width: sessionDropdownRect.width,
                                backgroundColor: '#0F1729', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px', zIndex: 9999, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden'
                              }}
                            >
                              {['all', 'active', 'inactive'].map(opt => (
                                <div
                                  key={opt}
                                  style={{ padding: '10px 12px', fontSize: '12px', fontWeight: opt === 'all' ? 'bold' : 'normal', cursor: 'pointer', color: filterSession === opt ? 'white' : '#8892B0', backgroundColor: filterSession === opt ? 'rgba(108, 99, 255, 0.2)' : 'transparent', borderBottom: opt === 'all' ? '1px solid rgba(255,255,255,0.1)' : 'none' }}
                                  onMouseEnter={(e) => { if (filterSession !== opt) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)' }}
                                  onMouseLeave={(e) => { if (filterSession !== opt) e.currentTarget.style.backgroundColor = 'transparent' }}
                                  onClick={() => { setFilterSession(opt); setRoomPage(1); setIsSessionDropdownOpen(false); }}
                                >
                                  {opt === 'all' ? 'SESSIONS: ALL' : opt.toUpperCase()}
                                </div>
                              ))}
                            </div>, document.body
                          )}
                        </div>
                      </th>
                      <th style={{ padding: '16px 24px' }}>
                        <div ref={statusDropdownRef} style={{ position: 'relative', display: 'inline-block', width: '140px' }}>
                          <div
                            className="bg-[#0F1729] border border-white/10 rounded-lg py-1.5 px-3 text-xs text-white cursor-pointer flex justify-between items-center hover:border-white/20 transition-colors"
                            onClick={() => {
                              if (!isStatusDropdownOpen && statusDropdownRef.current) setStatusDropdownRect(statusDropdownRef.current.getBoundingClientRect());
                              setIsStatusDropdownOpen(!isStatusDropdownOpen);
                            }}
                            style={{ height: '31px' }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {filterStatus === 'all' ? 'STATUS: ALL' : filterStatus === 'active' ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#6C63FF' }}>keyboard_arrow_down</span>
                          </div>
                          {isStatusDropdownOpen && statusDropdownRect && createPortal(
                            <div
                              ref={portalStatusDropdownRef}
                              style={{
                                position: 'fixed', top: statusDropdownRect.bottom + 4, left: statusDropdownRect.left, width: statusDropdownRect.width,
                                backgroundColor: '#0F1729', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px', zIndex: 9999, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden'
                              }}
                            >
                              {['all', 'active', 'inactive'].map(opt => (
                                <div
                                  key={opt}
                                  style={{ padding: '10px 12px', fontSize: '12px', fontWeight: opt === 'all' ? 'bold' : 'normal', cursor: 'pointer', color: filterStatus === opt ? 'white' : '#8892B0', backgroundColor: filterStatus === opt ? 'rgba(108, 99, 255, 0.2)' : 'transparent', borderBottom: opt === 'all' ? '1px solid rgba(255,255,255,0.1)' : 'none' }}
                                  onMouseEnter={(e) => { if (filterStatus !== opt) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)' }}
                                  onMouseLeave={(e) => { if (filterStatus !== opt) e.currentTarget.style.backgroundColor = 'transparent' }}
                                  onClick={() => { setFilterStatus(opt); setRoomPage(1); setIsStatusDropdownOpen(false); }}
                                >
                                  {opt === 'all' ? 'STATUS: ALL' : opt.toUpperCase()}
                                </div>
                              ))}
                            </div>, document.body
                          )}
                        </div>
                      </th>
                      <th style={{ padding: '16px 24px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody style={{ divideY: '1px solid rgba(255,255,255,0.05)' }}>
                    {(() => {
                      const totalPages = Math.ceil(filteredRooms.length / ROOMS_PER_PAGE);
                      const paginatedRooms = filteredRooms.slice((roomPage - 1) * ROOMS_PER_PAGE, roomPage * ROOMS_PER_PAGE);

                      if (isLoading && rooms.length === 0) return (
                        <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>Loading rooms...</td></tr>
                      );
                      if (filteredRooms.length === 0) return (
                        <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>No rooms found</td></tr>
                      );
                      return (
                        <>
                          {paginatedRooms.map(room => (
                            <tr key={room.r_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '16px 24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
                                    <span className="material-symbols-outlined">meeting_room</span>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'white', lineHeight: '1' }}>Room {room.room_no}</span>
                                      <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 'normal' }}>({room.member_count}/{room.capacity})</span>
                                      {parseInt(room.member_count) >= parseInt(room.capacity) && (
                                        <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', fontSize: '10px', fontWeight: 'bold' }}>FULL</span>
                                      )}
                                    </div>
                                    {room.device_status === 'online' ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#00D4AA' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>wifi</span>
                                        <span style={{ fontSize: '11px', fontWeight: '600', lineHeight: '1' }}>Online</span>
                                      </div>
                                    ) : room.device_status === 'offline' ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#FF6B6B' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>wifi_off</span>
                                        <span style={{ fontSize: '11px', fontWeight: '600', lineHeight: '1' }}>Offline</span>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748B' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>device_unknown</span>
                                        <span style={{ fontSize: '11px', fontWeight: '600', lineHeight: '1' }}>Unassigned</span>
                                      </div>
                                    )}
                                  </div>
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
                          {totalPages > 1 && (
                            <tr>
                              <td colSpan="4" style={{ padding: '16px 24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                                    Showing {(roomPage - 1) * ROOMS_PER_PAGE + 1}–{Math.min(roomPage * ROOMS_PER_PAGE, filteredRooms.length)} of {filteredRooms.length}
                                  </span>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button
                                      onClick={() => setRoomPage(p => Math.max(1, p - 1))}
                                      disabled={roomPage === 1}
                                      style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)', color: roomPage === 1 ? '#475569' : 'white', fontSize: '12px', cursor: roomPage === 1 ? 'not-allowed' : 'pointer' }}
                                    >← Prev</button>
                                    {getPaginationRange(roomPage, totalPages).map((p, i) =>
                                      p === '...'
                                        ? <span key={`ellipsis-${i}`} style={{ padding: '5px 4px', color: '#64748B', fontSize: '12px' }}>…</span>
                                        : <button key={p} onClick={() => setRoomPage(p)} style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid', fontSize: '12px', cursor: 'pointer', fontWeight: p === roomPage ? 'bold' : 'normal', borderColor: p === roomPage ? '#6C63FF' : 'rgba(255,255,255,0.1)', backgroundColor: p === roomPage ? 'rgba(108,99,255,0.2)' : 'rgba(255,255,255,0.05)', color: p === roomPage ? '#6C63FF' : 'white' }}>{p}</button>
                                    )}
                                    <button
                                      onClick={() => setRoomPage(p => Math.min(totalPages, p + 1))}
                                      disabled={roomPage === totalPages}
                                      style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)', color: roomPage === totalPages ? '#475569' : 'white', fontSize: '12px', cursor: roomPage === totalPages ? 'not-allowed' : 'pointer' }}
                                    >Next →</button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })()}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ color: roomDetails.room.is_active ? '#00D4AA' : '#FF6B6B', fontWeight: 'bold' }}>
                            {roomDetails.room.is_active ? 'Active' : 'Inactive'}
                          </div>
                          <button
                            onClick={handleToggleRoomStatus}
                            style={{ padding: '4px 8px', backgroundColor: roomDetails.room.is_active ? 'rgba(255,107,107,0.1)' : 'rgba(0,212,170,0.1)', color: roomDetails.room.is_active ? '#FF6B6B' : '#00D4AA', border: `1px solid ${roomDetails.room.is_active ? 'rgba(255,107,107,0.2)' : 'rgba(0,212,170,0.2)'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                          >
                            {roomDetails.room.is_active ? 'Deactivate' : 'Activate'}
                          </button>
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
                    {roomDetails.members.length < parseInt(roomDetails.room.capacity || 0) && (
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
                            style={{ padding: '10px 20px', backgroundColor: '#6C63FF', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                          >
                            Send Invite
                          </button>
                        </form>
                      </div>
                    )}

                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Global Room Settings Modal */}
          {isGlobalSettingsOpen && (
            <div className="modal-overlay" style={{ zIndex: 2000 }} onClick={(e) => { if (e.target === e.currentTarget) setIsGlobalSettingsOpen(false); }}>
              <div className="modal-content glass-card" style={{ maxWidth: '540px', width: '100%', backgroundColor: '#1A2540', padding: '0', overflow: 'hidden', borderRadius: '20px' }}>

                {/* Modal Header */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', backgroundColor: 'rgba(108, 99, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#6C63FF' }}>settings</span>
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: 'white' }}>Room Settings</h3>
                      <p style={{ margin: 0, fontSize: '11px', color: '#64748B' }}>Manage all hostel rooms globally</p>
                    </div>
                  </div>
                  <button onClick={() => setIsGlobalSettingsOpen(false)} style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', padding: '4px' }}>
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                  {[
                    { id: 'overview', icon: 'bar_chart', label: 'Overview' },
                    { id: 'add', icon: 'add_circle', label: 'Add Room' },
                    { id: 'danger', icon: 'warning', label: 'Danger Zone' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => { setGlobalSettingsTab(tab.id); setGlobalSettingsMsg({ type: '', text: '' }); }}
                      style={{
                        flex: 1, padding: '14px 8px', background: 'transparent', border: 'none', cursor: 'pointer',
                        color: globalSettingsTab === tab.id ? (tab.id === 'danger' ? '#FF6B6B' : '#6C63FF') : '#64748B',
                        borderBottom: globalSettingsTab === tab.id ? `2px solid ${tab.id === 'danger' ? '#FF6B6B' : '#6C63FF'}` : '2px solid transparent',
                        fontWeight: globalSettingsTab === tab.id ? '700' : '400', fontSize: '13px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{tab.icon}</span>
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div style={{ padding: '20px 24px', height: '437px', overflowY: 'auto' }}>

                  {/* Global message */}
                  {globalSettingsMsg.text && (
                    <div style={{
                      padding: '12px 16px', borderRadius: '10px', marginBottom: '20px', fontSize: '14px', fontWeight: '500',
                      backgroundColor: globalSettingsMsg.type === 'success' ? 'rgba(0, 212, 170, 0.1)' : 'rgba(255, 107, 107, 0.1)',
                      color: globalSettingsMsg.type === 'success' ? '#00D4AA' : '#FF6B6B',
                      border: `1px solid ${globalSettingsMsg.type === 'success' ? 'rgba(0,212,170,0.2)' : 'rgba(255,107,107,0.2)'}`,
                    }}>
                      {globalSettingsMsg.text}
                    </div>
                  )}

                  {/* ── Tab 1: Overview ── */}
                  {globalSettingsTab === 'overview' && (() => {
                    const totalRooms = rooms.length;
                    const activeRooms = rooms.filter(r => r.is_active).length;
                    const inactiveRooms = rooms.filter(r => !r.is_active).length;
                    const activeSessions = rooms.reduce((sum, r) => sum + parseInt(r.active_sessions || 0), 0);
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64748B' }}>Live snapshot of all rooms in this hostel.</p>
                        {[
                          { label: 'Total Rooms', value: totalRooms, icon: 'meeting_room', color: '#F59E0B' },
                          { label: 'Active Rooms', value: activeRooms, icon: 'check_circle', color: '#00D4AA' },
                          { label: 'Inactive Rooms', value: inactiveRooms, icon: 'cancel', color: '#FF6B6B' },
                          { label: 'Active AC Sessions', value: activeSessions, icon: 'hvac', color: '#6C63FF' },
                        ].map(stat => (
                          <div key={stat.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: stat.color }}>{stat.icon}</span>
                              <span style={{ fontSize: '14px', color: '#CBD5E1' }}>{stat.label}</span>
                            </div>
                            <span style={{ fontSize: '20px', fontWeight: '700', color: 'white' }}>{stat.value}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* ── Tab 2: Add Room ── */}
                  {globalSettingsTab === 'add' && (
                    <form onSubmit={handleAddRoom} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#64748B' }}>Add a new room to your hostel. The rate per unit is inherited automatically.</p> */}
                      {addRoomError && <div style={{ padding: '12px', backgroundColor: 'rgba(255,107,107,0.1)', color: '#FF6B6B', borderRadius: '8px', fontSize: '14px' }}>{addRoomError}</div>}
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Room Number *</label>
                        <input type="text" value={newRoomNo} onChange={(e) => setNewRoomNo(e.target.value)} placeholder="e.g. 101, A-1"
                          style={{ width: '100%', padding: '12px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', boxSizing: 'border-box' }} required />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Room Name (Optional)</label>
                        <input type="text" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="e.g. Deluxe Suite"
                          style={{ width: '100%', padding: '12px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: '#94A3B8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Capacity *</label>
                        <input type="number" value={newRoomCapacity} onChange={(e) => setNewRoomCapacity(e.target.value)} placeholder="Max number of students" min="1"
                          style={{ width: '100%', padding: '12px', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', boxSizing: 'border-box' }} required />
                      </div>
                      <button type="submit" disabled={isAddingRoom}
                        style={{ marginTop: '4px', width: '100%', padding: '14px', backgroundColor: isAddingRoom ? '#475569' : '#6C63FF', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: isAddingRoom ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                        {isAddingRoom ? 'Creating...' : 'Create Room'}
                      </button>
                    </form>
                  )}

                  {/* ── Tab 3: Danger Zone ── */}
                  {globalSettingsTab === 'danger' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#64748B' }}>These actions affect all rooms in your hostel simultaneously. Use with caution.</p>

                      {/* Activate All */}
                      <div style={{ padding: '20px', borderRadius: '14px', backgroundColor: 'rgba(0, 212, 170, 0.05)', border: '1px solid rgba(0, 212, 170, 0.15)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#00D4AA', marginTop: '2px' }}>check_circle</span>
                          <div>
                            <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'white' }}>Activate All Rooms</p>
                            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94A3B8', lineHeight: '1.5' }}>All rooms will be made available. Students will be able to start AC sessions immediately.</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleBulkToggle(true)}
                          disabled={isBulkToggling}
                          style={{ width: '100%', padding: '12px', backgroundColor: isBulkToggling ? '#475569' : 'rgba(0, 212, 170, 0.15)', color: isBulkToggling ? '#94A3B8' : '#00D4AA', border: '1px solid rgba(0, 212, 170, 0.3)', borderRadius: '10px', fontWeight: '700', cursor: isBulkToggling ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                          {isBulkToggling ? 'Processing...' : 'Activate All Rooms'}
                        </button>
                      </div>

                      {/* Deactivate All */}
                      <div style={{ padding: '20px', borderRadius: '14px', backgroundColor: 'rgba(255, 107, 107, 0.05)', border: '1px solid rgba(255, 107, 107, 0.15)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#FF6B6B', marginTop: '2px' }}>do_not_disturb_on</span>
                          <div>
                            <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: 'white' }}>Deactivate All Rooms</p>
                            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94A3B8', lineHeight: '1.5' }}>All rooms will be placed into maintenance mode. No students will be able to start any new AC sessions until rooms are re-activated.</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowDeactivateConfirm(true)}
                          disabled={isBulkToggling}
                          style={{ width: '100%', padding: '12px', backgroundColor: isBulkToggling ? '#475569' : 'rgba(255, 107, 107, 0.15)', color: isBulkToggling ? '#94A3B8' : '#FF6B6B', border: '1px solid rgba(255, 107, 107, 0.3)', borderRadius: '10px', fontWeight: '700', cursor: isBulkToggling ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                          Deactivate All Rooms
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

          {/* Custom Deactivate Confirmation Modal */}
          {showDeactivateConfirm && (
            <div className="modal-overlay" style={{ zIndex: 3000 }}>
              <div style={{ maxWidth: '420px', width: '100%', backgroundColor: '#1A2540', borderRadius: '20px', border: '1px solid rgba(255, 107, 107, 0.3)', padding: '28px', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'rgba(255, 107, 107, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '24px', color: '#FF6B6B' }}>warning</span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'white' }}>Critical Action Warning</h3>
                </div>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#CBD5E1', lineHeight: '1.6' }}>
                  You are about to place <strong style={{ color: 'white' }}>ALL rooms</strong> into maintenance mode.
                </p>
                <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#94A3B8', lineHeight: '1.6' }}>
                  No students will be able to start any new AC sessions. This action will fail if there are any active sessions currently running.
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => setShowDeactivateConfirm(false)}
                    style={{ flex: 1, padding: '13px', backgroundColor: 'rgba(255,255,255,0.05)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>
                    Cancel
                  </button>
                  <button
                    onClick={() => handleBulkToggle(false)}
                    disabled={isBulkToggling}
                    style={{ flex: 1, padding: '13px', backgroundColor: '#FF6B6B', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: isBulkToggling ? 'not-allowed' : 'pointer', fontSize: '14px' }}>
                    {isBulkToggling ? 'Processing...' : 'Yes, Deactivate All'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default AdminRoomsPage;
