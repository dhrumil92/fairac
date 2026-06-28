// =============================================================================
// src/pages/student/WalletPage.jsx
// Student Wallet Page — Built with Stitch Aesthetics
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import Toast from '../../components/ui/Toast';
import './StudentPages.css';

const StatCard = ({ icon, iconColor, iconBg, label, value }) => (
  <div className="stat-card glass-card">
    <div className="stat-card-header">
      <div className="stat-card-icon" style={{ background: iconBg, color: iconColor }}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
    </div>
    <p className="stat-label">{label}</p>
    <p className="stat-value">{value}</p>
  </div>
);

const Skeleton = ({ className }) => <div className={`skeleton ${className}`} />;

const WalletPage = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [toastMessage, setToastMessage] = useState(null);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [pagination, setPagination] = useState({});

  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const typeDropdownRef = useRef(null);
  const portalTypeDropdownRef = useRef(null);
  const [typeDropdownRect, setTypeDropdownRect] = useState(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
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

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      const [walletRes, txnRes] = await Promise.all([
        api.get('/wallet'),
        api.get(`/wallet/transactions?page=${page}&limit=7${filterType !== 'all' ? `&type=${filterType}` : ''}${filterDate ? `&date=${filterDate}` : ''}`)
      ]);
      setWallet(walletRes.data?.data?.wallet || null);
      setTransactions(txnRes.data?.data?.transactions || []);
      setPagination(txnRes.data?.data?.pagination || {});
    } catch (err) {
      if (err.response?.status !== 404) {
        setError(err.response?.data?.message || 'Failed to fetch wallet data.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchWalletData();
    // eslint-disable-next-line
  }, [page, filterType, filterDate]);

  useEffect(() => {
    if (window.location.hash === '#ledger' && !loading) {
      const el = document.getElementById('ledger');
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    }
  }, [loading]);

  const handleAddFundsClick = () => {
    setToastMessage('Please contact the Hostel Admin via UPI or Cash to recharge your wallet.');
  };

  return (
    <div className="page-layout">
      <Sidebar />
      {toastMessage && <Toast message={toastMessage} type="success" duration={10000} onClose={() => setToastMessage(null)} />}
      {error && <Toast message={error} type="error" duration={10000} onClose={() => setError('')} />}
      <main className="page-main" style={{ padding: '0' }}>
        {/* Top Navigation Bar */}
        <header className="flex justify-between items-center px-8 py-4 w-full sticky top-0 z-40 bg-[#0F1729]/80 backdrop-blur-md border-b border-white/10" style={{ marginBottom: '24px' }}>
          <div className="flex flex-col gap-1" style={{ marginLeft: '16px' }}>
            <h2 className="font-headline text-2xl font-bold text-white tracking-tight m-0 leading-none">My Wallet</h2>
            <p className="text-slate-400 text-sm m-0 mt-1 leading-none">Manage your funds and view transaction history</p>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/profile" className="flex items-center gap-2 px-4 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 cursor-pointer rounded-full border border-white/10 transition-colors" style={{ textDecoration: 'none' }}>
              <span className="material-symbols-outlined text-sm text-slate-400">person</span>
              <span className="text-sm font-medium text-white">{user?.name}</span>
            </Link>
          </div>
        </header>

        <div style={{ padding: '0 40px 40px' }}>
          {/* ── Top Metrics Section ── */}
          <section className="stats-grid" style={{ marginBottom: '32px' }}>
            {loading && !wallet ? (
              <>
                <Skeleton className="stat-card" style={{ height: '140px' }} />
                <Skeleton className="stat-card" style={{ height: '140px' }} />
                <Skeleton className="stat-card" style={{ height: '140px' }} />
              </>
            ) : (
              <>
                <StatCard
                  icon="account_balance_wallet"
                  iconColor="#00D4AA"
                  iconBg="rgba(0, 212, 170, 0.1)"
                  label="Current Balance"
                  value={`₹${parseFloat(wallet?.balance || 0).toFixed(2)}`}
                />
                <StatCard
                  icon="download"
                  iconColor="#6C63FF"
                  iconBg="rgba(108, 99, 255, 0.1)"
                  label="Total Recharged"
                  value={`₹${parseFloat(wallet?.total_recharged || 0).toFixed(2)}`}
                />
                <StatCard
                  icon="upload"
                  iconColor="#FF6B6B"
                  iconBg="rgba(255, 107, 107, 0.1)"
                  label="Total Spent"
                  value={`₹${parseFloat(wallet?.total_spent || 0).toFixed(2)}`}
                />
              </>
            )}
          </section>

          {/* ── Add Funds CTA ── */}
          <section className="add-funds-section glass-card" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', color: 'white', marginBottom: '8px' }}>Need more funds?</h2>
              <p style={{ color: '#8892B0', fontSize: '0.875rem' }}>Your current balance is {`₹${parseFloat(wallet?.balance || 0).toFixed(2)}`}. Add funds to continue booking AC sessions.</p>
            </div>
            <button
              onClick={handleAddFundsClick}
              className="w-full sm:w-auto py-3 px-6 bg-[#6C63FF] text-white font-semibold rounded-xl shadow-[0_0_20px_rgba(108,99,255,0.3)] transition-all hover:brightness-110 active:scale-95 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">add_circle</span>
              Recharge Wallet
            </button>
          </section>

          {/* ── Transaction History Table ── */}
          <section id="ledger" className="table-section glass-card">
            <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="section-heading">Transaction Ledger</h2>
            </div>
            <div className="table-wrapper">
              <table className="data-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '12px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          onClick={() => {
                            const el = document.getElementById('student-date-filter');
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
                              setPage(1);
                            }}
                            title="Clear date filter"
                          >
                            close
                          </span>
                        )}
                        <input
                          id="student-date-filter"
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
                            setPage(1);
                          }}
                        />
                      </div>
                    </th>
                    <th style={{ padding: '12px 24px' }}>Description</th>
                    <th style={{ padding: '12px 24px', textAlign: 'center' }}>
                      <div ref={typeDropdownRef} style={{ position: 'relative', display: 'inline-block', width: '150px' }}>
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
                            {filterType === 'all' ? 'TYPE: ALL' : filterType === 'consumption' ? 'CONSUMPTION' : 'RECHARGES'}
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
                                setPage(1);
                                setIsTypeDropdownOpen(false);
                              }}
                            >
                              TYPE: ALL
                            </div>
                            <div
                              style={{
                                padding: '10px 12px', fontSize: '12px', cursor: 'pointer',
                                color: filterType === 'consumption' ? 'white' : '#8892B0',
                                backgroundColor: filterType === 'consumption' ? 'rgba(108, 99, 255, 0.2)' : 'transparent',
                              }}
                              onMouseEnter={(e) => { if (filterType !== 'consumption') e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)' }}
                              onMouseLeave={(e) => { if (filterType !== 'consumption') e.currentTarget.style.backgroundColor = 'transparent' }}
                              onClick={() => {
                                setFilterType('consumption');
                                setPage(1);
                                setIsTypeDropdownOpen(false);
                              }}
                            >
                              CONSUMPTION
                            </div>
                            <div
                              style={{
                                padding: '10px 12px', fontSize: '12px', cursor: 'pointer',
                                color: filterType === 'recharge' ? 'white' : '#8892B0',
                                backgroundColor: filterType === 'recharge' ? 'rgba(108, 99, 255, 0.2)' : 'transparent',
                              }}
                              onMouseEnter={(e) => { if (filterType !== 'recharge') e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)' }}
                              onMouseLeave={(e) => { if (filterType !== 'recharge') e.currentTarget.style.backgroundColor = 'transparent' }}
                              onClick={() => {
                                setFilterType('recharge');
                                setPage(1);
                                setIsTypeDropdownOpen(false);
                              }}
                            >
                              RECHARGES
                            </div>
                          </div>,
                          document.body
                        )}
                      </div>
                    </th>
                    <th style={{ padding: '12px 24px' }}>Session ID</th>
                    <th style={{ padding: '12px 24px', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && transactions.length === 0 ? (
                    <tr>
                      <td colSpan="5">
                        <div className="table-loading" style={{ padding: '16px' }}>
                          {[1, 2, 3].map(i => <div key={i} className="table-row-skeleton skeleton" style={{ height: '40px', marginBottom: '8px', borderRadius: '4px' }} />)}
                        </div>
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan="5">
                        <div className="table-empty" style={{ textAlign: 'center', padding: '32px', color: '#8892B0' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '16px' }}>receipt_long</span>
                          <p>No transactions found.</p>
                        </div>
                      </td>
                    </tr>
                  ) : transactions.map((txn) => {
                    const isCredit = txn.type === 'recharge' || txn.type === 'refund';
                    const amountColor = isCredit ? '#00D4AA' : '#FF6B6B';
                    const amountSign = isCredit ? '+' : '-';
                    return (
                      <tr key={txn.txn_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '16px 24px', color: '#8892B0' }}>
                          {new Date(txn.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td style={{ padding: '16px 24px', color: 'white' }}>{txn.description}</td>
                        <td style={{ padding: '16px 24px', textTransform: 'capitalize', textAlign: 'center' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            backgroundColor: isCredit ? 'rgba(0, 212, 170, 0.1)' : 'rgba(255, 107, 107, 0.1)',
                            color: amountColor
                          }}>
                            {txn.type}
                          </span>
                        </td>
                        <td style={{ padding: '16px 24px', color: '#8892B0' }}>
                          {txn.session_id ? `#${String(txn.session_id).padStart(5, '0')}` : '—'}
                        </td>
                        <td style={{ padding: '16px 24px', color: amountColor, textAlign: 'right', fontWeight: 'bold' }}>
                          {amountSign}₹{parseFloat(txn.amount).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {pagination.total_pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', marginBottom: '16px', marginRight: '16px' }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={!pagination.has_prev}
                  style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: pagination.has_prev ? 'white' : '#555', cursor: pagination.has_prev ? 'pointer' : 'not-allowed' }}
                >
                  Previous
                </button>
                <span style={{ color: '#8892B0', display: 'flex', alignItems: 'center' }}>
                  Page {page} of {pagination.total_pages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pagination.total_pages, p + 1))}
                  disabled={!pagination.has_next}
                  style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: pagination.has_next ? 'white' : '#555', cursor: pagination.has_next ? 'pointer' : 'not-allowed' }}
                >
                  Next
                </button>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default WalletPage;
