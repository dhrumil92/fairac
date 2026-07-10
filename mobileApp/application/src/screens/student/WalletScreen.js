// =============================================================================
// src/screens/student/WalletScreen.js
// Wallet Screen — Mobile version
// Logic copied from web WalletPage.jsx, UI rebuilt for React Native
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  StatusBar, ActivityIndicator, Alert, TextInput, Modal, RefreshControl, Platform
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { colors } from '../../theme/colors';
import { Feather, Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

const WalletScreen = () => {
  const { fetchMe } = useAuth();

  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [walletStats, setWalletStats] = useState({ totalRecharged: 0, monthlySpent: 0 });

  // Filters
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleDateTextChange = (text) => {
    if (filterDate.endsWith('-') && text.length === filterDate.length - 1) {
      text = text.slice(0, -1);
    }
    let cleaned = text.replace(/[^0-9]/g, '');
    let formatted = '';
    if (cleaned.length > 0) {
      if (parseInt(cleaned[0], 10) > 3) cleaned = '0' + cleaned;
    }
    if (cleaned.length >= 2) {
      let dayStr = cleaned.slice(0, 2);
      if (parseInt(dayStr, 10) > 31) dayStr = '31';
      if (dayStr === '00') dayStr = '01';
      formatted += dayStr + (cleaned.length > 2 ? '-' : '');
    } else {
      formatted += cleaned;
      setFilterDate(formatted);
      return;
    }
    if (cleaned.length > 2) {
      if (parseInt(cleaned[2], 10) > 1) {
        cleaned = cleaned.slice(0, 2) + '0' + cleaned.slice(2);
      }
    }
    if (cleaned.length >= 4) {
      let monthStr = cleaned.slice(2, 4);
      if (parseInt(monthStr, 10) > 12) monthStr = '12';
      if (monthStr === '00') monthStr = '01';
      formatted += monthStr + (cleaned.length > 4 ? '-' : '');
    } else {
      formatted += cleaned.slice(2);
      setFilterDate(formatted);
      return;
    }
    if (cleaned.length > 4) {
      formatted += cleaned.slice(4, 8);
    }
    setFilterDate(formatted);
  };

  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchWalletData = useCallback(async (pageNum = 1, fType = filterType, fDate = filterDate) => {
    if (pageNum > 1) setLoadingMore(true);
    try {
      // Only fetch balance on first page load/refresh
      if (pageNum === 1) {
        const walletRes = await api.get('/wallet').catch(() => null);
        if (walletRes?.data?.data) {
          const wData = walletRes.data.data.wallet || walletRes.data.data;
          setWalletBalance(wData.balance || 0);
        }

        const sessRes = await api.get('/sessions/my?limit=100').catch(() => null);
        const txRes = await api.get('/wallet/transactions?limit=100').catch(() => null);

        let mSpent = 0;
        let tRecharged = 0;

        if (sessRes?.data?.data?.sessions) {
          const sessions = sessRes.data.data.sessions;
          const now = new Date();
          const monthly = sessions.filter(s => {
            const d = new Date(s.start_time);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          });
          mSpent = monthly.reduce((sum, s) => sum + parseFloat(s.my_cost_display || s.my_cost || 0), 0);
        }

        if (txRes?.data?.data?.transactions) {
          const txs = txRes.data.data.transactions;
          tRecharged = txs.filter(t => t.type !== 'consumption').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
        }

        setWalletStats({
          totalRecharged: tRecharged,
          monthlySpent: mSpent
        });
      }

      let url = `/wallet/transactions?limit=10&page=${pageNum}`;
      if (fType && fType !== 'all') url += `&type=${fType}`;
      if (fDate) {
        const parts = fDate.split('-');
        if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
          url += `&date=${parts[2]}-${parts[1]}-${parts[0]}`;
        } else {
          url += `&date=${fDate}`;
        }
      }

      const res = await api.get(url);
      const fetchedTxns = res.data?.data?.transactions || [];

      setHasMore(fetchedTxns.length >= 10);

      if (pageNum === 1) {
        setTransactions(fetchedTxns);
      } else {
        setTransactions(prev => [...prev, ...fetchedTxns]);
      }
      setPage(pageNum);
    } catch (err) {
      console.error('Wallet fetch error:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchWalletData(1);
  }, [fetchWalletData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchWalletData(1, filterType, filterDate);
    fetchMe();
  };

  const loadMore = () => {
    if (hasMore && !loadingMore && !isLoading && !refreshing) {
      fetchWalletData(page + 1, filterType, filterDate);
    }
  };

  const handleTopUp = async () => {
    const amount = parseFloat(topUpAmount);
    if (!amount || amount < 50) {
      Alert.alert('Invalid Amount', 'Minimum top-up amount is ₹50.');
      return;
    }
    setTopUpLoading(true);
    try {
      await api.post('/wallet/topup', { amount });
      await fetchMe();
      await fetchWalletData(1);
      setShowTopUp(false);
      setTopUpAmount('');
      Alert.alert('Success! 🎉', `₹${amount.toFixed(2)} added to your wallet.`);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Top-up failed.');
    } finally {
      setTopUpLoading(false);
    }
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.purple} /></View>;
  }

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.pageTitle}>My Wallet</Text>

      {/* ── Balance Hero Card ── */}
      <View style={styles.heroCard}>
        <View style={{ marginBottom: 24 }}>
          <Text style={styles.heroLabel}>Available Balance</Text>
          <Text style={[styles.heroAmount, { marginBottom: 4 }]} adjustsFontSizeToFit numberOfLines={1}>
            ₹ {parseFloat(walletBalance).toFixed(2)}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '500' }}>
            Total Recharged: ₹ {walletStats.totalRecharged.toFixed(0)}
          </Text>
        </View>
        <View style={styles.heroActions}>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => setShowTopUp(true)}>
            <Text style={styles.btnPrimaryText}>+ Add Money</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4 }}>
        <View>
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Transaction History</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: -4 }}>
            This Month Spent: ₹{walletStats.monthlySpent.toFixed(0)}
          </Text>
        </View>
        <TouchableOpacity style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8 }} onPress={() => setShowFilterModal(true)}>
          <Ionicons name="options-outline" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderItem = ({ item }) => {
    const t = item;
    const isCredit = t.type !== 'consumption';

    let displayDesc = t.description || '';
    if (!isCredit && displayDesc.toLowerCase().includes('ac session')) {
      const match = displayDesc.match(/(#\d+)/);
      if (match) displayDesc = match[1];
    } else if (!displayDesc) {
      displayDesc = isCredit ? 'Wallet Top-Up' : 'AC Session';
    }

    return (
      <View style={styles.txItem}>
        <View style={[styles.txIcon, isCredit ? styles.txIconGreen : styles.txIconRed]}>
          <Feather name={isCredit ? 'download' : 'upload'} size={18} color={isCredit ? colors.success : colors.error} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.txDesc}>
            {displayDesc} • {new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
          {!isCredit && t.booking_type && (
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2, fontWeight: '600' }}>
              Booking Type: <Text style={{ color: colors.purple }}>{t.booking_type.toUpperCase()}</Text>
            </Text>
          )}
        </View>
        <Text style={[styles.txAmount, isCredit ? styles.txAmountGreen : styles.txAmountRed]}>
          {isCredit ? '+' : '-'}₹{Math.abs(parseFloat(t.amount)).toFixed(2)}
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return <View style={{ height: 24 }} />;
    return (
      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
        <ActivityIndicator color={colors.purple} />
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>💳</Text>
      <Text style={styles.emptyText}>No transactions yet</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <FlatList
        data={transactions}
        keyExtractor={(t, i) => t.t_id?.toString() || i.toString()}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purple} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
      />

      {/* ── Filter Modal ── */}
      <Modal visible={showFilterModal} transparent animationType="fade" onRequestClose={() => setShowFilterModal(false)}>
        <View style={styles.centeredModalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowFilterModal(false)} />
          <View style={{ backgroundColor: 'rgba(26, 37, 64, 0.96)', borderRadius: 24, padding: 28, width: '100%', borderWidth: 1, borderColor: colors.border }}>
            <Text style={styles.modalTitle}>Filters</Text>
            
            <Text style={{ color: colors.textSecondary, marginTop: 16, marginBottom: 8, fontSize: 13, fontWeight: '600' }}>Transaction Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {['all', 'consumption', 'recharge'].map(t => (
                <TouchableOpacity 
                  key={t}
                  style={[styles.badge, filterType === t ? { backgroundColor: colors.purple } : { backgroundColor: 'rgba(255,255,255,0.05)' }]}
                  onPress={() => setFilterType(t)}
                >
                  <Text style={[styles.badgeText, filterType === t && { color: '#fff' }]}>
                    {t === 'recharge' ? 'Top-up' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ color: colors.textSecondary, marginTop: 24, marginBottom: 8, fontSize: 13, fontWeight: '600' }}>DATE</Text>
            <View style={[{ backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }]}>
              <TextInput
                style={{ color: colors.textPrimary, fontSize: 15, flex: 1, padding: 0 }}
                placeholder="dd-mm-yyyy"
                placeholderTextColor={colors.textMuted}
                value={filterDate}
                onChangeText={handleDateTextChange}
                keyboardType="numeric"
                maxLength={10}
              />
              <TouchableOpacity 
                onPress={() => {
                  let pickerDate = new Date();
                  if (filterDate) {
                    const parts = filterDate.split('-');
                    if (parts.length === 3) {
                      pickerDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    }
                  }
                  if (Platform.OS === 'android') {
                    DateTimePickerAndroid.open({
                      value: isNaN(pickerDate.getTime()) ? new Date() : pickerDate,
                      onChange: (event, selectedDate) => {
                        if (event.type === 'set' && selectedDate) {
                          const dd = String(selectedDate.getDate()).padStart(2, '0');
                          const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                          const yyyy = selectedDate.getFullYear();
                          setFilterDate(`${dd}-${mm}-${yyyy}`);
                        }
                      },
                      mode: 'date',
                    });
                  } else {
                    setShowDatePicker(true);
                  }
                }}
              >
                <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity 
              style={[styles.btnPrimary, { marginTop: 24 }]} 
              onPress={() => {
                setShowFilterModal(false);
                fetchWalletData(1, filterType, filterDate);
              }}
            >
              <Text style={styles.btnPrimaryText}>Apply Filters</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ marginTop: 12, padding: 14, borderRadius: 50, borderWidth: 1, borderColor: colors.error, backgroundColor: 'rgba(239, 68, 68, 0.1)', alignItems: 'center' }} 
              onPress={() => {
                setFilterType('all');
                setFilterDate('');
                setShowFilterModal(false);
                fetchWalletData(1, 'all', '');
              }}
            >
              <Text style={{ color: colors.error, fontSize: 15, fontWeight: '700' }}>Clear All Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Native Date Picker for iOS ── */}
      {Platform.OS === 'ios' && showDatePicker && (
        <DateTimePicker
          value={(() => {
            if (!filterDate) return new Date();
            const parts = filterDate.split('-');
            if (parts.length === 3) {
              const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
              return isNaN(d.getTime()) ? new Date() : d;
            }
            return new Date();
          })()}
          mode="date"
          display="inline"
          themeVariant="dark"
          onChange={(event, selectedDate) => {
            if (event.type === 'set' && selectedDate) {
              const dd = String(selectedDate.getDate()).padStart(2, '0');
              const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
              const yyyy = selectedDate.getFullYear();
              setFilterDate(`${dd}-${mm}-${yyyy}`);
            }
            setShowDatePicker(false);
          }}
        />
      )}

      {/* ── Top Up Modal ── */}
      <Modal visible={showTopUp} transparent animationType="slide" onRequestClose={() => setShowTopUp(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Money</Text>
            <Text style={styles.modalSub}>Minimum ₹50 • Maximum ₹5,000</Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter amount"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={topUpAmount}
                onChangeText={setTopUpAmount}
                autoFocus
                textAlign="center"
              />
            </View>

            <View style={styles.quickAmounts}>
              {['50', '100', '200', '500'].map(amt => (
                <TouchableOpacity key={amt} style={styles.quickBtn} onPress={() => setTopUpAmount(amt)}>
                  <Text style={styles.quickBtnText}>₹{amt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.btnPrimary, topUpLoading && { opacity: 0.7 }, { width: '100%' }]}
              onPress={handleTopUp}
              disabled={topUpLoading}
            >
              {topUpLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Add Money</Text>}
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.cancelBtn} 
              onPress={() => {
                setShowTopUp(false);
                setTopUpAmount('');
              }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  scroll: { padding: 24, paddingTop: 56, paddingBottom: 32 },
  headerContainer: { paddingBottom: 16 },
  pageTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 20 },
  heroCard: { backgroundColor: colors.backgroundCard, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 24, marginBottom: 24 },
  heroLabel: { color: colors.textSecondary, fontSize: 14, marginBottom: 4 },
  heroAmount: { color: colors.textPrimary, fontSize: 44, fontWeight: '700', letterSpacing: -1, marginBottom: 20 },
  heroActions: { flexDirection: 'row', gap: 12 },
  btnPrimary: { backgroundColor: colors.success, borderRadius: 50, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 12 },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: colors.textSecondary, fontSize: 15 },
  txItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  txIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  txIconGreen: { backgroundColor: 'rgba(34, 197, 94, 0.15)' },
  txIconRed: { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
  txDesc: { color: colors.textPrimary, fontSize: 14, fontWeight: '500' },
  txDate: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '700' },
  txAmountGreen: { color: colors.success },
  txAmountRed: { color: colors.error },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  centeredModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#1a2540', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28 },
  modalTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 4 },
  modalSub: { color: colors.textSecondary, fontSize: 14, marginBottom: 24 },
  inputContainer: { backgroundColor: colors.backgroundInput, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16, alignItems: 'center' },
  modalInput: { color: colors.textPrimary, fontSize: 20, fontWeight: '600', minWidth: 200 },
  quickAmounts: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  quickBtn: { flex: 1, borderRadius: 50, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.purple },
  quickBtnText: { color: colors.purple, fontSize: 14, fontWeight: '600' },
  cancelBtn: { marginTop: 12, padding: 12, alignItems: 'center' },
  cancelText: { color: colors.textSecondary, fontSize: 15 },
  badge: { borderRadius: 50, paddingVertical: 6, paddingHorizontal: 12 },
  badgeText: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
});

export default WalletScreen;
