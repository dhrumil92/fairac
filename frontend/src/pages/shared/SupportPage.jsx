import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import { useAuth } from '../../context/AuthContext';
import Toast from '../../components/ui/Toast';
import api from '../../api/axios';

const faqs = [
  {
    question: 'How do I add funds to my wallet?',
    answer: 'Currently, you need to contact your hostel admin and pay them via cash or UPI. They will manually credit the amount to your FairAC wallet.'
  },
  {
    question: 'Why is my AC offline?',
    answer: 'Ensure the smart meter device is powered on. If the issue persists, the WiFi connection in your room might be down or the device may need to be restarted by the admin.'
  },
  {
    question: 'How are units calculated?',
    answer: 'The smart meter continuously monitors real-time power consumption (in watts). The system converts this into kWh (units) over the duration of your session.'
  },
  {
    question: 'Can I share an AC session with my roommate?',
    answer: 'Yes! When you start a session, you can invite your roommates. The final cost of the consumed units will be split equally among all accepted participants.'
  }
];

// Generates page numbers to show: always First, Last, current ±1, with '...' gaps
// e.g. [1, '...', 5, 6, 7, '...', 50]
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

const SupportPage = () => {
  const { user, isAdmin } = useAuth();
  const [openFaq, setOpenFaq] = useState(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState(null);
  const [walletBalance, setWalletBalance] = useState('0.00');
  const [tickets, setTickets] = useState([]);
  const [myTickets, setMyTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ticketFilter, setTicketFilter] = useState('all');
  const [ticketPage, setTicketPage] = useState(1);
  const [myTicketFilter, setMyTicketFilter] = useState('all');
  const [myTicketPage, setMyTicketPage] = useState(1);
  const TICKETS_PER_PAGE = 5;

  useEffect(() => {
    if (!isAdmin) {
      api.get('/wallet').then(res => {
        const bal = res.data.data.wallet?.balance || res.data.data.balance || 0;
        setWalletBalance(parseFloat(bal).toFixed(2));
      }).catch(err => console.error(err));
      fetchMyTickets();
    } else {
      fetchTickets();
    }
  }, [isAdmin]);

  const fetchMyTickets = async () => {
    try {
      const res = await api.get('/support/my');
      setMyTickets(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch my tickets:', error);
    }
  };

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await api.get('/support');
      setTickets(res.data.data || []);
      // Mark all as seen — dot disappears from sidebar
      await api.put('/support/mark-seen');
    } catch (error) {
      setToast({ message: 'Failed to fetch tickets.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!subject || !message) {
      setToast({ message: 'Please fill out all fields.', type: 'error' });
      return;
    }

    try {
      await api.post('/support', { subject, message });
      setToast({ message: 'Message sent successfully! The admin will get back to you soon.', type: 'success' });
      setSubject('');
      setMessage('');
      fetchMyTickets();
    } catch (error) {
      setToast({ message: 'Failed to send message. Please try again later.', type: 'error' });
    }
  };

  const handleResolve = async (id) => {
    try {
      await api.put(`/support/${id}/resolve`);
      setToast({ message: 'Ticket marked as resolved.', type: 'success' });
      fetchTickets();
    } catch (error) {
      setToast({ message: 'Failed to resolve ticket.', type: 'error' });
    }
  };

  const handleWhatsApp = () => {
    setToast({ message: 'Redirecting to WhatsApp support...', type: 'success' });
    // In a real app, this would be: window.open('https://wa.me/1234567890', '_blank');
  };

  return (
    <div className="font-body bg-[#0F1729] text-[#F8FAFC] min-h-screen flex">
      <Sidebar />

      <main className="flex-1 min-h-screen relative md:ml-64 text-sm">
        {/* Top Navigation Bar */}
        <header className="flex justify-between items-center px-8 py-4 w-full sticky top-0 z-40 bg-[#0F1729]/80 backdrop-blur-md border-b border-white/10">
          <div className="flex flex-col gap-1">
            <h2 className="font-headline text-2xl font-bold text-white tracking-tight m-0 leading-none">How can we help you today?</h2>
            {/* <p className="text-slate-400 text-sm m-0 mt-1 leading-none">Find answers to common questions or reach out to administration.</p> */}
          </div>
          <div className="flex items-center gap-6">
            {!isAdmin && (
              <Link to="/wallet" className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 cursor-pointer rounded-full border border-white/10 transition-colors" style={{ textDecoration: 'none' }}>
                <span className="material-symbols-outlined text-[#00D4AA] text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>account_balance_wallet</span>
                <span className="text-xs font-semibold text-white">₹{walletBalance}</span>
              </Link>
            )}
            <Link to="/profile" className="flex items-center gap-2 px-4 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 cursor-pointer rounded-full border border-white/10 transition-colors" style={{ textDecoration: 'none' }}>
              <span className="material-symbols-outlined text-sm text-slate-400">{isAdmin ? 'admin_panel_settings' : 'person'}</span>
              <span className="text-sm font-medium text-white">{user?.name}</span>
            </Link>
          </div>
        </header>

        {/* Content Canvas */}
        <div className="p-8 max-w-7xl mx-auto space-y-8">
          {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} duration={5000} />}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>

            {/* FAQ Section — full width for admin, half for student */}
            <section style={isAdmin ? { gridColumn: '1 / -1' } : {}}>
              <h2 className="section-heading" style={{ marginBottom: '24px' }}>Frequently Asked Questions</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {faqs.map((faq, index) => (
                  <div
                    key={index}
                    className="glass-card"
                    style={{
                      padding: '20px',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      border: openFaq === index ? '1px solid #6C63FF' : '1px solid rgba(255, 255, 255, 0.05)'
                    }}
                    onClick={() => toggleFaq(index)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: '600', color: openFaq === index ? '#6C63FF' : 'white', margin: 0 }}>
                        {faq.question}
                      </h3>
                      <span
                        className="material-symbols-outlined"
                        style={{
                          color: openFaq === index ? '#6C63FF' : '#8892B0',
                          transform: openFaq === index ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.3s ease'
                        }}
                      >
                        expand_more
                      </span>
                    </div>
                    {openFaq === index && (
                      <div style={{ marginTop: '16px', color: '#94A3B8', fontSize: '0.875rem', lineHeight: '1.6' }}>
                        {faq.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {isAdmin ? (
              <section style={{ gridColumn: '1 / -1' }}>
                {/* Heading + Filter Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                  <h2 className="section-heading" style={{ margin: 0 }}>Support Tickets</h2>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['all', 'open', 'resolved'].map(f => (
                      <button
                        key={f}
                        onClick={() => { setTicketFilter(f); setTicketPage(1); }}
                        style={{
                          padding: '6px 16px',
                          borderRadius: '9999px',
                          fontSize: '12px',
                          fontWeight: '600',
                          border: '1px solid',
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                          transition: 'all 0.2s',
                          borderColor: ticketFilter === f
                            ? (f === 'open' ? '#FFAB00' : f === 'resolved' ? '#00D4AA' : '#6C63FF')
                            : 'rgba(255,255,255,0.1)',
                          backgroundColor: ticketFilter === f
                            ? (f === 'open' ? 'rgba(255,171,0,0.15)' : f === 'resolved' ? 'rgba(0,212,170,0.15)' : 'rgba(108,99,255,0.15)')
                            : 'rgba(255,255,255,0.05)',
                          color: ticketFilter === f
                            ? (f === 'open' ? '#FFAB00' : f === 'resolved' ? '#00D4AA' : '#6C63FF')
                            : '#94A3B8',
                        }}
                      >
                        {f === 'all' ? 'All' : f === 'open' ? '🟡 Pending' : '🟢 Resolved'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="glass-card" style={{ borderRadius: '24px', backgroundColor: 'rgba(26, 37, 64, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                      <thead style={{ backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8' }}>
                        <tr>
                          <th style={{ padding: '16px 24px' }}>Student</th>
                          <th style={{ padding: '16px 24px' }}>Room</th>
                          <th style={{ padding: '16px 24px' }}>Subject & Message</th>
                          <th style={{ padding: '16px 24px' }}>Status</th>
                          <th style={{ padding: '16px 24px', textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const filtered = ticketFilter === 'all' ? tickets : tickets.filter(t => t.status === (ticketFilter === 'open' ? 'open' : 'resolved'));
                          const totalPages = Math.ceil(filtered.length / TICKETS_PER_PAGE);
                          const paginated = filtered.slice((ticketPage - 1) * TICKETS_PER_PAGE, ticketPage * TICKETS_PER_PAGE);

                          if (loading && tickets.length === 0) return (
                            <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>Loading tickets...</td></tr>
                          );
                          if (filtered.length === 0) return (
                            <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>No {ticketFilter !== 'all' ? ticketFilter : ''} tickets found</td></tr>
                          );
                          return (
                            <>
                              {paginated.map(ticket => (
                                <tr key={ticket.ticket_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                  <td style={{ padding: '16px 24px' }}>
                                    <span style={{ fontSize: '14px', fontWeight: '600', color: 'white', display: 'block' }}>{ticket.name}</span>
                                    <span style={{ fontSize: '10px', color: '#94A3B8' }}>{ticket.mobile}</span>
                                  </td>
                                  <td style={{ padding: '16px 24px', fontSize: '14px', color: 'white' }}>
                                    {ticket.room_no || <span style={{ color: '#64748B', fontSize: '12px' }}>No Room</span>}
                                  </td>
                                  <td style={{ padding: '16px 24px' }}>
                                    <span style={{ fontSize: '14px', fontWeight: '600', color: 'white', display: 'block' }}>{ticket.subject}</span>
                                    <span style={{ fontSize: '12px', color: '#CBD5E1', display: 'block', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ticket.message}</span>
                                    <span style={{ fontSize: '10px', color: '#94A3B8' }}>{new Date(ticket.created_at).toLocaleString()}</span>
                                  </td>
                                  <td style={{ padding: '16px 24px' }}>
                                    {ticket.status === 'open'
                                      ? <span style={{ padding: '4px 8px', borderRadius: '9999px', backgroundColor: 'rgba(255, 171, 0, 0.1)', color: '#FFAB00', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Pending</span>
                                      : <span style={{ padding: '4px 8px', borderRadius: '9999px', backgroundColor: 'rgba(0, 212, 170, 0.1)', color: '#00D4AA', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>Resolved</span>
                                    }
                                  </td>
                                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                    {ticket.status === 'open' ? (
                                      <button onClick={() => handleResolve(ticket.ticket_id)} style={{ padding: '6px 16px', backgroundColor: '#00D4AA', color: 'black', fontSize: '12px', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
                                        Resolve
                                      </button>
                                    ) : (
                                      <span style={{ fontSize: '12px', color: '#94A3B8' }}>Done</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                              {/* Pagination row */}
                              {totalPages > 1 && (
                                <tr>
                                  <td colSpan="5" style={{ padding: '16px 24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                                        Showing {(ticketPage - 1) * TICKETS_PER_PAGE + 1}–{Math.min(ticketPage * TICKETS_PER_PAGE, filtered.length)} of {filtered.length}
                                      </span>
                                      <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                          onClick={() => setTicketPage(p => Math.max(1, p - 1))}
                                          disabled={ticketPage === 1}
                                          style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)', color: ticketPage === 1 ? '#475569' : 'white', fontSize: '12px', cursor: ticketPage === 1 ? 'not-allowed' : 'pointer' }}
                                        >← Prev</button>
                                      {getPaginationRange(ticketPage, totalPages).map((p, i) =>
                                        p === '...'
                                          ? <span key={`ellipsis-${i}`} style={{ padding: '5px 4px', color: '#64748B', fontSize: '12px' }}>…</span>
                                          : <button key={p} onClick={() => setTicketPage(p)} style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid', fontSize: '12px', cursor: 'pointer', fontWeight: p === ticketPage ? 'bold' : 'normal', borderColor: p === ticketPage ? '#6C63FF' : 'rgba(255,255,255,0.1)', backgroundColor: p === ticketPage ? 'rgba(108,99,255,0.2)' : 'rgba(255,255,255,0.05)', color: p === ticketPage ? '#6C63FF' : 'white' }}>{p}</button>
                                      )}
                                        <button
                                          onClick={() => setTicketPage(p => Math.min(totalPages, p + 1))}
                                          disabled={ticketPage === totalPages}
                                          style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)', color: ticketPage === totalPages ? '#475569' : 'white', fontSize: '12px', cursor: ticketPage === totalPages ? 'not-allowed' : 'pointer' }}
                                        >Next →</button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            ) : (
              <section style={{ marginBottom: '15px' }}>
                <h2 className="section-heading" style={{ marginBottom: '24px' }}>Contact Admin</h2>
                <div className="glass-card" style={{ padding: '32px' }}>
                  <form onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', color: '#8892B0', marginBottom: '8px', fontWeight: '500' }}>
                        Subject
                      </label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="e.g. Issue with Wallet Recharge"
                        style={{
                          width: '100%', padding: '12px 16px', backgroundColor: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white',
                          fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#6C63FF'}
                        onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', color: '#8892B0', marginBottom: '8px', fontWeight: '500' }}>
                        Message
                      </label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Describe your issue in detail..."
                        rows={5}
                        style={{
                          width: '100%', padding: '12px 16px', backgroundColor: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white',
                          fontSize: '1rem', outline: 'none', resize: 'vertical', transition: 'border-color 0.2s'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#6C63FF'}
                        onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
                      <button
                        type="submit"
                        className="btn-primary"
                        style={{
                          width: '100%', padding: '14px', borderRadius: '8px', fontSize: '1rem',
                          fontWeight: '600', border: 'none', cursor: 'pointer',
                          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
                        }}
                      >
                        <span className="material-symbols-outlined">send</span>
                        Send Message
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }} />
                        <span style={{ color: '#8892B0', fontSize: '0.875rem' }}>OR</span>
                        <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }} />
                      </div>

                      <button
                        type="button"
                        onClick={handleWhatsApp}
                        style={{
                          width: '100%', padding: '14px', borderRadius: '8px', fontSize: '1rem',
                          fontWeight: '600', border: '1px solid #00D4AA', backgroundColor: 'rgba(0, 212, 170, 0.1)',
                          color: '#00D4AA', cursor: 'pointer', transition: 'all 0.2s',
                          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
                        }}
                        onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(0, 212, 170, 0.2)'}
                        onMouseOut={(e) => e.target.style.backgroundColor = 'rgba(0, 212, 170, 0.1)'}
                      >
                        <span className="material-symbols-outlined">chat</span>
                        WhatsApp Support
                      </button>
                    </div>

                  </form>
                </div>
              </section>
            )}

          </div>

          {/* Student: My Ticket History */}
          {!isAdmin && (
            <section style={{ marginTop: '8px' }}>
              {/* Heading + Filter Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <h2 className="section-heading" style={{ margin: 0 }}>My Submitted Tickets</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['all', 'open', 'resolved'].map(f => (
                    <button
                      key={f}
                      onClick={() => { setMyTicketFilter(f); setMyTicketPage(1); }}
                      style={{
                        padding: '6px 16px',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontWeight: '600',
                        border: '1px solid',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        borderColor: myTicketFilter === f
                          ? (f === 'open' ? '#FFAB00' : f === 'resolved' ? '#00D4AA' : '#6C63FF')
                          : 'rgba(255,255,255,0.1)',
                        backgroundColor: myTicketFilter === f
                          ? (f === 'open' ? 'rgba(255,171,0,0.15)' : f === 'resolved' ? 'rgba(0,212,170,0.15)' : 'rgba(108,99,255,0.15)')
                          : 'rgba(255,255,255,0.05)',
                        color: myTicketFilter === f
                          ? (f === 'open' ? '#FFAB00' : f === 'resolved' ? '#00D4AA' : '#6C63FF')
                          : '#94A3B8',
                      }}
                    >
                      {f === 'all' ? 'All' : f === 'open' ? '🟡 Pending' : '🟢 Resolved'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="glass-card" style={{ borderRadius: '24px', backgroundColor: 'rgba(26, 37, 64, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: 'rgba(255,255,255,0.05)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94A3B8' }}>
                      <tr>
                        <th style={{ padding: '16px 24px' }}>Subject</th>
                        <th style={{ padding: '16px 24px' }}>Message</th>
                        <th style={{ padding: '16px 24px' }}>Date</th>
                        <th style={{ padding: '16px 24px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const filtered = myTicketFilter === 'all' ? myTickets : myTickets.filter(t => t.status === (myTicketFilter === 'open' ? 'open' : 'resolved'));
                        const totalPages = Math.ceil(filtered.length / TICKETS_PER_PAGE);
                        const paginated = filtered.slice((myTicketPage - 1) * TICKETS_PER_PAGE, myTicketPage * TICKETS_PER_PAGE);

                        if (filtered.length === 0) return (
                          <tr><td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
                            {myTickets.length === 0 ? "You haven't submitted any tickets yet." : `No ${myTicketFilter} tickets found.`}
                          </td></tr>
                        );
                        return (
                          <>
                            {paginated.map(ticket => (
                              <tr key={ticket.ticket_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: '600', color: 'white' }}>
                                  {ticket.subject}
                                </td>
                                <td style={{ padding: '16px 24px', fontSize: '13px', color: '#CBD5E1', maxWidth: '350px' }}>
                                  <span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {ticket.message}
                                  </span>
                                </td>
                                <td style={{ padding: '16px 24px', fontSize: '12px', color: '#94A3B8', whiteSpace: 'nowrap' }}>
                                  {new Date(ticket.created_at).toLocaleString()}
                                </td>
                                <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                                  {ticket.status === 'open'
                                    ? <span style={{ padding: '5px 12px', borderRadius: '9999px', backgroundColor: 'rgba(255, 171, 0, 0.1)', color: '#FFAB00', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Pending</span>
                                    : <span style={{ padding: '5px 12px', borderRadius: '9999px', backgroundColor: 'rgba(0, 212, 170, 0.1)', color: '#00D4AA', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>Resolved</span>
                                  }
                                </td>
                              </tr>
                            ))}
                            {totalPages > 1 && (
                              <tr>
                                <td colSpan="4" style={{ padding: '16px 24px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                                      Showing {(myTicketPage - 1) * TICKETS_PER_PAGE + 1}–{Math.min(myTicketPage * TICKETS_PER_PAGE, filtered.length)} of {filtered.length}
                                    </span>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                      <button
                                        onClick={() => setMyTicketPage(p => Math.max(1, p - 1))}
                                        disabled={myTicketPage === 1}
                                        style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)', color: myTicketPage === 1 ? '#475569' : 'white', fontSize: '12px', cursor: myTicketPage === 1 ? 'not-allowed' : 'pointer' }}
                                      >← Prev</button>
                                      {getPaginationRange(myTicketPage, totalPages).map((p, i) =>
                                        p === '...'
                                          ? <span key={`ellipsis-${i}`} style={{ padding: '5px 4px', color: '#64748B', fontSize: '12px' }}>…</span>
                                          : <button key={p} onClick={() => setMyTicketPage(p)} style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid', fontSize: '12px', cursor: 'pointer', fontWeight: p === myTicketPage ? 'bold' : 'normal', borderColor: p === myTicketPage ? '#6C63FF' : 'rgba(255,255,255,0.1)', backgroundColor: p === myTicketPage ? 'rgba(108,99,255,0.2)' : 'rgba(255,255,255,0.05)', color: p === myTicketPage ? '#6C63FF' : 'white' }}>{p}</button>
                                      )}
                                      <button
                                        onClick={() => setMyTicketPage(p => Math.min(totalPages, p + 1))}
                                        disabled={myTicketPage === totalPages}
                                        style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)', color: myTicketPage === totalPages ? '#475569' : 'white', fontSize: '12px', cursor: myTicketPage === totalPages ? 'not-allowed' : 'pointer' }}
                                      >Next →</button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default SupportPage;
