// =============================================================================
// src/pages/student/WalletPage.jsx
// Student Wallet Page — Built with Stitch Aesthetics
// =============================================================================

import { useState, useEffect } from 'react';
import Sidebar from '../../components/layout/Sidebar';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import './StudentPages.css';
import Toast from '../../components/ui/Toast';

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
  const [pagination, setPagination] = useState({});
  const [toastMessage, setToastMessage] = useState('');

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      const [walletRes, txnRes] = await Promise.all([
        api.get('/wallet'),
        api.get(`/wallet/transactions?page=${page}&limit=10`)
      ]);
      setWallet(walletRes.data?.data?.wallet || null);
      setTransactions(txnRes.data?.data?.transactions || []);
      setPagination(txnRes.data?.data?.pagination || {});
    } catch (err) {
      console.error('Error fetching wallet:', err);
      setToastMessage('Failed to load wallet data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
    // eslint-disable-next-line
  }, [page]);

  const handleAddFundsClick = () => {
    setToastMessage('Please contact the Hostel Admin via UPI or Cash to recharge your wallet.');
  };

  return (
    <div className="page-layout">
      {toastMessage && (
        <Toast message={toastMessage} onClose={() => setToastMessage('')} />
      )}
      <Sidebar />
      <main className="page-main">
        <header className="page-header">
          <div>
            <h1 className="page-title">My Wallet</h1>
            <p className="page-subtitle">Manage your funds and view transaction history</p>
          </div>
        </header>

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
        <section className="table-section glass-card">
          <div className="table-header">
            <h2 className="section-heading">Transaction Ledger</h2>
          </div>

          {loading && transactions.length === 0 ? (
            <div className="table-loading">
              {[1, 2, 3].map(i => <div key={i} className="table-row-skeleton skeleton" style={{ height: '40px', marginBottom: '8px', borderRadius: '4px' }} />)}
            </div>
          ) : transactions.length === 0 ? (
            <div className="table-empty" style={{ textAlign: 'center', padding: '32px', color: '#8892B0' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '16px' }}>receipt_long</span>
              <p>No transactions found.</p>
            </div>
          ) : (
            <div className="table-wrapper" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="data-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '12px' }}>Date</th>
                    <th style={{ padding: '12px' }}>Description</th>
                    <th style={{ padding: '12px' }}>Type</th>
                    <th style={{ padding: '12px' }}>Session ID</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn) => {
                    const isCredit = txn.type === 'recharge' || txn.type === 'refund';
                    const amountColor = isCredit ? '#00D4AA' : '#FF6B6B';
                    const amountSign = isCredit ? '+' : '-';
                    return (
                      <tr key={txn.txn_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px', color: '#8892B0' }}>
                          {new Date(txn.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td style={{ padding: '12px', color: 'white' }}>{txn.description}</td>
                        <td style={{ padding: '12px', textTransform: 'capitalize' }}>
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
                        <td style={{ padding: '12px', color: '#8892B0' }}>
                          {txn.session_id ? `#${String(txn.session_id).padStart(5, '0')}` : '—'}
                        </td>
                        <td style={{ padding: '12px', color: amountColor, textAlign: 'right', fontWeight: 'bold' }}>
                          {amountSign}₹{parseFloat(txn.amount).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {pagination.total_pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
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
      </main>
    </div>
  );
};

export default WalletPage;
