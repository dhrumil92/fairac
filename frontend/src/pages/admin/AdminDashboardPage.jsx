import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/layout/Sidebar';
import api from '../../api/axios';
import Toast from '../../components/ui/Toast';

const AdminDashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const overviewRes = await api.get('/admin/dashboard');

      setOverview(overviewRes.data.data.overview);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Fetch every 10 seconds to show live telemetry data
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading && !overview) {
    return (
      <div className="page-layout" style={{ backgroundColor: '#0F1729', minHeight: '100vh', display: 'flex' }}>
        <Sidebar />
        <main className="page-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6C63FF' }}>
          <h2>Loading Dashboard...</h2>
        </main>
      </div>
    );
  }

  return (
    <div className="page-layout" style={{ backgroundColor: '#0F1729', color: '#F8FAFC', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar />
      <main className="page-main" style={{ padding: '0' }}>
        
        {/* Top Navigation Bar */}
        <header className="flex justify-between items-center px-8 py-4 w-full sticky top-0 z-40 bg-[#0F1729]/80 backdrop-blur-md border-b border-white/10" style={{ marginBottom: '24px' }}>
          <div className="flex flex-col gap-1" style={{ marginLeft: '16px' }}>
            <h2 className="font-headline text-2xl font-bold text-white tracking-tight m-0 leading-none">Admin Overview</h2>
            <p className="text-slate-400 text-sm m-0 mt-1 leading-none">Welcome back. Here is what's happening with the system today.</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-800/50 rounded-full border border-white/10">
              <span className="material-symbols-outlined text-sm text-slate-400">admin_panel_settings</span>
              <span className="text-sm font-medium text-white">{user?.name}</span>
            </div>
          </div>
        </header>

        <div style={{ padding: '0 40px 40px' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {error && <Toast message={error} type="error" onClose={() => setError('')} />}
          {toastMessage && <Toast message={toastMessage} type="success" onClose={() => setToastMessage(null)} />}

          {/* Top Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
            <StatCard icon="group" title="Total Students" value={overview?.total_students || 0} color="#6C63FF" onClick={() => navigate('/admin/students')} />
            <StatCard icon="meeting_room" title="Total Rooms" value={overview?.total_rooms || 0} color="#F59E0B" onClick={() => navigate('/admin/rooms')} />
            <StatCard icon="bolt" title="Active Sessions" value={overview?.active_sessions || 0} color="#6C63FF" highlight onClick={() => navigate('/admin/sessions')} />
            <StatCard icon="currency_rupee" title="Rate / Unit" value={`₹${parseFloat(overview?.current_rate || 0).toFixed(2)}`} color="#F43F5E" />
            <StatCard icon="energy_savings_leaf" title="Monthly Power (kWh)" value={parseFloat(overview?.total_units_consumed || 0).toFixed(2)} color="#06B6D4" />
            <StatCard icon="history" title="Last Month Power (kWh)" value={parseFloat(overview?.last_month_units_consumed || 0).toFixed(2)} color="#8B5CF6" />
            <StatCard icon="payments" title="Total Billed" value={`₹${parseFloat(overview?.total_billed || 0).toFixed(2)}`} color="#00D4AA" onClick={() => navigate('/admin/wallet')} />
            <StatCard icon="account_balance" title="Wallet Pool" value={`₹${parseFloat(overview?.total_recharged || 0).toFixed(2)}`} color="#6366F1" />
          </div>

          {/* Live System Overview */}
          <section className="glass-card" style={{ padding: '32px', borderRadius: '24px', backgroundColor: 'rgba(26, 37, 64, 0.6)', border: '1px solid rgba(108, 99, 255, 0.2)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(108, 99, 255, 0.1), transparent)', pointerEvents: 'none' }}></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '32px', position: 'relative', zIndex: 10 }}>
              <div style={{ maxWidth: '400px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', borderRadius: '9999px', backgroundColor: 'rgba(108,99,255,0.2)', color: '#6C63FF', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6C63FF', animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }}></span> Live System Metrics
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', marginBottom: '8px', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>Real-time Performance</h2>
                <p style={{ color: '#94A3B8', fontSize: '14px' }}>Aggregated live tracking of all IoT-enabled AC units.</p>
              </div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <LiveMetricCard value={`${((overview?.live_power_w || 0) / 1000).toFixed(2)}`} label="Live kW Power" color="#6C63FF" bg="rgba(108, 99, 255, 0.1)" borderColor="rgba(108, 99, 255, 0.2)" />
                <LiveMetricCard value={overview?.online_devices || 0} label="Online ESP32s" color="#00D4AA" bg="rgba(0, 212, 170, 0.1)" borderColor="rgba(0, 212, 170, 0.2)" />
                <LiveMetricCard value={overview?.offline_devices || 0} label="Offline ESP32s" color={overview?.offline_devices > 0 ? '#F43F5E' : '#94A3B8'} bg={overview?.offline_devices > 0 ? 'rgba(244, 63, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)'} borderColor={overview?.offline_devices > 0 ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255, 255, 255, 0.05)'} />
              </div>
            </div>
          </section>
        </div>
      </div>
      </main>
    </div>
  );
};

const StatCard = ({ icon, title, value, color, highlight, onClick }) => (
  <div 
    className="glass-card" 
    style={{ 
      padding: '24px', 
      borderRadius: '16px', 
      borderLeft: highlight ? `2px solid ${color}` : 'none',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.2s ease'
    }}
    onClick={onClick}
    onMouseOver={onClick ? e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.transform = 'scale(1.02)'; } : undefined}
    onMouseOut={onClick ? e => { e.currentTarget.style.background = 'rgba(26, 37, 64, 0.4)'; e.currentTarget.style.transform = 'scale(1)'; } : undefined}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: `${color}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color }}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      {highlight && (
        <span style={{ display: 'flex', height: '8px', width: '8px', position: 'relative' }}>
          <span style={{ animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite', position: 'absolute', display: 'inline-flex', height: '100%', width: '100%', borderRadius: '50%', backgroundColor: color, opacity: 0.75 }}></span>
          <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', height: '8px', width: '8px', backgroundColor: color }}></span>
        </span>
      )}
    </div>
    <p style={{ color: '#94A3B8', fontSize: '12px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 4px 0' }}>{title}</p>
    <h3 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', fontFamily: '"Plus Jakarta Sans", sans-serif', margin: 0 }}>{value}</h3>
  </div>
);

const LiveMetricCard = ({ value, label, color = 'white', bg = 'rgba(255,255,255,0.05)', borderColor = 'rgba(255,255,255,0.05)' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 24px', borderRadius: '16px', backgroundColor: bg, border: `1px solid ${borderColor}`, minWidth: '120px' }}>
    <span style={{ fontSize: '24px', fontWeight: 'bold', color: color }}>{value}</span>
    <span style={{ fontSize: '10px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: '600', marginTop: '4px' }}>{label}</span>
  </div>
);

export default AdminDashboardPage;
