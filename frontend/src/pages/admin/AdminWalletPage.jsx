import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/layout/Sidebar';
import api from '../../api/axios';

const AdminWalletPage = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Recharge form state
  const [studentId, setStudentId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchTransactions = async (page = 1) => {
    try {
      setIsLoading(true);
      const res = await api.get(`/admin/transactions?page=${page}&limit=7`);
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
      <main className="page-main" style={{ padding: '40px', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Header */}
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '30px', fontWeight: 'bold', fontFamily: '"Plus Jakarta Sans", sans-serif', color: 'white' }}>Wallet Operations</h2>
              <p style={{ color: '#94A3B8', fontSize: '14px' }}>Manage student balances and view system-wide transaction history.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 12px', backgroundColor: '#1A2540', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }}>
                <span className="material-symbols-outlined" style={{ color: '#6C63FF' }}>admin_panel_settings</span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: 'white' }}>{user?.name}</span>
              </div>
            </div>
          </header>

          {error && <div style={{ padding: '16px', backgroundColor: 'rgba(255,107,107,0.1)', color: '#FF6B6B', borderRadius: '12px' }}>{error}</div>}
          {successMsg && <div style={{ padding: '16px', backgroundColor: 'rgba(0,212,170,0.1)', color: '#00D4AA', borderRadius: '12px' }}>{successMsg}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px' }}>
            
            {/* Manual Credit Transfer Form */}
            <section>
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

            {/* Transactions Ledger */}
            <section>
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
                        <th style={{ padding: '16px 24px' }}>Date</th>
                        <th style={{ padding: '16px 24px' }}>Student</th>
                        <th style={{ padding: '16px 24px', textAlign: 'center' }}>Type</th>
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
                        onClick={() => fetchTransactions(currentPage - 1)}
                        disabled={!pagination.has_prev}
                        style={{ padding: '8px 16px', backgroundColor: pagination.has_prev ? 'rgba(108, 99, 255, 0.1)' : 'rgba(255,255,255,0.05)', color: pagination.has_prev ? '#6C63FF' : '#475569', border: '1px solid ' + (pagination.has_prev ? 'rgba(108, 99, 255, 0.3)' : 'transparent'), borderRadius: '8px', cursor: pagination.has_prev ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>
                        Previous
                      </button>
                      <button 
                        onClick={() => fetchTransactions(currentPage + 1)}
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
      </main>
    </div>
  );
};

export default AdminWalletPage;
