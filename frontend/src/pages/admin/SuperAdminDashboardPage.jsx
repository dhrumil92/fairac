import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import api from '../../api/axios';

const SuperAdminDashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        setIsLoading(true);
        const res = await api.get('/admin/dashboard');
        setOverview(res.data.data.overview);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load system overview');
      } finally {
        setIsLoading(false);
      }
    };
    fetchOverview();
  }, []);

  return (
    <div className="page-layout" style={{ backgroundColor: '#0F1729', color: '#F8FAFC', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar />
      <main className="page-main" style={{ padding: '0' }}>
        
        {/* Top Navigation Bar */}
        <header className="flex justify-between items-center px-8 py-4 w-full sticky top-0 z-40 bg-[#0F1729]/80 backdrop-blur-md border-b border-white/10" style={{ marginBottom: '24px' }}>
          <div className="flex flex-col gap-1" style={{ marginLeft: '16px' }}>
            <h2 className="font-headline text-2xl font-bold text-white tracking-tight m-0 leading-none">Super Admin Overview</h2>
            <p className="text-slate-400 text-sm m-0 mt-1 leading-none">Global system statistics and performance.</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-800/50 rounded-full border border-white/10">
              <span className="material-symbols-outlined text-sm text-slate-400">admin_panel_settings</span>
              <span className="text-sm font-medium text-white">{user?.name} (Super Admin)</span>
            </div>
          </div>
        </header>

        <div style={{ padding: '0 40px 40px' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
            {error && <div style={{ padding: '16px', backgroundColor: 'rgba(255,107,107,0.1)', color: '#FF6B6B', borderRadius: '12px' }}>{error}</div>}

            {isLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: '32px', color: '#6C63FF' }}>sync</span>
              </div>
            ) : (
              <>
                {/* Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
                  
                  {/* Total Rooms */}
                  <div className="glass-card" style={{ padding: '24px', borderRadius: '24px', backgroundColor: 'rgba(26, 37, 64, 0.6)', border: '1px solid rgba(108, 99, 255, 0.3)', boxShadow: '0 0 20px rgba(108, 99, 255, 0.1)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Rooms</span>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(108, 99, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6C63FF' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>meeting_room</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                      <span style={{ fontSize: '36px', fontWeight: 'bold', color: 'white', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>{overview?.total_rooms || 0}</span>
                    </div>
                  </div>

                  {/* Total Students */}
                  <div className="glass-card" style={{ padding: '24px', borderRadius: '24px', backgroundColor: 'rgba(26, 37, 64, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Students</span>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>groups</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                      <span style={{ fontSize: '36px', fontWeight: 'bold', color: 'white', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>{overview?.total_students || 0}</span>
                    </div>
                  </div>

                  {/* Global Revenue */}
                  <div className="glass-card" style={{ padding: '24px', borderRadius: '24px', backgroundColor: 'rgba(26, 37, 64, 0.6)', border: '1px solid rgba(0, 212, 170, 0.3)', boxShadow: '0 0 20px rgba(0, 212, 170, 0.05)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Global Revenue</span>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(0, 212, 170, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00D4AA' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>payments</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                      <span style={{ fontSize: '36px', fontWeight: 'bold', color: 'white', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>₹{parseFloat(overview?.total_recharged || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Active Sessions */}
                  <div className="glass-card" style={{ padding: '24px', borderRadius: '24px', backgroundColor: 'rgba(26, 37, 64, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Sessions</span>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>bolt</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                      <span style={{ fontSize: '36px', fontWeight: 'bold', color: 'white', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>{overview?.active_sessions || 0}</span>
                      <span style={{ fontSize: '14px', color: '#00D4AA', fontWeight: '500', display: 'flex', alignItems: 'center' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>arrow_upward</span> Live
                      </span>
                    </div>
                  </div>
                </div>

                {/* Additional Settings or Stats could go here */}
                <div style={{ padding: '32px', backgroundColor: 'rgba(108, 99, 255, 0.1)', borderRadius: '24px', border: '1px solid rgba(108, 99, 255, 0.2)', textAlign: 'center', marginTop: '16px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#6C63FF', marginBottom: '16px' }}>public</span>
                  <h3 style={{ fontSize: '24px', color: 'white', marginBottom: '8px' }}>Global Management</h3>
                  <p style={{ color: '#94A3B8', maxWidth: '600px', margin: '0 auto' }}>
                    You have super admin access. Use the sidebar to manage all students, rooms, and wallet operations across the entire FairAC system.
                  </p>
                </div>
              </>
            )}

          </div>
        </div>
      </main>
    </div>
  );
};

export default SuperAdminDashboardPage;
