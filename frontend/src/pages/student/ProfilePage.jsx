// =============================================================================
// src/pages/student/ProfilePage.jsx
// Student Profile Page — Exact Google Stitch Design
// =============================================================================

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/layout/Sidebar';
import api from '../../api/axios';
import './StudentPages.css';

const ProfilePage = () => {
  const { user, logout, updateUserLocally } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    mobile: user?.mobile || ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [walletBalance, setWalletBalance] = useState(null);

  const [myRoom, setMyRoom] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [walletRes, roomRes] = await Promise.allSettled([
          api.get('/wallet'),
          api.get('/rooms/my')
        ]);
        if (walletRes.status === 'fulfilled') {
          setWalletBalance(walletRes.value.data?.data?.wallet?.balance || 0);
        }
        if (roomRes.status === 'fulfilled') {
          setMyRoom(roomRes.value.data?.data?.room || null);
        }
      } catch (err) {
        console.error('Failed to fetch data for profile', err);
      }
    };
    fetchData();
  }, []);

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '??';



  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setError('');
    setIsLoading(true);
    try {
      const response = await api.put('/auth/profile', formData);
      if (response.data.status === 'success') {
        updateUserLocally(response.data.data.user);
        setIsEditing(false);
      }
    } catch (err) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.response?.data?.errors) {
        setError(err.response.data.errors[0].msg);
      } else {
        setError('An error occurred while updating profile.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(108, 99, 255, 0.3)',
    borderRadius: '8px',
    padding: '8px 12px',
    color: '#F8FAFC',
    fontSize: '16px',
    outline: 'none',
    width: '100%',
    transition: 'border-color 0.2s'
  };

  return (
    <div className="page-layout" style={{ backgroundColor: '#0F1729', color: '#F8FAFC', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar />
      <main className="page-main" style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: '896px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* ── Profile Header ── */}
          <section className="glass-card group" style={{ borderRadius: '24px', padding: '40px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: '-80px', top: '-80px', width: '256px', height: '256px', backgroundColor: 'rgba(108, 99, 255, 0.1)', borderRadius: '50%', filter: 'blur(40px)' }}></div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '32px', position: 'relative', zIndex: 10 }}>
              <div style={{ position: 'relative' }}>
                <div style={{ width: '160px', height: '160px', borderRadius: '50%', background: 'linear-gradient(to bottom right, #6C63FF, #818CF8)', padding: '4px' }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '4px solid #1A2540', backgroundColor: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '60px', fontWeight: 'bold', color: 'white', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                    {initials}
                  </div>
                </div>
                <button style={{ position: 'absolute', bottom: '8px', right: '8px', backgroundColor: '#6C63FF', color: 'white', padding: '8px', borderRadius: '50%', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', border: 'none', cursor: 'pointer', display: 'flex' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>edit</span>
                </button>
              </div>

              <div style={{ flexGrow: 1 }}>
                <h1 style={{ fontSize: '36px', fontWeight: 'bold', color: 'white', marginBottom: '8px', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>{user?.name}</h1>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ padding: '6px 16px', borderRadius: '9999px', backgroundColor: 'rgba(108, 99, 255, 0.2)', color: '#6C63FF', fontSize: '14px', fontWeight: '600', border: '1px solid rgba(108, 99, 255, 0.3)', textTransform: 'capitalize' }}>
                    {user?.role}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94A3B8', fontSize: '14px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>location_on</span>
                    FairAC Registered User
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ── Account Information ── */}
          <section className="glass-card" style={{ borderRadius: '24px', padding: '32px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(108, 99, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6C63FF' }}>
                  <span className="material-symbols-outlined">person</span>
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Account Information</h2>
              </div>
              
              {!isEditing ? (
                <button 
                  onClick={() => setIsEditing(true)}
                  style={{ fontSize: '14px', fontWeight: '600', color: '#6C63FF', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                  Edit Details
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    onClick={() => {
                      setIsEditing(false);
                      setError('');
                      setFormData({ name: user?.name, email: user?.email, mobile: user?.mobile });
                    }}
                    style={{ fontSize: '14px', fontWeight: '600', color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={isLoading}
                    style={{ fontSize: '14px', fontWeight: '600', color: 'white', backgroundColor: '#6C63FF', padding: '6px 16px', borderRadius: '8px', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer' }}
                  >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div style={{ padding: '12px 16px', backgroundColor: 'rgba(255, 107, 107, 0.1)', color: '#FF6B6B', borderRadius: '8px', marginBottom: '24px', fontSize: '14px', fontWeight: '500' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: '32px', columnGap: '48px' }}>
              
              {/* Name Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Full Name</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 0' }}>
                  {isEditing ? (
                    <input 
                      type="text" 
                      name="name" 
                      value={formData.name} 
                      onChange={handleInputChange} 
                      style={inputStyle}
                      autoFocus
                    />
                  ) : (
                    <p style={{ fontSize: '18px', fontWeight: '500', color: '#E2E8F0' }}>{user?.name}</p>
                  )}
                </div>
              </div>

              {/* Email Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Email Address</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 0' }}>
                  {isEditing ? (
                    <input 
                      type="email" 
                      name="email" 
                      value={formData.email} 
                      onChange={handleInputChange} 
                      style={inputStyle}
                    />
                  ) : (
                    <>
                      <p style={{ fontSize: '18px', fontWeight: '500', color: '#E2E8F0' }}>{user?.email}</p>
                      <span className="material-symbols-outlined" style={{ color: '#00D4AA', fontSize: '18px' }}>verified</span>
                    </>
                  )}
                </div>
              </div>

              {/* Mobile Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Mobile Number</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 0' }}>
                  {isEditing ? (
                    <input 
                      type="text" 
                      name="mobile" 
                      value={formData.mobile} 
                      onChange={handleInputChange} 
                      style={inputStyle}
                    />
                  ) : (
                    <p style={{ fontSize: '18px', fontWeight: '500', color: '#E2E8F0' }}>{user?.mobile ? `+91 ${user.mobile}` : 'Not Provided'}</p>
                  )}
                </div>
              </div>

              {/* Wallet Balance Field (Not editable) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Wallet Balance</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 0' }}>
                  <p style={{ fontSize: '18px', fontWeight: '500', color: '#E2E8F0', opacity: isEditing ? 0.6 : 1 }}>
                    {walletBalance !== null ? `₹${parseFloat(walletBalance).toFixed(2)}` : 'Loading...'}
                  </p>
                </div>
              </div>

              {/* Hostel Field (Not editable) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Hostel Name</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 0' }}>
                  <p style={{ fontSize: '18px', fontWeight: '500', color: '#E2E8F0', opacity: isEditing ? 0.6 : 1 }}>
                    {myRoom ? myRoom.hostel_name : 'Not assigned'}
                  </p>
                </div>
              </div>

              {/* Room Field (Not editable) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Room Number</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 0' }}>
                  <p style={{ fontSize: '18px', fontWeight: '500', color: '#E2E8F0', opacity: isEditing ? 0.6 : 1 }}>
                    {myRoom ? (myRoom.room_name || myRoom.room_no) : 'Not assigned'}
                  </p>
                </div>
              </div>

            </div>
          </section>

          {/* ── Danger Zone ── */}
          <section className="glass-card" style={{ borderRadius: '24px', padding: '32px', border: '1px solid rgba(255, 107, 107, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(255, 107, 107, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF6B6B' }}>
                <span className="material-symbols-outlined">warning</span>
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Danger Zone</h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px', borderRadius: '16px', backgroundColor: 'rgba(255, 107, 107, 0.05)', border: '1px solid rgba(255, 107, 107, 0.1)' }}>
              <div>
                <p style={{ fontWeight: '600', color: '#E2E8F0', marginBottom: '4px' }}>Log out from account</p>
                <p style={{ fontSize: '14px', color: '#94A3B8' }}>You will need to sign in again to access your sessions and wallet.</p>
              </div>
              <button 
                onClick={logout}
                style={{ padding: '12px 32px', backgroundColor: '#FF6B6B', color: 'white', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 10px 15px -3px rgba(255, 107, 107, 0.2)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
                Log Out
              </button>
            </div>

            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: '12px', color: '#64748B' }}>Deactivating your account will permanently delete your session history.</p>
              <button style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'none', border: 'none', cursor: 'pointer' }}>Deactivate Account</button>
            </div>
          </section>

          {/* Footer Context */}
          <div style={{ textAlign: 'center', paddingBottom: '40px' }}>
            <p style={{ color: '#475569', fontSize: '14px' }}>© 2026 FairAC Student Management System. Version 2.4.0-stable</p>
          </div>

        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
