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

const AdminStudentsPage = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [studentHistory, setStudentHistory] = useState(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Filter & Pagination States
  const [filterType, setFilterType] = useState('all');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef(null);
  const portalFilterDropdownRef = useRef(null);
  const [filterDropdownRect, setFilterDropdownRect] = useState(null);
  const [studentPage, setStudentPage] = useState(1);
  const STUDENTS_PER_PAGE = 7;

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

  const fetchStudentHistory = async () => {
    if (!selectedStudent) return;
    try {
      setIsHistoryLoading(true);
      const res = await api.get('/admin/transactions', { params: { student: selectedStudent.u_id, limit: 20 } });
      setStudentHistory(res.data.data.transactions || []);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to load history');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleToggleStatus = async (studentId, currentStatus) => {
    try {
      const newStatus = !currentStatus;
      await api.put(`/admin/students/${studentId}/status`, { is_active: newStatus });
      // Update local state without fetching all again
      setStudents(students.map(st => st.u_id === studentId ? { ...st, is_active: newStatus } : st));
      if (selectedStudent && selectedStudent.u_id === studentId) {
        setSelectedStudent({ ...selectedStudent, is_active: newStatus });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle student status');
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [searchTerm]);

  useEffect(() => {
    if (activeTab === 'history' && selectedStudent) {
      fetchStudentHistory();
    }
  }, [activeTab, selectedStudent]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target) && (!portalFilterDropdownRef.current || !portalFilterDropdownRef.current.contains(event.target))) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredStudents = students.filter(st => {
    if (filterType === 'active') return st.is_active === true;
    if (filterType === 'inactive') return st.is_active === false;
    if (filterType === 'owner') return st.room_role === 'owner';
    if (filterType === 'no_room') return !st.room_no;
    if (filterType === 'low_balance') return parseFloat(st.balance || 0) < 50;
    return true;
  });

  return (
    <div className="page-layout" style={{ backgroundColor: '#0F1729', color: '#F8FAFC', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar />
      <main className="page-main" style={{ padding: '0' }}>

        {/* Top Navigation Bar */}
        <header className="flex justify-between items-center px-8 py-4 w-full sticky top-0 z-40 bg-[#0F1729]/80 backdrop-blur-md border-b border-white/10" style={{ marginBottom: '24px' }}>
          <div className="flex flex-col gap-1" style={{ marginLeft: '16px' }}>
            <h2 className="font-headline text-2xl font-bold text-white tracking-tight m-0 leading-none">Student Directory</h2>
            <p className="text-slate-400 text-sm m-0 mt-1 leading-none">Comprehensive list of all students and their account status.</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-800/50 rounded-full border border-white/10">
              <span className="material-symbols-outlined text-sm text-slate-400">admin_panel_settings</span>
              <span className="text-sm font-medium text-white">{user?.name} (Admin)</span>
            </div>
          </div>
        </header>

        <div style={{ padding: '0 40px 40px' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {error && <div style={{ padding: '16px', backgroundColor: 'rgba(255,107,107,0.1)', color: '#FF6B6B', borderRadius: '12px' }}>{error}</div>}

            {/* Student Directory Table */}
            <div className="glass-card" style={{ borderRadius: '24px', backgroundColor: 'rgba(26, 37, 64, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                  <div style={{ position: 'relative' }} ref={filterDropdownRef}>
                    <button 
                      onClick={() => {
                        if (!isFilterDropdownOpen && filterDropdownRef.current) setFilterDropdownRect(filterDropdownRef.current.getBoundingClientRect());
                        setIsFilterDropdownOpen(!isFilterDropdownOpen);
                      }}
                      style={{ padding: '10px', borderRadius: '12px', backgroundColor: filterType !== 'all' ? 'rgba(108, 99, 255, 0.2)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)', color: filterType !== 'all' ? '#6C63FF' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>filter_list</span>
                    </button>
                    {isFilterDropdownOpen && filterDropdownRect && createPortal(
                      <div
                        ref={portalFilterDropdownRef}
                        style={{
                          position: 'fixed', top: filterDropdownRect.bottom + 8, left: filterDropdownRect.right - 150, width: '150px',
                          backgroundColor: '#0F1729', border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '12px', zIndex: 9999, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden'
                        }}
                      >
                        {[
                          { id: 'all', label: 'All Students' },
                          { id: 'active', label: 'Active Only' },
                          { id: 'inactive', label: 'Inactive Only' },
                          { id: 'owner', label: 'Owners Only' },
                          { id: 'no_room', label: 'Not in a Room' },
                          { id: 'low_balance', label: 'Low Balance' }
                        ].map(opt => (
                          <div
                            key={opt.id}
                            style={{ padding: '12px 16px', fontSize: '12px', fontWeight: filterType === opt.id ? 'bold' : 'normal', cursor: 'pointer', color: filterType === opt.id ? 'white' : '#8892B0', backgroundColor: filterType === opt.id ? 'rgba(108, 99, 255, 0.2)' : 'transparent', borderBottom: opt.id !== 'low_balance' ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                            onMouseEnter={(e) => { if (filterType !== opt.id) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)' }}
                            onMouseLeave={(e) => { if (filterType !== opt.id) e.currentTarget.style.backgroundColor = 'transparent' }}
                            onClick={() => { setFilterType(opt.id); setStudentPage(1); setIsFilterDropdownOpen(false); }}
                          >
                            {opt.label}
                          </div>
                        ))}
                      </div>, document.body
                    )}
                  </div>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead style={{ backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8' }}>
                    <tr>
                      <th style={{ padding: '10px 24px' }}>Student</th>
                      <th style={{ padding: '10px 24px' }}>Room</th>
                      <th style={{ padding: '10px 24px' }}>Status</th>
                      <th style={{ padding: '10px 24px' }}>Wallet Bal.</th>
                      <th style={{ padding: '10px 24px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody style={{ divideY: '1px solid rgba(255,255,255,0.05)' }}>
                    {(() => {
                      const totalPages = Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE);
                      const paginatedStudents = filteredStudents.slice((studentPage - 1) * STUDENTS_PER_PAGE, studentPage * STUDENTS_PER_PAGE);

                      if (isLoading && students.length === 0) return (
                        <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>Loading students...</td></tr>
                      );
                      if (filteredStudents.length === 0) return (
                        <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>No students found</td></tr>
                      );
                      return (
                        <>
                          {paginatedStudents.map(st => (
                            <tr key={st.u_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                              <td style={{ padding: '10px 24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(108, 99, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6C63FF', fontSize: '12px', fontWeight: 'bold' }}>
                                    {st.name.substring(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <span style={{ fontSize: '14px', fontWeight: '600', color: 'white', display: 'block' }}>{st.name}</span>
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: '10px 24px' }}>
                                <span style={{ fontSize: '14px', color: 'white', fontWeight: '500' }}>{st.room_no || 'None'}</span>
                                {st.room_role && <span style={{ fontSize: '10px', color: '#6C63FF', display: 'block', textTransform: 'capitalize' }}>{st.room_role}</span>}
                              </td>
                              <td style={{ padding: '10px 24px' }}>
                                {st.is_active
                                  ? <span style={{ padding: '4px 8px', borderRadius: '9999px', backgroundColor: 'rgba(0, 212, 170, 0.1)', color: '#00D4AA', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Active</span>
                                  : <span style={{ padding: '4px 8px', borderRadius: '9999px', backgroundColor: 'rgba(255, 107, 107, 0.1)', color: '#FF6B6B', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Inactive</span>
                                }
                              </td>
                              <td style={{ padding: '10px 24px', fontSize: '14px', fontWeight: '600', color: parseFloat(st.balance) > 100 ? '#00D4AA' : (parseFloat(st.balance) < 0 ? '#FF6B6B' : '#F59E0B') }}>
                                ₹{parseFloat(st.balance || 0).toFixed(2)}
                              </td>
                              <td style={{ padding: '10px 24px', textAlign: 'right' }}>
                                <button
                                  onClick={() => { setSelectedStudent(st); setActiveTab('profile'); }}
                                  style={{ padding: '6px 16px', backgroundColor: '#6C63FF', color: 'white', fontSize: '12px', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer', transition: 'opacity 0.2s' }}
                                  onMouseOver={e => e.currentTarget.style.opacity = 0.8}
                                  onMouseOut={e => e.currentTarget.style.opacity = 1}
                                >
                                  View Details
                                </button>
                              </td>
                            </tr>
                          ))}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {filteredStudents.length > 0 && Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE) > 1 && (() => {
                const totalPages = Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE);
                const pages = getPaginationRange(studentPage, totalPages);
                return (
                  <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                    <div style={{ fontSize: '13px', color: '#94A3B8' }}>
                      Showing {((studentPage - 1) * STUDENTS_PER_PAGE) + 1} to {Math.min(studentPage * STUDENTS_PER_PAGE, filteredStudents.length)} of {filteredStudents.length} students
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setStudentPage(p => Math.max(1, p - 1))}
                        disabled={studentPage === 1}
                        style={{ padding: '6px 12px', borderRadius: '8px', backgroundColor: studentPage === 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)', color: studentPage === 1 ? '#64748B' : 'white', border: 'none', cursor: studentPage === 1 ? 'not-allowed' : 'pointer' }}
                      >
                        Prev
                      </button>
                      {pages.map((p, i) => (
                        <button
                          key={i}
                          onClick={() => p !== '...' && setStudentPage(p)}
                          style={{
                            padding: '6px 12px', borderRadius: '8px',
                            backgroundColor: studentPage === p ? '#6C63FF' : 'rgba(255,255,255,0.05)',
                            color: studentPage === p ? 'white' : '#94A3B8',
                            border: 'none', cursor: p === '...' ? 'default' : 'pointer',
                            fontWeight: studentPage === p ? 'bold' : 'normal'
                          }}
                        >
                          {p}
                        </button>
                      ))}
                      <button
                        onClick={() => setStudentPage(p => Math.min(totalPages, p + 1))}
                        disabled={studentPage === totalPages}
                        style={{ padding: '6px 12px', borderRadius: '8px', backgroundColor: studentPage === totalPages ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)', color: studentPage === totalPages ? '#64748B' : 'white', border: 'none', cursor: studentPage === totalPages ? 'not-allowed' : 'pointer' }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

          </div>

          {/* Student Details Modal */}
          {selectedStudent && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 41, 0.8)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
              <div className="glass-card" style={{ width: '100%', maxWidth: '500px', backgroundColor: 'rgba(30, 41, 59, 0.9)', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.1)', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>

                {/* Modal Header */}
                <div style={{ padding: '14px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', margin: 0 }}>Student Profile</h3>
                  <button onClick={() => setSelectedStudent(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex', padding: '4px', borderRadius: '50%' }} onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                {/* Tabs Navigation */}
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.1)' }}>
                  <button onClick={() => setActiveTab('profile')} style={{ flex: 1, padding: '12px', background: 'none', border: 'none', borderBottom: activeTab === 'profile' ? '2px solid #6C63FF' : '2px solid transparent', color: activeTab === 'profile' ? 'white' : '#94A3B8', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', transition: 'all 0.2s' }}>Profile</button>
                  <button onClick={() => setActiveTab('history')} style={{ flex: 1, padding: '12px', background: 'none', border: 'none', borderBottom: activeTab === 'history' ? '2px solid #6C63FF' : '2px solid transparent', color: activeTab === 'history' ? 'white' : '#94A3B8', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', transition: 'all 0.2s' }}>History</button>
                  <button onClick={() => setActiveTab('danger')} style={{ flex: 1, padding: '12px', background: 'none', border: 'none', borderBottom: activeTab === 'danger' ? '2px solid #FF6B6B' : '2px solid transparent', color: activeTab === 'danger' ? '#FF6B6B' : '#94A3B8', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', transition: 'all 0.2s' }}>Danger Zone</button>
                </div>

                {/* Modal Body */}
                <div style={{ padding: '20px', height: '360px', overflowY: 'auto' }}>
                  {activeTab === 'profile' && (
                    <div className="fade-in">
                      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(108, 99, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6C63FF', fontSize: '24px', fontWeight: 'bold', flexShrink: 0 }}>
                          {selectedStudent.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', margin: '0 0 4px 0' }}>{selectedStudent.name}</h4>
                          <p style={{ fontSize: '14px', color: '#94A3B8', margin: 0 }}>ID: {selectedStudent.u_id}</p>
                          <div style={{ marginTop: '8px' }}>
                            {selectedStudent.is_active
                              ? <span style={{ padding: '4px 10px', borderRadius: '9999px', backgroundColor: 'rgba(0, 212, 170, 0.1)', color: '#00D4AA', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Active Account</span>
                              : <span style={{ padding: '4px 10px', borderRadius: '9999px', backgroundColor: 'rgba(255, 107, 107, 0.1)', color: '#FF6B6B', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Inactive Account</span>
                            }
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.02)' }}>
                        <div>
                          <span style={{ display: 'block', fontSize: '12px', color: '#64748B', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contact Info</span>
                          <p style={{ margin: '0 0 4px 0', color: 'white', fontSize: '14px' }}>{selectedStudent.email}</p>
                          <p style={{ margin: 0, color: '#94A3B8', fontSize: '14px' }}>{selectedStudent.mobile}</p>
                        </div>
                        <div>
                          <span style={{ display: 'block', fontSize: '12px', color: '#64748B', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Accommodation</span>
                          <p style={{ margin: '0 0 4px 0', color: 'white', fontSize: '14px' }}>Room {selectedStudent.room_no || 'Unassigned'}</p>
                          {selectedStudent.room_role && <p style={{ margin: 0, color: '#6C63FF', fontSize: '14px', textTransform: 'capitalize' }}>Role: {selectedStudent.room_role}</p>}
                        </div>
                      </div>

                      <div style={{ marginTop: '16px', backgroundColor: 'rgba(108, 99, 255, 0.05)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(108, 99, 255, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ display: 'block', fontSize: '12px', color: '#64748B', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Wallet Balance</span>
                          <h2 style={{ margin: 0, fontSize: '24px', color: parseFloat(selectedStudent.balance) > 100 ? '#00D4AA' : (parseFloat(selectedStudent.balance) < 0 ? '#FF6B6B' : '#F59E0B') }}>
                            ₹{parseFloat(selectedStudent.balance || 0).toFixed(2)}
                          </h2>
                        </div>
                        <button style={{ padding: '8px 16px', backgroundColor: 'rgba(108, 99, 255, 0.1)', color: '#6C63FF', borderRadius: '8px', border: '1px solid rgba(108, 99, 255, 0.2)', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                          Add Funds
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'history' && (
                    <div className="fade-in">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h4 style={{ color: 'white', margin: 0, fontSize: '16px' }}>Recent Transactions</h4>
                      </div>
                      
                      {isHistoryLoading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '150px', color: '#94A3B8' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '32px', opacity: 0.5, marginBottom: '8px', animation: 'spin 1s linear infinite' }}>refresh</span>
                          <p style={{ fontSize: '14px', margin: 0 }}>Loading history...</p>
                        </div>
                      ) : !studentHistory ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '150px', color: '#94A3B8' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '32px', opacity: 0.5, marginBottom: '8px' }}>history</span>
                          <p style={{ fontSize: '14px', margin: 0 }}>History unavailable.</p>
                        </div>
                      ) : studentHistory.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#94A3B8', padding: '32px 0' }}>
                          No transactions found for this student.
                        </div>
                      ) : (
                        <div style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                          {studentHistory.map(txn => (
                            <div key={txn.txn_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <div>
                                <p style={{ margin: '0 0 4px 0', color: 'white', fontSize: '13px', fontWeight: '500' }}>{txn.description}</p>
                                <p style={{ margin: 0, color: '#64748B', fontSize: '11px' }}>{new Date(txn.created_at).toLocaleString()}</p>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <span style={{ color: txn.type === 'consumption' || txn.type === 'deduction' ? '#FF6B6B' : '#00D4AA', fontWeight: 'bold', fontSize: '14px' }}>
                                  {txn.type === 'consumption' || txn.type === 'deduction' ? '-' : '+'}₹{parseFloat(txn.amount).toFixed(2)}
                                </span>
                                <span style={{ color: '#94A3B8', fontSize: '11px', textTransform: 'capitalize', marginTop: '2px' }}>{txn.type}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'danger' && (
                    <div className="fade-in">
                      <div style={{ backgroundColor: 'rgba(255, 107, 107, 0.05)', border: '1px solid rgba(255, 107, 107, 0.2)', borderRadius: '16px', padding: '20px' }}>
                        <h4 style={{ color: '#FF6B6B', margin: '0 0 8px 0', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>warning</span>
                          Suspend Account
                        </h4>
                        <p style={{ color: '#94A3B8', fontSize: '13px', lineHeight: '1.5', margin: '0 0 20px 0' }}>
                          Suspending this account will immediately revoke the student's access to the FairAC mobile app. They will not be able to log in or start AC sessions until an admin reactivates their account. Their data and wallet balance will remain intact.
                        </p>
                        
                        <button 
                          onClick={() => handleToggleStatus(selectedStudent.u_id, selectedStudent.is_active)} 
                          style={{ width: '100%', padding: '12px', backgroundColor: selectedStudent.is_active ? 'rgba(255, 107, 107, 0.1)' : 'rgba(0, 212, 170, 0.1)', color: selectedStudent.is_active ? '#FF6B6B' : '#00D4AA', borderRadius: '8px', border: selectedStudent.is_active ? '1px solid rgba(255, 107, 107, 0.3)' : '1px solid rgba(0, 212, 170, 0.3)', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }} 
                          onMouseOver={e => e.currentTarget.style.backgroundColor = selectedStudent.is_active ? 'rgba(255, 107, 107, 0.2)' : 'rgba(0, 212, 170, 0.2)'} 
                          onMouseOut={e => e.currentTarget.style.backgroundColor = selectedStudent.is_active ? 'rgba(255, 107, 107, 0.1)' : 'rgba(0, 212, 170, 0.1)'}
                        >
                          {selectedStudent.is_active ? 'Suspend Student' : 'Reactivate Student'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default AdminStudentsPage;
