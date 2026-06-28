import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/layout/Sidebar';
import api from '../../api/axios';

const AdminReportsPage = () => {
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Default to current month and year
  const currentDate = new Date();
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());

  const fetchReports = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/admin/reports', { params: { month, year } });
      setReport(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [month, year]);

  const totalConsumption = report?.by_room?.reduce((sum, r) => sum + parseFloat(r.total_units_consumed || 0), 0) || 0;
  const totalRevenue = report?.by_room?.reduce((sum, r) => sum + parseFloat(r.total_cost || 0), 0) || 0;

  return (
    <div className="page-layout" style={{ backgroundColor: '#0F1729', color: '#F8FAFC', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar />
      <main className="page-main" style={{ padding: '0' }}>
        
        {/* Top Navigation Bar */}
        <header className="flex justify-between items-center px-8 py-4 w-full sticky top-0 z-40 bg-[#0F1729]/80 backdrop-blur-md border-b border-white/10" style={{ marginBottom: '24px' }}>
          <div className="flex flex-col gap-1" style={{ marginLeft: '16px' }}>
            <h2 className="font-headline text-2xl font-bold text-white tracking-tight m-0 leading-none">Analytics & Reports</h2>
            <p className="text-slate-400 text-sm m-0 mt-1 leading-none">Analyze power consumption and revenue trends.</p>
          </div>
          <div className="flex items-center gap-6">
            
            {/* Date Filters */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <select 
                value={month} 
                onChange={e => setMonth(parseInt(e.target.value))}
                style={{ padding: '8px 16px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', outline: 'none' }}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m} style={{ backgroundColor: '#0F1729' }}>
                    {new Date(0, m - 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
              <select 
                value={year} 
                onChange={e => setYear(parseInt(e.target.value))}
                style={{ padding: '8px 16px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', outline: 'none' }}
              >
                {[currentDate.getFullYear() - 1, currentDate.getFullYear()].map(y => (
                  <option key={y} value={y} style={{ backgroundColor: '#0F1729' }}>{y}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-800/50 rounded-full border border-white/10">
              <span className="material-symbols-outlined text-sm text-slate-400">admin_panel_settings</span>
              <span className="text-sm font-medium text-white">{user?.name} {user?.role === 'super_admin' ? '(Super Admin)' : '(Admin)'}</span>
            </div>
          </div>
        </header>

        <div style={{ padding: '0 40px 40px' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

          {error && <div style={{ padding: '16px', backgroundColor: 'rgba(255,107,107,0.1)', color: '#FF6B6B', borderRadius: '12px' }}>{error}</div>}

          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            <div className="glass-card" style={{ padding: '32px', borderRadius: '24px', backgroundColor: 'rgba(26, 37, 64, 0.6)', border: '1px solid rgba(108, 99, 255, 0.3)', borderLeft: '4px solid #6C63FF' }}>
              <p style={{ color: '#94A3B8', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Total Consumption</p>
              <h3 style={{ fontSize: '36px', fontWeight: 'bold', color: 'white', fontFamily: '"Plus Jakarta Sans", sans-serif', margin: 0 }}>
                {isLoading ? '...' : `${totalConsumption.toFixed(2)} kWh`}
              </h3>
            </div>
            <div className="glass-card" style={{ padding: '32px', borderRadius: '24px', backgroundColor: 'rgba(26, 37, 64, 0.6)', border: '1px solid rgba(0, 212, 170, 0.3)', borderLeft: '4px solid #00D4AA' }}>
              <p style={{ color: '#94A3B8', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Total Revenue Generated</p>
              <h3 style={{ fontSize: '36px', fontWeight: 'bold', color: 'white', fontFamily: '"Plus Jakarta Sans", sans-serif', margin: 0 }}>
                {isLoading ? '...' : `₹${totalRevenue.toFixed(2)}`}
              </h3>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
            {/* Top Consuming Rooms Table */}
            <div className="glass-card" style={{ borderRadius: '24px', backgroundColor: 'rgba(26, 37, 64, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>Room Consumption Breakdown</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8' }}>
                    <tr>
                      <th style={{ padding: '16px 24px' }}>Room</th>
                      <th style={{ padding: '16px 24px', textAlign: 'right' }}>Total Units</th>
                      <th style={{ padding: '16px 24px', textAlign: 'right' }}>Total Cost</th>
                    </tr>
                  </thead>
                  <tbody style={{ divideY: '1px solid rgba(255,255,255,0.05)' }}>
                    {isLoading ? (
                      <tr><td colSpan="3" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>Loading...</td></tr>
                    ) : !report?.by_room || report.by_room.length === 0 ? (
                      <tr><td colSpan="3" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>No data for this period</td></tr>
                    ) : report.by_room.map(r => (
                      <tr key={r.r_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: 'bold', color: 'white' }}>Room {r.room_no}</td>
                        <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', color: '#6C63FF', fontWeight: '600' }}>{parseFloat(r.total_units_consumed || 0).toFixed(2)} kWh</td>
                        <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', color: '#00D4AA', fontWeight: '600' }}>₹{parseFloat(r.total_cost || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Consuming Students Table */}
            <div className="glass-card" style={{ borderRadius: '24px', backgroundColor: 'rgba(26, 37, 64, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>Student Consumption Breakdown</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8' }}>
                    <tr>
                      <th style={{ padding: '16px 24px' }}>Student</th>
                      <th style={{ padding: '16px 24px', textAlign: 'right' }}>Deductions</th>
                    </tr>
                  </thead>
                  <tbody style={{ divideY: '1px solid rgba(255,255,255,0.05)' }}>
                    {isLoading ? (
                      <tr><td colSpan="2" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>Loading...</td></tr>
                    ) : !report?.by_student || report.by_student.length === 0 ? (
                      <tr><td colSpan="2" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>No data for this period</td></tr>
                    ) : report.by_student.map(s => (
                      <tr key={s.u_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '16px 24px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'white', display: 'block' }}>{s.student_name}</span>
                          <span style={{ fontSize: '10px', color: '#94A3B8' }}>Room {s.room_no}</span>
                        </td>
                        <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', color: '#FF6B6B', fontWeight: '600' }}>₹{parseFloat(s.total_deducted || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminReportsPage;
