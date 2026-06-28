import { useState, useEffect } from 'react';
import api from '../../api/axios';

const ManageHostelModal = ({ hostelId, onClose, onUpdate }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [generalData, setGeneralData] = useState({ name: '', hostel_code: '', address: '', rate_per_unit: '' });
  const [adminData, setAdminData] = useState({ name: '', email: '', mobile: '', password: '' });
  const [isActive, setIsActive] = useState(true);

  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchDetails();
  }, [hostelId]);

  const fetchDetails = async () => {
    try {
      setIsLoading(true);
      setError('');
      const res = await api.get(`/admin/hostels/${hostelId}`);
      const { hostel, admin } = res.data.data;

      setGeneralData({
        name: hostel.name || '',
        hostel_code: hostel.hostel_code || '',
        address: hostel.address || '',
        rate_per_unit: hostel.rate_per_unit || '10.00'
      });
      setIsActive(hostel.is_active);

      if (admin) {
        setAdminData({ name: admin.name || '', email: admin.email || '', mobile: admin.mobile || '', password: '' });
      }
    } catch (err) {
      setError('Failed to fetch details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneralSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(''); setSuccess('');
    try {
      await api.put(`/admin/hostels/${hostelId}`, generalData);
      setSuccess('Hostel details updated successfully.');
      onUpdate();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update hostel');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(''); setSuccess('');
    try {
      await api.put(`/admin/hostels/${hostelId}/admin`, adminData);
      setSuccess('Admin details updated successfully.');
      setAdminData(prev => ({ ...prev, password: '' })); // clear password field
      onUpdate();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update admin');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    setIsSaving(true);
    setError(''); setSuccess('');
    try {
      const res = await api.post(`/admin/hostels/${hostelId}/toggle-status`, { is_active: !isActive });
      setIsActive(!isActive);
      setSuccess(`Hostel ${!isActive ? 'activated' : 'deactivated'} successfully.`);
      onUpdate();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change status');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 41, 0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '850px', height: '556px', backgroundColor: '#1E293B', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="material-symbols-outlined" style={{ color: '#6C63FF' }}>settings</span>
            Manage Hostel
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex' }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div style={{ display: 'flex', flex: 1, height: '420px' }}>
          {/* Vertical Tabs Sidebar */}
          <div style={{ width: '220px', backgroundColor: 'rgba(0,0,0,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', padding: '24px 16px', gap: '8px' }}>
            {['general', 'admin', 'danger'].map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setError(''); setSuccess(''); }}
                style={{
                  padding: '14px 16px',
                  background: activeTab === tab ? 'rgba(108, 99, 255, 0.15)' : 'transparent',
                  border: '1px solid',
                  borderColor: activeTab === tab ? 'rgba(108, 99, 255, 0.3)' : 'transparent',
                  borderRadius: '12px',
                  color: activeTab === tab ? 'white' : '#94A3B8',
                  fontWeight: activeTab === tab ? '600' : '500',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: activeTab === tab ? '#6C63FF' : '#64748B' }}>
                  {tab === 'general' ? 'info' : tab === 'admin' ? 'admin_panel_settings' : 'warning'}
                </span>
                {tab === 'general' ? 'General Info' : tab === 'admin' ? 'Admin Access' : 'Danger Zone'}
              </button>
            ))}
          </div>

          {/* Body */}
          <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
            {isLoading ? (
              <div style={{ textAlign: 'center', color: '#94A3B8', padding: '40px' }}>Loading data...</div>
            ) : (
              <>
                {error && (
                  <div style={{ padding: '16px', backgroundColor: 'rgba(255,107,107,0.1)', color: '#FF6B6B', borderRadius: '12px', marginBottom: '24px', border: '1px solid rgba(255,107,107,0.2)' }}>
                    {error}
                  </div>
                )}
                {success && (
                  <div style={{ padding: '16px', backgroundColor: 'rgba(0,212,170,0.1)', color: '#00D4AA', borderRadius: '12px', marginBottom: '24px', border: '1px solid rgba(0,212,170,0.2)' }}>
                    {success}
                  </div>
                )}

                {activeTab === 'general' && (
                  <form onSubmit={handleGeneralSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#94A3B8', fontWeight: '500' }}>Hostel Name</label>
                      <input type="text" required value={generalData.name} onChange={e => setGeneralData({ ...generalData, name: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '20px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#94A3B8', fontWeight: '500' }}>Hostel Code</label>
                        <input type="text" required value={generalData.hostel_code} onChange={e => setGeneralData({ ...generalData, hostel_code: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#94A3B8', fontWeight: '500' }}>Rate per kWh (₹)</label>
                        <input type="number" step="0.01" required value={generalData.rate_per_unit} onChange={e => setGeneralData({ ...generalData, rate_per_unit: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#94A3B8', fontWeight: '500' }}>Address</label>
                      <textarea rows="3" required value={generalData.address} onChange={e => setGeneralData({ ...generalData, address: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none', resize: 'none' }}></textarea>
                    </div>
                    <button type="submit" disabled={isSaving} style={{ marginTop: '12px', padding: '14px', backgroundColor: '#6C63FF', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1 }}>
                      {isSaving ? 'Saving...' : 'Save General Info'}
                    </button>
                  </form>
                )}

                {activeTab === 'admin' && (
                  <form onSubmit={handleAdminSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#94A3B8', fontWeight: '500' }}>Admin Name</label>
                      <input type="text" required value={adminData.name} onChange={e => setAdminData({ ...adminData, name: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '20px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#94A3B8', fontWeight: '500' }}>Email Address</label>
                        <input type="email" required value={adminData.email} onChange={e => setAdminData({ ...adminData, email: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#94A3B8', fontWeight: '500' }}>Mobile Number</label>
                        <input type="text" required value={adminData.mobile} onChange={e => setAdminData({ ...adminData, mobile: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#94A3B8', fontWeight: '500' }}>Reset Password (Optional)</label>
                      <div style={{ position: 'relative' }}>
                        <input type={showPassword ? "text" : "password"} placeholder="Leave blank to keep current password" value={adminData.password} onChange={e => setAdminData({ ...adminData, password: e.target.value })} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none', paddingRight: '48px' }} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{showPassword ? 'visibility_off' : 'visibility'}</span>
                        </button>
                      </div>
                    </div>
                    <button type="submit" disabled={isSaving} style={{ marginTop: '12px', padding: '14px', backgroundColor: '#6C63FF', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1 }}>
                      {isSaving ? 'Saving...' : 'Update Admin Access'}
                    </button>
                  </form>
                )}

                {activeTab === 'danger' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ padding: '24px', backgroundColor: 'rgba(255,107,107,0.05)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '16px', fontWeight: '600' }}>{isActive ? 'Deactivate' : 'Activate'} Hostel</h4>
                        <p style={{ margin: 0, color: '#94A3B8', fontSize: '13px', maxWidth: '400px', lineHeight: '1.5' }}>
                          {isActive
                            ? 'Deactivating will prevent new sessions from starting. Existing data and wallets remain accessible.'
                            : 'Activating will allow students to start new sessions again.'}
                        </p>
                      </div>
                      <button
                        onClick={handleToggleStatus}
                        disabled={isSaving}
                        style={{
                          padding: '12px 24px',
                          backgroundColor: isActive ? 'rgba(255,107,107,0.1)' : 'rgba(0,212,170,0.1)',
                          color: isActive ? '#FF6B6B' : '#00D4AA',
                          border: `1px solid ${isActive ? 'rgba(255,107,107,0.3)' : 'rgba(0,212,170,0.3)'}`,
                          borderRadius: '12px',
                          fontWeight: 'bold',
                          cursor: isSaving ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {isSaving ? 'Processing...' : isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageHostelModal;
