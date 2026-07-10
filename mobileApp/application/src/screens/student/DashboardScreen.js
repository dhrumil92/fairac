// =============================================================================
// src/screens/student/DashboardScreen.js
// Dashboard Home Screen — Mobile version
// Logic copied from web DashboardPage.jsx, UI rebuilt for React Native
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { colors } from '../../theme/colors';

const DashboardScreen = ({ navigation }) => {
  const { user, fetchMe } = useAuth();

  const [activeSession, setActiveSession] = useState(null);
  const [acStatus, setAcStatus] = useState(null);
  const [roomInfo, setRoomInfo] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const firstName = user?.name?.split(' ')[0] || 'Student';

  const [walletBalance, setWalletBalance] = useState(0);

  // ─── Copied from web DashboardPage.jsx fetchDashboardData ─────────────────
  const fetchDashboardData = useCallback(async () => {
    try {
      const [sessionRes, roomRes, walletRes] = await Promise.all([
        api.get('/sessions/active').catch(() => ({ data: { data: null } })),
        api.get('/rooms/my').catch(() => ({ data: { data: null } })),
        api.get('/wallet').catch(() => ({ data: { data: null } })),
      ]);

      setActiveSession(sessionRes.data?.data?.session || sessionRes.data?.data || null);

      const roomData = roomRes.data?.data?.room || roomRes.data?.data;
      setRoomInfo(roomData || null);

      if (walletRes.data?.data) {
        const wData = walletRes.data.data.wallet || walletRes.data.data;
        setWalletBalance(wData.balance || 0);
      }

      if (roomData?.hardware_id) {
        const statusRes = await api.get(`/sessions/ac-status/${roomData.r_id}`).catch(() => null);
        setAcStatus(statusRes?.data?.data || null);
      }

      // Fetch recent sessions
      const histRes = await api.get('/sessions/my?limit=3').catch(() => null);
      setRecentSessions(histRes?.data?.data?.sessions || histRes?.data?.data || []);

    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000); // 10s polling
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const isAcOnline = acStatus?.is_online === true;

  const getHour = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    return 'Evening';
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.purple} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purple} />}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good {getHour()},</Text>
            <Text style={styles.name}>{firstName}! 👋</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{firstName[0]}</Text>
          </View>
        </View>

        {/* ── Wallet Balance Card ── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>₹ {parseFloat(walletBalance || 0).toFixed(2)}</Text>
          <TouchableOpacity
            style={styles.topUpBtn}
            onPress={() => navigation.navigate('Wallet')}
          >
            <Text style={styles.topUpText}>+ Top Up</Text>
          </TouchableOpacity>
        </View>

        {/* ── AC Status Card ── */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardTitle}>AC Status</Text>
            <View style={[styles.badge, isAcOnline ? styles.badgeOnline : styles.badgeOffline]}>
              <Text style={styles.badgeText}>{isAcOnline ? '● Online' : '● Offline'}</Text>
            </View>
          </View>
          {activeSession ? (
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => navigation.navigate('Session')}
            >
              <Text style={styles.btnPrimaryText}>⚡ View Active Session</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btnPrimary, !isAcOnline && styles.btnDisabled]}
              disabled={!isAcOnline}
              onPress={() => navigation.navigate('Session')}
            >
              <Text style={styles.btnPrimaryText}>Start New Session</Text>
            </TouchableOpacity>
          )}
          {!isAcOnline && (
            <Text style={styles.offlineNote}>AC is offline. Start session is disabled.</Text>
          )}
        </View>

        {/* ── Room Info Card ── */}
        {roomInfo ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>My Room</Text>
            <Text style={styles.roomNumber}>Room {roomInfo.room_no}</Text>
            <Text style={styles.roomHostel}>{roomInfo.hostel_name}</Text>
          </View>
        ) : (
          <TouchableOpacity style={[styles.card, styles.cardDashed]} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.cardLabel}>🏠 No Room Assigned</Text>
            <Text style={styles.textMuted}>Tap Profile to join a room</Text>
          </TouchableOpacity>
        )}

        {/* ── Recent Sessions ── */}
        {recentSessions.length > 0 && (
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Recent Sessions</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Session')}>
                <Text style={{ color: colors.purple, fontSize: 13, fontWeight: '600' }}>See all history ↗</Text>
              </TouchableOpacity>
            </View>
            {recentSessions.map((s, i) => {
              const h = Math.floor((s.duration_minutes || 0) / 60);
              const m = Math.round((s.duration_minutes || 0) % 60);
              const durationStr = s.duration_minutes ? `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m` : '—';
              const cost = parseFloat(s.my_cost_display || s.my_cost || 0).toFixed(2);

              return (
                <View key={s.session_id || i} style={styles.sessionItem}>
                  <View style={styles.sessionIcon}>
                    <Text style={{ fontSize: 16 }}>⚡</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sessionDate}>
                      #{s.session_id} • {new Date(s.start_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Text>
                    <Text style={styles.sessionMeta}>
                      {durationStr}
                    </Text>
                  </View>
                  <Text style={styles.sessionCost}>₹ {cost}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  scroll: { padding: 24, paddingTop: 56, paddingBottom: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { color: colors.textSecondary, fontSize: 14 },
  name: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.purple, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  card: { backgroundColor: colors.backgroundCard, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 20, marginBottom: 16 },
  cardDashed: { borderStyle: 'dashed', alignItems: 'center', paddingVertical: 24 },
  cardLabel: { color: colors.textSecondary, fontSize: 13, marginBottom: 4 },
  cardTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  balanceAmount: { color: colors.textPrimary, fontSize: 36, fontWeight: '700', marginBottom: 16, letterSpacing: -1 },
  topUpBtn: { backgroundColor: colors.purple, borderRadius: 50, paddingVertical: 10, paddingHorizontal: 20, alignSelf: 'flex-start' },
  topUpText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  badge: { borderRadius: 50, paddingVertical: 4, paddingHorizontal: 12 },
  badgeOnline: { backgroundColor: 'rgba(34, 197, 94, 0.15)' },
  badgeOffline: { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
  badgeText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  btnPrimary: { backgroundColor: colors.purple, borderRadius: 50, padding: 14, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.4 },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  offlineNote: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 8 },
  roomNumber: { color: colors.textPrimary, fontSize: 24, fontWeight: '700', marginTop: 4 },
  roomHostel: { color: colors.textSecondary, fontSize: 14, marginTop: 2 },
  section: { marginTop: 8 },
  sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 12 },
  sessionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  sessionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(168, 85, 247, 0.15)', justifyContent: 'center', alignItems: 'center' },
  sessionDate: { color: colors.textPrimary, fontSize: 14, fontWeight: '500' },
  sessionMeta: { color: colors.textSecondary, fontSize: 12 },
  sessionCost: { color: colors.teal, fontSize: 15, fontWeight: '700' },
  textMuted: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
});

export default DashboardScreen;
