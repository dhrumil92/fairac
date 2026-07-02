import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/layout/Sidebar';
import api from '../../api/axios';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        backgroundColor: '#1A2540', border: '1px solid rgba(108,99,255,0.3)',
        borderRadius: '12px', padding: '12px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <p style={{ color: '#94A3B8', fontSize: '12px', marginBottom: '8px', fontWeight: 'bold' }}>{label}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.color, fontSize: '13px', margin: '2px 0', fontWeight: '600' }}>
            {entry.name === 'kwh' ? `${entry.value.toFixed(3)} kWh` : `₹${entry.value.toFixed(2)}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ─── Main Component ───────────────────────────────────────────────────────────
const AdminReportsPage = () => {
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Monthly report filters
  const currentDate = new Date();
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());

  // Chart state
  const [chartMode, setChartMode] = useState('month'); // 'day' | 'month'
  const [chartDate, setChartDate] = useState(currentDate.toISOString().split('T')[0]);
  const [chartMonth, setChartMonth] = useState(currentDate.getMonth() + 1);
  const [chartYear, setChartYear] = useState(currentDate.getFullYear());
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartMetric, setChartMetric] = useState('kwh'); // 'kwh' | 'cost'

  const fetchReports = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/admin/reports', { params: { month, year } });
      setReport(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  }, [month, year]);

  const fetchChartData = useCallback(async () => {
    try {
      setChartLoading(true);
      const params = chartMode === 'day'
        ? { mode: 'day', date: chartDate }
        : { mode: 'month', month: chartMonth, year: chartYear };
      const res = await api.get('/admin/reports/chart', { params });
      setChartData(res.data.data?.data || []);
    } catch (err) {
      // silently fail chart
    } finally {
      setChartLoading(false);
    }
  }, [chartMode, chartDate, chartMonth, chartYear]);

  useEffect(() => { fetchReports(); }, [fetchReports]);
  useEffect(() => { fetchChartData(); }, [fetchChartData]);

  const totalConsumption = report?.by_room?.reduce((sum, r) => sum + parseFloat(r.total_units || 0), 0) || 0;
  const totalRevenue = report?.by_room?.reduce((sum, r) => sum + parseFloat(r.total_cost || 0), 0) || 0;

  const maxKwh = Math.max(...(chartData.map(d => d.kwh)), 0.01);

  return (
    <div className="page-layout" style={{ backgroundColor: '#0F1729', color: '#F8FAFC', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar />
      <main className="page-main" style={{ padding: '0' }}>

        {/* Header */}
        <header className="flex justify-between items-center px-8 py-4 w-full sticky top-0 z-40 bg-[#0F1729]/80 backdrop-blur-md border-b border-white/10" style={{ marginBottom: '24px' }}>
          <div className="flex flex-col gap-1" style={{ marginLeft: '16px' }}>
            <h2 className="font-headline text-2xl font-bold text-white tracking-tight m-0 leading-none">Analytics & Reports</h2>
            <p className="text-slate-400 text-sm m-0 mt-1 leading-none">Analyze power consumption and revenue trends.</p>
          </div>
          <div className="flex items-center gap-6">
            {/* Monthly report date filters */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
                style={{ padding: '8px 16px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', outline: 'none' }}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m} style={{ backgroundColor: '#0F1729' }}>
                    {new Date(0, m - 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
              <select value={year} onChange={e => setYear(parseInt(e.target.value))}
                style={{ padding: '8px 16px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', outline: 'none' }}>
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
                  {isLoading ? '...' : `${totalConsumption.toFixed(3)} kWh`}
                </h3>
              </div>
              <div className="glass-card" style={{ padding: '32px', borderRadius: '24px', backgroundColor: 'rgba(26, 37, 64, 0.6)', border: '1px solid rgba(0, 212, 170, 0.3)', borderLeft: '4px solid #00D4AA' }}>
                <p style={{ color: '#94A3B8', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Total Revenue Generated</p>
                <h3 style={{ fontSize: '36px', fontWeight: 'bold', color: 'white', fontFamily: '"Plus Jakarta Sans", sans-serif', margin: 0 }}>
                  {isLoading ? '...' : `₹${totalRevenue.toFixed(2)}`}
                </h3>
              </div>
            </div>

            {/* ─── Consumption Chart ─────────────────────────────────────────────── */}
            <div className="glass-card" style={{ padding: '32px', borderRadius: '24px', backgroundColor: 'rgba(26, 37, 64, 0.6)', border: '1px solid rgba(108, 99, 255, 0.2)' }}>
              {/* Chart Header */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '28px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', margin: '0 0 4px' }}>Consumption Graph</h3>
                  <p style={{ color: '#64748B', fontSize: '13px', margin: 0 }}>
                    {chartMode === 'day' ? 'Peak hours of the day' : '30-day daily trend'}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  {/* Day / Month mode toggle */}
                  <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {['day', 'month'].map(mode => (
                      <button key={mode} onClick={() => setChartMode(mode)}
                        style={{
                          padding: '6px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s',
                          backgroundColor: chartMode === mode ? '#6C63FF' : 'transparent',
                          color: chartMode === mode ? 'white' : '#64748B',
                        }}>
                        {mode === 'day' ? 'Day View' : 'Month View'}
                      </button>
                    ))}
                  </div>

                  {/* Metric toggle (kWh / Cost) */}
                  <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {[['kwh', 'Energy (kWh)'], ['cost', 'Cost (₹)']].map(([key, label]) => (
                      <button key={key} onClick={() => setChartMetric(key)}
                        style={{
                          padding: '6px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s',
                          backgroundColor: chartMetric === key ? '#00D4AA' : 'transparent',
                          color: chartMetric === key ? '#0F1729' : '#64748B',
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Date picker for Day view */}
                  {chartMode === 'day' ? (
                    <input type="date" value={chartDate} onChange={e => setChartDate(e.target.value)}
                      style={{ padding: '8px 14px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none', fontSize: '13px' }} />
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select value={chartMonth} onChange={e => setChartMonth(parseInt(e.target.value))}
                        style={{ padding: '8px 12px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', outline: 'none', fontSize: '13px' }}>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                          <option key={m} value={m} style={{ backgroundColor: '#0F1729' }}>
                            {new Date(0, m - 1).toLocaleString('default', { month: 'short' })}
                          </option>
                        ))}
                      </select>
                      <select value={chartYear} onChange={e => setChartYear(parseInt(e.target.value))}
                        style={{ padding: '8px 12px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', outline: 'none', fontSize: '13px' }}>
                        {[currentDate.getFullYear() - 1, currentDate.getFullYear()].map(y => (
                          <option key={y} value={y} style={{ backgroundColor: '#0F1729' }}>{y}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Chart */}
              {chartLoading ? (
                <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>Loading chart...</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  {chartMode === 'day' ? (
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorKwh" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00D4AA" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#00D4AA" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="label" stroke="#475569" tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis stroke="#475569" tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => chartMetric === 'kwh' ? `${v.toFixed(2)}` : `₹${v.toFixed(0)}`} />
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(108,99,255,0.3)', strokeWidth: 1 }} />
                      <Area
                        type="monotone" dataKey={chartMetric}
                        stroke={chartMetric === 'kwh' ? '#6C63FF' : '#00D4AA'} strokeWidth={2}
                        fill={chartMetric === 'kwh' ? 'url(#colorKwh)' : 'url(#colorCost)'}
                        dot={false} activeDot={{ r: 5, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  ) : (
                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="barGradKwh" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6C63FF" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#6C63FF" stopOpacity={0.4} />
                        </linearGradient>
                        <linearGradient id="barGradCost" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00D4AA" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#00D4AA" stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="label" stroke="#475569" tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis stroke="#475569" tick={{ fill: '#64748B', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => chartMetric === 'kwh' ? `${v.toFixed(1)}` : `₹${v.toFixed(0)}`} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                      <Bar dataKey={chartMetric} fill={chartMetric === 'kwh' ? 'url(#barGradKwh)' : 'url(#barGradCost)'} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              )}

              {/* Peak annotation for day view */}
              {chartMode === 'day' && !chartLoading && chartData.length > 0 && (() => {
                const peak = chartData.reduce((best, d) => d[chartMetric] > best[chartMetric] ? d : best, chartData[0]);
                return peak[chartMetric] > 0 ? (
                  <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'rgba(108,99,255,0.1)', borderRadius: '10px', border: '1px solid rgba(108,99,255,0.2)', width: 'fit-content' }}>
                    <span className="material-symbols-outlined" style={{ color: '#6C63FF', fontSize: '18px' }}>trending_up</span>
                    <span style={{ color: '#94A3B8', fontSize: '13px' }}>
                      Peak hour: <strong style={{ color: 'white' }}>{peak.label}</strong> with{' '}
                      <strong style={{ color: '#6C63FF' }}>
                        {chartMetric === 'kwh' ? `${peak.kwh.toFixed(3)} kWh` : `₹${peak.cost.toFixed(2)}`}
                      </strong>
                    </span>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Room & Student Breakdown Tables */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
              {/* Room Table */}
              <div className="glass-card" style={{ borderRadius: '24px', backgroundColor: 'rgba(26, 37, 64, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', margin: 0 }}>Room Consumption Breakdown</h3>
                </div>
                <div style={{ overflow: 'auto', maxHeight: '425px' }}>
                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: 'rgba(26, 37, 64, 0.95)', backdropFilter: 'blur(4px)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8', zIndex: 10 }}>
                      <tr>
                        <th style={{ padding: '16px 24px' }}>Room</th>
                        <th style={{ padding: '16px 24px', textAlign: 'right' }}>Total Units</th>
                        <th style={{ padding: '16px 24px', textAlign: 'right' }}>Total Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr><td colSpan="3" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>Loading...</td></tr>
                      ) : !report?.by_room || report.by_room.length === 0 ? (
                        <tr><td colSpan="3" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>No data for this period</td></tr>
                      ) : report.by_room.map(r => (
                        <tr key={r.r_id || r.room_no} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: 'bold', color: 'white' }}>Room {r.room_no}</td>
                          <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', color: '#6C63FF', fontWeight: '600' }}>{parseFloat(r.total_units || 0).toFixed(2)} kWh</td>
                          <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', color: '#00D4AA', fontWeight: '600' }}>₹{parseFloat(r.total_cost || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Student Table */}
              <div className="glass-card" style={{ borderRadius: '24px', backgroundColor: 'rgba(26, 37, 64, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', margin: 0 }}>Student Consumption Breakdown</h3>
                </div>
                <div style={{ overflow: 'auto', maxHeight: '400px' }}>
                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: 'rgba(26, 37, 64, 0.95)', backdropFilter: 'blur(4px)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8', zIndex: 10 }}>
                      <tr>
                        <th style={{ padding: '16px 24px' }}>Student</th>
                        <th style={{ padding: '16px 24px', textAlign: 'center' }}>Room</th>
                        <th style={{ padding: '16px 24px', textAlign: 'right' }}>Deductions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr><td colSpan="3" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>Loading...</td></tr>
                      ) : !report?.by_student || report.by_student.length === 0 ? (
                        <tr><td colSpan="3" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>No data for this period</td></tr>
                      ) : report.by_student.map(s => (
                        <tr key={s.u_id || s.email} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '16px 24px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'white', display: 'block' }}>{s.student_name || s.name}</span>
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'center', fontSize: '14px', color: '#94A3B8', fontWeight: '500' }}>{s.room_no}</td>
                          <td style={{ padding: '16px 24px', textAlign: 'right', fontSize: '14px', color: '#FF6B6B', fontWeight: '600' }}>₹{parseFloat(s.total_deducted || s.total_cost || 0).toFixed(2)}</td>
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
