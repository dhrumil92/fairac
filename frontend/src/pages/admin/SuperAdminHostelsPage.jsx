import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import api from '../../api/axios';
import ManageHostelModal from './ManageHostelModal';

const SuperAdminHostelsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hostels, setHostels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Add Hostel Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [selectedHostelId, setSelectedHostelId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState('');
  const [formData, setFormData] = useState({
    hostel_code: '',
    hostel_name: '',
    address: '',
    admin_name: '',
    admin_mobile: '',
    admin_email: '',
    admin_password: '',
    confirm_password: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Protect route
  useEffect(() => {
    if (user?.role !== 'super_admin') {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const fetchHostels = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/admin/hostels');
      setHostels(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load hostels');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'super_admin') fetchHostels();
  }, [user]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setAddError('');

    if (formData.admin_password !== formData.confirm_password) {
      setAddError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    
    try {
      await api.post('/admin/hostels', formData);
      setIsAddModalOpen(false);
      setFormData({
        hostel_code: '',
        hostel_name: '',
        address: '',
        admin_name: '',
        admin_mobile: '',
        admin_email: '',
        admin_password: '',
        confirm_password: '',
      });
      fetchHostels();
    } catch (err) {
      setAddError(err.response?.data?.message || 'Failed to create hostel');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredHostels = hostels.filter(h => 
    h.hostel_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    h.hostel_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-layout" style={{ backgroundColor: '#0F1729', color: '#F8FAFC', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar />
      <main className="page-main" style={{ padding: '0' }}>
        
        {/* Top Navigation Bar */}
        <header className="flex justify-between items-center px-8 py-4 w-full sticky top-0 z-40 bg-[#0F1729]/80 backdrop-blur-md border-b border-white/10" style={{ marginBottom: '24px' }}>
          <div className="flex flex-col gap-1" style={{ marginLeft: '16px' }}>
            <h2 className="font-headline text-2xl font-bold text-white tracking-tight m-0 leading-none">Hostel Management</h2>
            <p className="text-slate-400 text-sm m-0 mt-1 leading-none">Manage all registered hostels and their data</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-800/50 rounded-full border border-white/10">
              <span className="material-symbols-outlined text-sm text-slate-400">admin_panel_settings</span>
              <span className="text-sm font-medium text-white">{user?.name} (Super Admin)</span>
            </div>
          </div>
        </header>

        <div style={{ padding: '0 40px 40px', maxWidth: '1200px', margin: '0 auto' }}>
          
          {error && (
            <div style={{ padding: '16px', backgroundColor: 'rgba(255,107,107,0.1)', color: '#FF6B6B', borderRadius: '12px', marginBottom: '24px', border: '1px solid rgba(255,107,107,0.2)' }}>
              <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '8px' }}>error</span>
              {error}
            </div>
          )}

          {/* ── Action Bar ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ position: 'relative' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: '20px' }}>search</span>
              <input 
                type="text" 
                placeholder="Search hostels..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ padding: '12px 16px 12px 40px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', width: '300px', fontSize: '14px', outline: 'none' }}
              />
            </div>
            <button 
              onClick={() => setIsAddModalOpen(true)}
              style={{ padding: '12px 24px', backgroundColor: '#6C63FF', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(108, 99, 255, 0.3)', transition: 'all 0.2s' }} 
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'} 
              onMouseOut={e => e.currentTarget.style.transform = 'none'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add_business</span>
              Add New Hostel
            </button>
          </div>

          {/* ── Hostels Table ── */}
          <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8' }}>
                  <tr>
                    <th style={{ padding: '16px 24px', fontWeight: '600' }}>Hostel Info</th>
                    <th style={{ padding: '16px 24px', fontWeight: '600', textAlign: 'center' }}>Total Rooms</th>
                    <th style={{ padding: '16px 24px', fontWeight: '600', textAlign: 'center' }}>Total Students</th>
                    <th style={{ padding: '16px 24px', fontWeight: '600', textAlign: 'center' }}>Active Sessions</th>
                    <th style={{ padding: '16px 24px', fontWeight: '600', textAlign: 'right' }}>Total Revenue</th>
                    <th style={{ padding: '16px 24px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody style={{ divideY: '1px solid rgba(255,255,255,0.05)' }}>
                  {isLoading && hostels.length === 0 ? (
                    <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>Loading hostels...</td></tr>
                  ) : filteredHostels.length === 0 ? (
                    <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>No hostels found</td></tr>
                  ) : filteredHostels.map(h => (
                    <tr key={h.hostel_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={{ padding: '20px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(108, 99, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6C63FF', fontSize: '24px' }}>
                            <span className="material-symbols-outlined">domain</span>
                          </div>
                          <div>
                            <span style={{ fontSize: '15px', fontWeight: '600', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {h.hostel_name}
                              {!h.is_active && (
                                <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(255,107,107,0.1)', color: '#FF6B6B', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>Inactive</span>
                              )}
                            </span>
                            <span style={{ fontSize: '12px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>tag</span>
                              {h.hostel_code}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                        <span style={{ fontSize: '15px', fontWeight: '600', color: 'white' }}>{h.total_rooms}</span>
                      </td>
                      <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                        <span style={{ fontSize: '15px', fontWeight: '600', color: 'white' }}>{h.total_students}</span>
                      </td>
                      <td style={{ padding: '20px 24px', textAlign: 'center' }}>
                        {parseInt(h.active_sessions) > 0 ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '999px', backgroundColor: 'rgba(0, 212, 170, 0.15)', color: '#00D4AA', fontWeight: '600', fontSize: '13px' }}>
                            <span className="material-symbols-outlined animate-pulse" style={{ fontSize: '16px' }}>sensors</span>
                            {h.active_sessions} Live
                          </div>
                        ) : (
                          <span style={{ fontSize: '15px', color: '#64748B' }}>0</span>
                        )}
                      </td>
                      <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                        <span style={{ fontSize: '15px', fontWeight: '700', color: '#00D4AA' }}>₹{parseFloat(h.total_revenue).toFixed(2)}</span>
                      </td>
                      <td style={{ padding: '20px 24px', textAlign: 'right' }}>
                        <button 
                          onClick={() => { setSelectedHostelId(h.hostel_id); setIsManageModalOpen(true); }}
                          style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#6C63FF', border: '1px solid rgba(108, 99, 255, 0.5)', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={e => { e.currentTarget.style.backgroundColor = 'rgba(108, 99, 255, 0.1)'; e.currentTarget.style.borderColor = '#6C63FF'; }} onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'rgba(108, 99, 255, 0.5)'; }}>
                          Manage
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

      {/* ── Add New Hostel Modal ── */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 41, 0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ width: '100%', maxWidth: '800px', backgroundColor: '#1E293B', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            
            <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: 'white', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="material-symbols-outlined" style={{ color: '#6C63FF' }}>add_business</span>
                Register New Hostel
              </h2>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex' }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div style={{ padding: '32px', overflowY: 'auto' }}>
              {addError && (
                <div style={{ padding: '16px', backgroundColor: 'rgba(255,107,107,0.1)', color: '#FF6B6B', borderRadius: '12px', marginBottom: '24px', border: '1px solid rgba(255,107,107,0.2)' }}>
                  {addError}
                </div>
              )}

              <form id="addHostelForm" onSubmit={handleAddSubmit} autoComplete="off">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                  
                  {/* Left Column: Hostel Details */}
                  <div>
                    <h3 style={{ margin: '0 0 24px 0', fontSize: '16px', color: '#00D4AA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hostel Details</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#94A3B8' }}>Hostel Name</label>
                        <input type="text" name="hostel_name" required value={formData.hostel_name} onChange={handleInputChange} placeholder="e.g. ABC Boys Hostel" style={{ width: '100%', padding: '12px 16px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: '14px', outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#94A3B8' }}>Hostel Secret Code</label>
                        <input type="text" name="hostel_code" required value={formData.hostel_code} onChange={handleInputChange} placeholder="e.g. ABC-2026" style={{ width: '100%', padding: '12px 16px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: '14px', outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#94A3B8' }}>Address</label>
                        <textarea name="address" required value={formData.address} onChange={handleInputChange} placeholder="Full address of the hostel" rows={3} style={{ width: '100%', padding: '12px 16px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: '14px', outline: 'none', resize: 'vertical' }} />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Admin Details */}
                  <div>
                    <h3 style={{ margin: '0 0 24px 0', fontSize: '16px', color: '#00D4AA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Admin User Details</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#94A3B8' }}>Admin Full Name</label>
                        <input type="text" name="admin_name" required value={formData.admin_name} onChange={handleInputChange} placeholder="Admin's full name" style={{ width: '100%', padding: '12px 16px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: '14px', outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#94A3B8' }}>Mobile Number</label>
                        <input type="tel" name="admin_mobile" required value={formData.admin_mobile} onChange={handleInputChange} placeholder="10-digit mobile number" style={{ width: '100%', padding: '12px 16px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: '14px', outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#94A3B8' }}>Email (User ID)</label>
                        <input type="email" name="admin_email" required value={formData.admin_email} onChange={handleInputChange} placeholder="admin@example.com" autoComplete="off" style={{ width: '100%', padding: '12px 16px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: '14px', outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#94A3B8' }}>Password</label>
                        <div style={{ position: 'relative' }}>
                          <input type={showPassword ? "text" : "password"} name="admin_password" required value={formData.admin_password} onChange={handleInputChange} placeholder="Create a strong password" autoComplete="new-password" style={{ width: '100%', padding: '12px 16px', paddingRight: '48px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: '14px', outline: 'none' }} />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{showPassword ? 'visibility_off' : 'visibility'}</span>
                          </button>
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#94A3B8' }}>Confirm Password</label>
                        <div style={{ position: 'relative' }}>
                          <input type={showConfirmPassword ? "text" : "password"} name="confirm_password" required value={formData.confirm_password} onChange={handleInputChange} placeholder="Confirm the password" autoComplete="new-password" style={{ width: '100%', padding: '12px 16px', paddingRight: '48px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white', fontSize: '14px', outline: 'none' }} />
                          <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{showConfirmPassword ? 'visibility_off' : 'visibility'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </form>
            </div>

            <div style={{ padding: '24px 32px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end', gap: '16px', backgroundColor: 'rgba(0,0,0,0.2)' }}>
              <button 
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                style={{ padding: '12px 24px', backgroundColor: 'transparent', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                type="submit"
                form="addHostelForm"
                disabled={isSubmitting}
                style={{ padding: '12px 24px', backgroundColor: '#00D4AA', color: '#0F1729', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {isSubmitting ? 'Creating...' : 'Create Hostel & Admin'}
                {!isSubmitting && <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>check_circle</span>}
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* ── Manage Hostel Modal ── */}
      {isManageModalOpen && selectedHostelId && (
        <ManageHostelModal 
          hostelId={selectedHostelId} 
          onClose={() => setIsManageModalOpen(false)} 
          onUpdate={fetchHostels} 
        />
      )}
    </div>
  );
};

export default SuperAdminHostelsPage;
