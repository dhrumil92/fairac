import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/layout/Sidebar';
import api from '../../api/axios';

const AdminStudentsPage = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchStudents = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/admin/students', { params: { search: searchTerm } });
      setStudents(res.data.data.students || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load students');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [searchTerm]);

  return (
    <div className="page-layout" style={{ backgroundColor: '#0F1729', color: '#F8FAFC', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar />
      <main className="page-main" style={{ padding: '40px', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Header */}
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '30px', fontWeight: 'bold', fontFamily: '"Plus Jakarta Sans", sans-serif', color: 'white' }}>Student Directory</h2>
              <p style={{ color: '#94A3B8', fontSize: '14px' }}>Comprehensive list of all students and their account status.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 12px', backgroundColor: '#1A2540', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}>
                <span className="material-symbols-outlined" style={{ color: '#6C63FF' }}>admin_panel_settings</span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: 'white' }}>{user?.name}</span>
              </div>
            </div>
          </header>

          {error && <div style={{ padding: '16px', backgroundColor: 'rgba(255,107,107,0.1)', color: '#FF6B6B', borderRadius: '12px' }}>{error}</div>}

          {/* Student Directory Table */}
          <div className="glass-card" style={{ borderRadius: '24px', backgroundColor: 'rgba(26, 37, 64, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>All Students ({students.length})</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ position: 'relative' }}>
                  <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748B', fontSize: '18px' }}>search</span>
                  <input 
                    type="text" 
                    placeholder="Search students..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ padding: '10px 16px 10px 40px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', width: '250px' }}
                  />
                </div>
                <button style={{ padding: '10px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>filter_list</span>
                </button>
              </div>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8' }}>
                  <tr>
                    <th style={{ padding: '16px 24px' }}>Student</th>
                    <th style={{ padding: '16px 24px' }}>Contact</th>
                    <th style={{ padding: '16px 24px' }}>Room</th>
                    <th style={{ padding: '16px 24px' }}>Status</th>
                    <th style={{ padding: '16px 24px' }}>Wallet Bal.</th>
                    <th style={{ padding: '16px 24px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody style={{ divideY: '1px solid rgba(255,255,255,0.05)' }}>
                  {isLoading && students.length === 0 ? (
                    <tr><td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>Loading students...</td></tr>
                  ) : students.length === 0 ? (
                    <tr><td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>No students found</td></tr>
                  ) : students.map(st => (
                    <tr key={st.u_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(108, 99, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6C63FF', fontSize: '12px', fontWeight: 'bold' }}>
                            {st.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span style={{ fontSize: '14px', fontWeight: '600', color: 'white', display: 'block' }}>{st.name}</span>
                            <span style={{ fontSize: '10px', color: '#94A3B8' }}>ID: {st.u_id}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ fontSize: '12px', color: '#CBD5E1', display: 'block' }}>{st.email}</span>
                        <span style={{ fontSize: '12px', color: '#94A3B8' }}>{st.mobile}</span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ fontSize: '14px', color: 'white', fontWeight: '500' }}>{st.room_no || 'None'}</span>
                        {st.room_role && <span style={{ fontSize: '10px', color: '#6C63FF', display: 'block', textTransform: 'capitalize' }}>{st.room_role}</span>}
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        {st.is_active 
                          ? <span style={{ padding: '4px 8px', borderRadius: '9999px', backgroundColor: 'rgba(0, 212, 170, 0.1)', color: '#00D4AA', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Active</span>
                          : <span style={{ padding: '4px 8px', borderRadius: '9999px', backgroundColor: 'rgba(255, 107, 107, 0.1)', color: '#FF6B6B', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Inactive</span>
                        }
                      </td>
                      <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: '600', color: parseFloat(st.balance) > 100 ? '#00D4AA' : (parseFloat(st.balance) < 0 ? '#FF6B6B' : '#F59E0B') }}>
                        ₹{parseFloat(st.balance || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <button style={{ padding: '6px 16px', backgroundColor: '#6C63FF', color: 'white', fontSize: '12px', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer', transition: 'opacity 0.2s' }} onMouseOver={e => e.currentTarget.style.opacity = 0.8} onMouseOut={e => e.currentTarget.style.opacity = 1}>
                          View Details
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
    </div>
  );
};

export default AdminStudentsPage;
