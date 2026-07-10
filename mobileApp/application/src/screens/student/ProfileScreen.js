// =============================================================================
// src/screens/student/ProfileScreen.js
// Profile Screen — Mobile version
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useBLE } from '../../context/BLEContext';
import api from '../../api/axios';
import { colors } from '../../theme/colors';

const ProfileScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const { forceDisconnectAll } = useBLE();

  const [roomInfo, setRoomInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const roomRes = await api.get('/rooms/my').catch(() => ({ data: { data: null } }));
      setRoomInfo(roomRes.data?.data?.room || roomRes.data?.data || null);
    } catch (err) {
      console.error('Profile fetch error:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => {
        try { await forceDisconnectAll(); } catch (e) { console.log('BLE disconnect failed', e); }
        logout();
      }},
    ]);
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';

  const menuItems = [
    { icon: '🚪', label: 'My Room', sub: roomInfo ? `Room ${roomInfo.room_no}` : 'Not assigned', onPress: () => navigation.navigate('MyRoom') },
    { icon: '🔒', label: 'Change Password', sub: 'Update your password', onPress: () => navigation.navigate('ChangePassword') },
    { icon: '🔔', label: 'Notifications', sub: 'Manage alerts', onPress: () => { } },
  ];

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.purple} /></View>;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purple} />}
      >
        {/* ── Avatar & Name ── */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.role}>{user?.email}</Text>
        </View>

        {/* ── Menu ── */}
        <View style={styles.menuCard}>
          {menuItems.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.menuItem, i < menuItems.length - 1 && styles.menuDivider]}
              onPress={item.onPress}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuSub}>{item.sub}</Text>
              </View>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Logout ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>FairAC Mobile v1.0.0</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  scroll: { padding: 24, paddingTop: 56, paddingBottom: 32 },
  profileHeader: { alignItems: 'center', marginBottom: 28 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.purple, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  name: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  role: { color: colors.textSecondary, fontSize: 14, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: colors.backgroundCard, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, alignItems: 'center' },
  statValue: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  statLabel: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  menuCard: { backgroundColor: colors.backgroundCard, borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: 20 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14 },
  menuDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  menuIcon: { fontSize: 20, width: 28 },
  menuLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: '500' },
  menuSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  menuArrow: { color: colors.textMuted, fontSize: 20, fontWeight: '300' },
  logoutBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 50, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', marginBottom: 24 },
  logoutText: { color: colors.error, fontSize: 16, fontWeight: '600' },
  version: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});

export default ProfileScreen;
