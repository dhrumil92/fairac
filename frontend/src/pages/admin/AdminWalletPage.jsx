import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/layout/Sidebar';
import api from '../../api/axios';

const AdminWalletPage = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [filterStudent, setFilterStudent] = useState('all');
  const [studentsList, setStudentsList] = useState([]);
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
  const studentDropdownRef = useRef(null);
  const portalDropdownRef = useRef(null);
  const [dropdownRect, setDropdownRect] = useState(null);
  
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const typeDropdownRef = useRef(null);
  const portalTypeDropdownRef = useRef(null);
  const [typeDropdownRect, setTypeDropdownRect] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        studentDropdownRef.current && 
        !studentDropdownRef.current.contains(event.target) &&
        (!portalDropdownRef.current || !portalDropdownRef.current.contains(event.target))
      ) {
        setIsStudentDropdownOpen(false);
      }

      if (
        typeDropdownRef.current && 
        !typeDropdownRef.current.contains(event.target) &&
        (!portalTypeDropdownRef.current || !portalTypeDropdownRef.current.contains(event.target))
      ) {
        setIsTypeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Recharge form state
  const [studentId, setStudentId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchTransactions = async (page = 1, type = filterType, date = filterDate, student = filterStudent) => {
    try {
      setIsLoading(true);
      let query = `?page=${page}&limit=7`;
      if (type !== 'all') query += `&type=${type}`;
      if (date) query += `&date=${date}`;
      if (student !== 'all') query += `&student=${student}`;
      const res = await api.get(`/admin/transactions${query}`);
      setTransactions(res.data.data.transactions || []);
      setPagination(res.data.data.pagination || null);
      setCurrentPage(page);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load transactions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions(1);

    const fetchStudents = async () => {
      try {
        const res = await api.get('/admin/students');
        const studentsArray = res.data?.data?.students || [];
        const sortedStudents = studentsArray.sort((a, b) => a.name.localeCompare(b.name));
        setStudentsList(sortedStudents);
      } catch (err) {
        console.error('Failed to load students list', err);
      }
    };
    fetchStudents();
  }, []);

  const handleRecharge = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      const res = await api.post('/admin/recharge', {
        student_identifier: studentId,
        amount: parseFloat(amount),
        note: note
      });
      setSuccessMsg(res.data.message);
      setStudentId('');
      setAmount('');
      setNote('');
      fetchTransactions(1); // Refresh ledger to page 1
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to authorize credit transfer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-layout" style={{ backgroundColor: '#0F1729', color: '#F8FAFC', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <Sidebar />
      <main className="page-main" style={{ padding: '0' }}>

        {/* Top Navigation Bar */}
        <header className="flex justify-between items-center px-8 py-4 w-full sticky top-0 z-40 bg-[#0F1729]/80 backdrop-blur-md border-b border-white/10" style={{ marginBottom: '24px' }}>
          <div className="flex flex-col gap-1" style={{ marginLeft: '16px' }}>
            <h2 className="font-headline text-2xl font-bold text-white tracking-tight m-0 leading-none">Wallet Operations</h2>
            <p className="text-slate-400 text-sm m-0 mt-1 leading-none">Manage student balances and view system-wide transaction history.</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-800/50 rounded-full border border-white/10">
              <span className="material-symbols-outlined text-sm text-slate-400">admin_panel_settings</span>
              <span className="text-sm font-medium text-white">{user?.name} {user?.role === 'super_admin' ? '(Super Admin)' : '(Admin)'}</span>
            </div>
          </div>
        </header>

        <div style={{ padding: '0 40px 40px' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {error && <div style={{ padding: '16px', backgroundColor: 'rgba(255,107,107,0.1)', color: '#FF6B6B', borderRadius: '12px' }}>{error}</div>}
            {successMsg && <div style={{ padding: '16px', backgroundColor: 'rgba(0,212,170,0.1)', color: '#00D4AA', borderRadius: '12px' }}>{successMsg}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: user?.role === 'super_admin' ? '1fr 2fr' : '1fr', gap: '32px' }}>

              {/* Manual Credit Transfer Form (Super Admin Only) */}
              {user?.role === 'super_admin' && (
                <section style={{ minWidth: 0 }}>
                  <div className="glass-card" style={{ padding: '32px', borderRadius: '24px', backgroundColor: 'rgba(26, 37, 64, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(108, 99, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6C63FF' }}>
                        <span className="material-symbols-outlined">account_balance</span>
                      </div>
                      <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>Manual Credit Transfer</h3>
                    </div>

                    <form onSubmit={handleRecharge} style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#94A3B8', textTransform: 'uppercase', marginBottom: '8px' }}>Student Email or Mobile</label>
                        <input
                          type="text"
                          value={studentId}
                          onChange={(e) => setStudentId(e.target.value)}
                          required
                          placeholder="e.g. arjun@university.edu"
                          style={{ width: '100%', padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(15, 23, 41, 0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#94A3B8', textTransform: 'uppercase', marginBottom: '8px' }}>Amount to Credit (₹)</label>
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          required
                          min="1"
                          placeholder="0.00"
                          style={{ width: '100%', padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(15, 23, 41, 0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#94A3B8', textTransform: 'uppercase', marginBottom: '8px' }}>Note/Reason</label>
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Describe the reason for this manual adjustment..."
                          rows="4"
                          style={{ width: '100%', padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(15, 23, 41, 0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', boxSizing: 'border-box', resize: 'none' }}
                        />
                      </div>

                      <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          style={{ width: '100%', padding: '16px', backgroundColor: isSubmitting ? '#4B5563' : '#6C63FF', color: 'white', fontWeight: 'bold', borderRadius: '12px', border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <span className="material-symbols-outlined">{isSubmitting ? 'sync' : 'verified_user'}</span>
                          {isSubmitting ? 'Authorizing...' : 'Authorize Credit Transfer'}
                        </button>
                        <p style={{ fontSize: '10px', textAlign: 'center', color: '#64748B', marginTop: '16px', lineHeight: 1.5 }}>
                          Authorized transfers are recorded instantly and cannot be reversed manually. All transactions are logged for auditing purposes.
                        </p>
                      </div>
                    </form>
                  </div>
                </section>
              )}

              {/* Transactions Ledger */}
              <section style={{ minWidth: 0 }}>
                <div className="glass-card" style={{ borderRadius: '24px', backgroundColor: 'rgba(26, 37, 64, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(0, 212, 170, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00D4AA' }}>
                        <span className="material-symbols-outlined">receipt_long</span>
                      </div>
                      <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>Recent Transactions Ledger</h3>
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto', flex: 1 }}>
                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                      <thead style={{ backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8' }}>
                        <tr>
                          <th style={{ padding: '16px 24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div
                                onClick={() => {
                                  const el = document.getElementById('admin-date-filter');
                                  if (el && el.showPicker) el.showPicker();
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                              >
                                <span>Date</span>
                                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: filterDate ? '#00D4AA' : '#6C63FF' }}>calendar_month</span>
                              </div>
                              {filterDate && (
                                <span
                                  className="material-symbols-outlined"
                                  style={{ fontSize: '14px', color: '#FF6B6B', cursor: 'pointer' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFilterDate('');
                                    fetchTransactions(1, filterType, '', filterStudent);
                                  }}
                                  title="Clear date filter"
                                >
                                  close
                                </span>
                              )}
                              <input
                                id="admin-date-filter"
                                type="date"
                                style={{
                                  position: 'absolute',
                                  opacity: 0,
                                  pointerEvents: 'none',
                                  width: '1px',
                                  height: '1px',
                                  border: 0,
                                  padding: 0
                                }}
                                value={filterDate}
                                onChange={(e) => {
                                  setFilterDate(e.target.value);
                                  fetchTransactions(1, filterType, e.target.value, filterStudent);
                                }}
                              />
                            </div>
                          </th>
                          <th style={{ padding: '16px 24px' }}>
                            <div ref={studentDropdownRef} style={{ position: 'relative', display: 'inline-block', width: '180px' }}>
                              <div 
                                className="bg-[#0F1729] border border-white/10 rounded-lg py-1.5 px-3 text-xs text-white cursor-pointer flex justify-between items-center hover:border-white/20 transition-colors"
                                onClick={() => {
                                  if (!isStudentDropdownOpen && studentDropdownRef.current) {
                                    setDropdownRect(studentDropdownRef.current.getBoundingClientRect());
                                  }
                                  setIsStudentDropdownOpen(!isStudentDropdownOpen);
                                }}
                                style={{ height: '31px' }}
                              >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {filterStudent === 'all'
                                    ? 'STUDENT: ALL'
                                    : studentsList.find(s => String(s.u_id) === String(filterStudent))?.name.toUpperCase() || 'STUDENT: ALL'}
                                </span>
                                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#6C63FF' }}>
                                  keyboard_arrow_down
                                </span>
                              </div>
                              {isStudentDropdownOpen && dropdownRect && createPortal(
                                <div 
                                  ref={portalDropdownRef}
                                  style={{ 
                                    position: 'fixed', top: dropdownRect.bottom + 4, left: dropdownRect.left, width: dropdownRect.width, 
                                    backgroundColor: '#0F1729', border: '1px solid rgba(255,255,255,0.1)', 
                                    borderRadius: '8px', zIndex: 9999, boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                                    display: 'flex', flexDirection: 'column', overflow: 'hidden'
                                  }}
                                >
                                  <div 
                                    style={{ 
                                      padding: '10px 12px', fontSize: '12px', fontWeight: 'bold', color: 'white', 
                                      cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.1)',
                                      position: 'sticky', top: 0, backgroundColor: '#0F1729', zIndex: 10
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(108, 99, 255, 0.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0F1729'}
                                    onClick={() => {
                                      setFilterStudent('all');
                                      fetchTransactions(1, filterType, filterDate, 'all');
                                      setIsStudentDropdownOpen(false);
                                    }}
                                  >
                                    STUDENT: ALL
                                  </div>
                                  <div style={{ maxHeight: '270px', overflowY: 'auto' }}>
                                    {studentsList.map(s => (
                                      <div 
                                        key={s.u_id}
                                        style={{ 
                                          padding: '10px 12px', fontSize: '12px', cursor: 'pointer',
                                          color: String(filterStudent) === String(s.u_id) ? 'white' : '#8892B0',
                                          backgroundColor: String(filterStudent) === String(s.u_id) ? 'rgba(108, 99, 255, 0.2)' : 'transparent',
                                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                        }}
                                        onMouseEnter={(e) => { if (String(filterStudent) !== String(s.u_id)) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)' }}
                                        onMouseLeave={(e) => { if (String(filterStudent) !== String(s.u_id)) e.currentTarget.style.backgroundColor = 'transparent' }}
                                        onClick={() => {
                                          setFilterStudent(s.u_id);
                                          fetchTransactions(1, filterType, filterDate, s.u_id);
                                          setIsStudentDropdownOpen(false);
                                        }}
                                      >
                                        {s.name.toUpperCase()}
                                      </div>
                                    ))}
                                  </div>
                                </div>,
                                document.body
                              )}
                            </div>
                          </th>
                          <th style={{ padding: '16px 24px', textAlign: 'center' }}>
                            <div ref={typeDropdownRef} style={{ position: 'relative', display: 'inline-block', width: '140px' }}>
                              <div 
                                className="bg-[#0F1729] border border-white/10 rounded-lg py-1.5 px-3 text-xs text-white cursor-pointer flex justify-between items-center hover:border-white/20 transition-colors"
                                onClick={() => {
                                  if (!isTypeDropdownOpen && typeDropdownRef.current) {
                                    setTypeDropdownRect(typeDropdownRef.current.getBoundingClientRect());
                                  }
                                  setIsTypeDropdownOpen(!isTypeDropdownOpen);
                                }}
                                style={{ height: '31px' }}
                              >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {filterType === 'all' ? 'TYPE: ALL' : filterType === 'credit' ? 'CREDITS' : 'DEDUCTIONS'}
                                </span>
                                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#6C63FF' }}>
                                  keyboard_arrow_down
                                </span>
                              </div>
                              
                              {isTypeDropdownOpen && typeDropdownRect && createPortal(
                                <div 
                                  ref={portalTypeDropdownRef}
                                  style={{ 
                                    position: 'fixed', top: typeDropdownRect.bottom + 4, left: typeDropdownRect.left, width: typeDropdownRect.width, 
                                    backgroundColor: '#0F1729', border: '1px solid rgba(255,255,255,0.1)', 
                                    borderRadius: '8px', zIndex: 9999, boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                                    display: 'flex', flexDirection: 'column', overflow: 'hidden'
                                  }}
                                >
                                  <div 
                                    style={{ 
                                      padding: '10px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                                      color: filterType === 'all' ? 'white' : '#8892B0',
                                      backgroundColor: filterType === 'all' ? 'rgba(108, 99, 255, 0.2)' : 'transparent',
                                      borderBottom: '1px solid rgba(255,255,255,0.1)'
                                    }}
                                    onMouseEnter={(e) => { if (filterType !== 'all') e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)' }}
                                    onMouseLeave={(e) => { if (filterType !== 'all') e.currentTarget.style.backgroundColor = 'transparent' }}
                                    onClick={() => {
                                      setFilterType('all');
                                      fetchTransactions(1, 'all', filterDate, filterStudent);
                                      setIsTypeDropdownOpen(false);
                                    }}
                                  >
                                    TYPE: ALL
                                  </div>
                                  <div 
                                    style={{ 
                                      padding: '10px 12px', fontSize: '12px', cursor: 'pointer',
                                      color: filterType === 'credit' ? 'white' : '#8892B0',
                                      backgroundColor: filterType === 'credit' ? 'rgba(108, 99, 255, 0.2)' : 'transparent',
                                    }}
                                    onMouseEnter={(e) => { if (filterType !== 'credit') e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)' }}
                                    onMouseLeave={(e) => { if (filterType !== 'credit') e.currentTarget.style.backgroundColor = 'transparent' }}
                                    onClick={() => {
                                      setFilterType('credit');
                                      fetchTransactions(1, 'credit', filterDate, filterStudent);
                                      setIsTypeDropdownOpen(false);
                                    }}
                                  >
                                    CREDITS
                                  </div>
                                  <div 
                                    style={{ 
                                      padding: '10px 12px', fontSize: '12px', cursor: 'pointer',
                                      color: filterType === 'deduction' ? 'white' : '#8892B0',
                                      backgroundColor: filterType === 'deduction' ? 'rgba(108, 99, 255, 0.2)' : 'transparent',
                                    }}
                                    onMouseEnter={(e) => { if (filterType !== 'deduction') e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)' }}
                                    onMouseLeave={(e) => { if (filterType !== 'deduction') e.currentTarget.style.backgroundColor = 'transparent' }}
                                    onClick={() => {
                                      setFilterType('deduction');
                                      fetchTransactions(1, 'deduction', filterDate, filterStudent);
                                      setIsTypeDropdownOpen(false);
                                    }}
                                  >
                                    DEDUCTIONS
                                  </div>
                                </div>,
                                document.body
                              )}
                            </div>
                          </th>
                          <th style={{ padding: '16px 24px', textAlign: 'right' }}>Amount</th>
                          <th style={{ padding: '16px 24px' }}>Note</th>
                        </tr>
                      </thead>
                      <tbody style={{ divideY: '1px solid rgba(255,255,255,0.05)' }}>
                        {isLoading ? (
                          <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>Loading ledger...</td></tr>
                        ) : transactions.length === 0 ? (
                          <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>No transactions found</td></tr>
                        ) : transactions.map(tx => (
                          <tr key={tx.txn_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '16px 24px', whiteSpace: 'nowrap' }}>
                              <p style={{ fontSize: '14px', color: 'white', margin: 0, fontWeight: '500' }}>{new Date(tx.created_at).toLocaleDateString()}</p>
                              <p style={{ fontSize: '10px', color: '#64748B', margin: 0 }}>{new Date(tx.created_at).toLocaleTimeString()}</p>
                            </td>
                            <td style={{ padding: '16px 24px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(15, 23, 41, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '10px', fontWeight: 'bold' }}>
                                  {tx.student_name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p style={{ fontSize: '14px', color: 'white', margin: 0, fontWeight: '600' }}>{tx.student_name}</p>
                                  <p style={{ fontSize: '10px', color: '#64748B', margin: 0 }}>{tx.student_email}</p>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-flex', padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '500',
                                backgroundColor: tx.type === 'recharge' ? 'rgba(0,212,170,0.1)' : 'rgba(255,107,107,0.1)',
                                color: tx.type === 'recharge' ? '#00D4AA' : '#FF6B6B',
                                border: `1px solid ${tx.type === 'recharge' ? 'rgba(0,212,170,0.2)' : 'rgba(255,107,107,0.2)'}`
                              }}>
                                {tx.type === 'recharge' ? 'Credit' : 'Deduction'}
                              </span>
                            </td>
                            <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 'bold', color: tx.type === 'recharge' ? '#00D4AA' : '#FF6B6B' }}>
                              {tx.type === 'recharge' ? '+' : '-'}₹{Math.abs(tx.amount).toFixed(2)}
                            </td>
                            <td style={{ padding: '16px 24px' }}>
                              <p style={{ fontSize: '14px', color: '#CBD5E1', margin: 0, maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {tx.description}
                              </p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  {pagination && pagination.total_pages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(15, 23, 41, 0.5)' }}>
                      <span style={{ fontSize: '14px', color: '#94A3B8' }}>
                        Showing page {pagination.page} of {pagination.total_pages} ({pagination.total} records)
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => fetchTransactions(currentPage - 1, filterType, filterDate, filterStudent)}
                          disabled={!pagination.has_prev}
                          style={{ padding: '8px 16px', backgroundColor: pagination.has_prev ? 'rgba(108, 99, 255, 0.1)' : 'rgba(255,255,255,0.05)', color: pagination.has_prev ? '#6C63FF' : '#475569', border: '1px solid ' + (pagination.has_prev ? 'rgba(108, 99, 255, 0.3)' : 'transparent'), borderRadius: '8px', cursor: pagination.has_prev ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>
                          Previous
                        </button>
                        <button
                          onClick={() => fetchTransactions(currentPage + 1, filterType, filterDate, filterStudent)}
                          disabled={!pagination.has_next}
                          style={{ padding: '8px 16px', backgroundColor: pagination.has_next ? 'rgba(108, 99, 255, 0.1)' : 'rgba(255,255,255,0.05)', color: pagination.has_next ? '#6C63FF' : '#475569', border: '1px solid ' + (pagination.has_next ? 'rgba(108, 99, 255, 0.3)' : 'transparent'), borderRadius: '8px', cursor: pagination.has_next ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminWalletPage;
