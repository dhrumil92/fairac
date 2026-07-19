// =============================================================================
// src/screens/student/SessionScreen.js
// Session Screen — Mobile version (Idle + Active states)
// Logic copied from web SessionPage.jsx, UI rebuilt for React Native
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  StatusBar, ActivityIndicator, RefreshControl, Alert, Modal,
  LayoutAnimation, Platform, UIManager, TextInput
} from 'react-native';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { colors } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import { useBLE } from '../../context/BLEContext';

const SessionScreen = () => {
  const { user, fetchMe } = useAuth();
  const firstName = user?.name?.split(' ')[0] || 'Student';

  const [activeSession, setActiveSession] = useState(null);
  const [acStatus, setAcStatus] = useState(null);
  const [roomInfo, setRoomInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [scope, setScope] = useState('me');

  // Filter state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Booking Modal State
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingType, setBookingType] = useState('duration'); // duration, amount, units
  const [bookingValue, setBookingValue] = useState('');

  // BLE Logic
  const { requestPermissions, connectToDevice, disconnectFromDevice, sendCommand, connectedDevice, telemetryData, stopScanning, checkBluetoothState, scanForSpecificPeripheral } = useBLE();
  const [bleStatusText, setBleStatusText] = useState('');
  const [bleConnecting, setBleConnecting] = useState(false);

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (event.type === 'set' && selectedDate) {
      const yyyy = selectedDate.getFullYear();
      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(selectedDate.getDate()).padStart(2, '0');
      setFilterDate(`${dd}-${mm}-${yyyy}`);
      if (Platform.OS === 'android') {
        setShowDatePicker(false);
      }
    } else if (event.type === 'dismissed') {
      setShowDatePicker(false);
    }
  };

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

  // Pagination state for history
  const [sessionHistory, setSessionHistory] = useState([]);
  const [sessionStats, setSessionStats] = useState({ total: 0, monthly: 0 });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');

  // ─── Elapsed Timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    let interval;
    if (activeSession?.start_time) {
      interval = setInterval(() => {
        const start = new Date(activeSession.start_time).getTime();
        const now = new Date().getTime();
        const diff = Math.max(0, now - start);
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        setElapsedTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      }, 1000);
    } else {
      setElapsedTime('00:00:00');
    }
    return () => clearInterval(interval);
  }, [activeSession?.start_time]);

  // ─── Copied from web SessionPage.jsx fetchStatus ───────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const [sessionRes, statusRes, roomRes] = await Promise.all([
        api.get('/sessions/active').catch(() => ({ data: { data: null } })),
        api.get('/rooms/my').then(r => {
          const rId = r.data?.data?.room?.r_id || r.data?.data?.r_id;
          return rId ? api.get(`/sessions/ac-status/${rId}`) : { data: { data: null } };
        }).catch(() => ({ data: { data: null } })),
        api.get('/rooms/my').catch(() => ({ data: { data: null } }))
      ]);

      const fetchedSession = sessionRes.data?.data?.session || sessionRes.data?.data;
      if (fetchedSession?.status === 'active' || fetchedSession?.status === 'booked') {
        setActiveSession(fetchedSession);
        // Only set acStatus from backend if BLE is not providing it
        if (!telemetryData && statusRes.data?.data) {
          setAcStatus(statusRes.data.data);
        }
      } else {
        setActiveSession(null);
        setAcStatus(statusRes.data?.data || null);
      }
      setRoomInfo(roomRes.data?.data?.room || roomRes.data?.data || null);
    } catch (err) {
      console.error('Session fetch error:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchHistory = useCallback(async (pageNum = 1, activeScope = scope, fType = filterType, fDate = filterDate) => {
    if (pageNum > 1) setLoadingMore(true);
    try {
      let url = `/sessions/my?limit=7&page=${pageNum}&scope=${activeScope}`;
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
      const sessions = res.data?.data?.sessions || res.data?.data || [];

      setHasMore(sessions.length >= 7);

      if (pageNum === 1) {
        setSessionHistory(sessions);
        if (res.data?.data) {
          setSessionStats({
            total: res.data.data.pagination?.total || sessions.length || 0,
            monthly: res.data.data.this_month_count || 0
          });
        }
      } else {
        setSessionHistory(prev => [...prev, ...sessions]);
      }
      setPage(pageNum);
    } catch (err) {
      console.error('History fetch error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchHistory(1, scope, filterType, filterDate);
    const pollingInterval = setInterval(fetchStatus, 10000);

    // Listen for push notifications to instantly refresh session state
    const pushSubscription = Notifications.addNotificationReceivedListener(notif => {
      const type = notif.request.content.data?.type;
      if (['SESSION_INVITE', 'LEAVE_REQUEST', 'LEAVE_APPROVED', 'LEAVE_REJECTED'].includes(type)) {
        fetchStatus(); // Silently refresh session state
      }
    });

    return () => {
      clearInterval(pollingInterval);
      pushSubscription.remove();
    };
  }, []); // Run on mount only

  const onRefresh = () => {
    setRefreshing(true);
    fetchStatus();
    fetchHistory(1, scope, filterType, filterDate);
  };

  const loadMore = () => {
    if (hasMore && !loadingMore && !isLoading && !refreshing) {
      fetchHistory(page + 1, scope, filterType, filterDate);
    }
  };

  // ─── Start Session (Opens Booking Modal) ──────────────────────────────────
  const handleStart = () => {
    setBookingType('duration');
    setBookingValue('1.5');
    setShowBookingModal(true);
  };

  const confirmStart = async () => {
    const val = parseFloat(bookingValue);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid number.');
      return;
    }
    if (bookingType === 'amount') {
      if (val < 20) { Alert.alert('Invalid Input', 'Minimum booking amount is ₹20.'); return; }
      if (val > 100) { Alert.alert('Invalid Input', 'Maximum booking amount is ₹100.'); return; }
    } else if (bookingType === 'units') {
      if (val < 1.5) { Alert.alert('Invalid Input', 'Minimum booking is 1.5 kWh.'); return; }
      if (val > 10) { Alert.alert('Invalid Input', 'Maximum booking is 10 kWh.'); return; }
    } else if (bookingType === 'duration') {
      if (val < 1.5) { Alert.alert('Invalid Input', 'Minimum booking duration is 1.5 hours.'); return; }
      if (val > 12) { Alert.alert('Invalid Input', 'Maximum booking duration is 12 hours.'); return; }
    }

    setActionLoading(true);
    try {
      if (!connectedDevice) {
        Alert.alert('Not Connected', 'Please connect to the AC Bluetooth first.');
        setActionLoading(false);
        return;
      }

      // 1. Call Backend to pre-authorize and calculate max_kwh
      const response = await api.post('/sessions/book', {
        r_id: roomInfo.r_id,
        booking_type: bookingType,
        booking_value: bookingValue
      });

      const { session_id, max_kwh, max_duration_sec } = response.data.data;

      setBleStatusText('Sending Start Command...');
      try {
        await sendCommand({
          cmd: 'START',
          max_kwh: max_kwh,
          max_duration_sec: max_duration_sec || 0,
          session_id: session_id,
          user_id: user?.u_id
        });
      } catch (bleErr) {
        // The hardware failed to receive the start command. We must immediately refund the session.
        console.log('BLE Start failed, automatically refunding session...');
        setBleStatusText('Reverting booking...');
        try {
          await api.post('/sessions/sync', {
            session_id: session_id,
            total_units: 0,
            active_duration_sec: 0
          });
        } catch (_) { }
        throw new Error('Bluetooth disconnected during start. Your money has been refunded.');
      }

      Alert.alert('Success', 'AC Session Started!');
      setBleStatusText('');
      setShowBookingModal(false);
      setActionLoading(false);
      fetchStatus();
      fetchHistory(1);

    } catch (err) {
      // If it's our custom BLE fallback error, show it cleanly
      const msg = err.message === 'Bluetooth disconnected during start. Your money has been refunded.'
        ? err.message
        : err.response?.data?.message || 'Failed to authorize booking.';
      Alert.alert('Error', msg);
      setActionLoading(false);
      setBleStatusText('');
    }
  };


  // ─── BLE Telemetry Sync ────────────────────────────────────────────────────
  // When BLE is connected: update live readings and check for FINISHED state.
  // When BLE disconnects: FREEZE the last known values (don't reset to 0).
  useEffect(() => {
    if (telemetryData) {
      // Update live readings from BLE
      setAcStatus((prev) => ({
        ...prev,
        voltage: telemetryData.voltage,
        current: telemetryData.current,
        power: telemetryData.power,
        units_consumed: telemetryData.units_consumed,
        updated_at: new Date().toISOString()
      }));

      // ── Auto-sync if ESP32 finished session autonomously (limit reached or power cut) ──
      if (telemetryData.status === 'FINISHED' && activeSession) {
        const sId = activeSession.session_id || activeSession.s_id;
        const finalKwh = telemetryData.units_consumed || 0;
        console.log('[AUTO-SYNC] ESP32 finished session. Syncing to server...', { sId, finalKwh });

        (async () => {
          try {
            await api.post('/sessions/sync', {
              session_id: sId,
              total_units: finalKwh,
              active_duration_sec: telemetryData.active_sec || 0
            });
            // Tell the ESP32 that the server sync was successful — safe to go to STANDBY
            try { await sendCommand({ cmd: 'SYNC_ACK' }); } catch (_) { }
            console.log('[AUTO-SYNC] Session synced to server successfully!');
            onRefresh();
            await fetchMe();
          } catch (err) {
            if (err.response?.status === 404) {
              console.log('[AUTO-SYNC] Session already settled by manual stop.');
            } else {
              console.error('[AUTO-SYNC] Failed to sync to server:', err.response?.data?.message || err.message);
            }
          }
        })();
      }
    }
    // Note: deliberately NOT resetting acStatus on disconnect.
    // If telemetryData becomes null (BLE disconnected), we simply don't update.
  }, [telemetryData]);

  // ─── Join Session ──────────────────────────────────────────────────────────
  const handleJoin = async () => {
    setActionLoading(true);
    try {
      const sId = activeSession.session_id || activeSession.s_id;
      await api.post(`/sessions/${sId}/join`);
      await fetchStatus();
      await fetchMe();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to join session.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleInvite = async (invitee_id) => {
    try {
      const sId = activeSession.session_id || activeSession.s_id;
      await api.post('/sessions/participants/invite', { session_id: sId, invitee_id });
      Alert.alert('Success', 'Invitation sent!');
      await fetchStatus();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to send invite.');
    }
  };

  // ─── Leave Session (for participants) ──────────────────────────────────────
  const handleLeaveSession = () => {
    Alert.alert(
      'Leave Session',
      'Are you sure you want to leave this session early? Your roommate will need to approve your request before your billing stops.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: confirmLeaveSession },
      ]
    );
  };

  const confirmLeaveSession = async () => {
    setActionLoading(true);
    try {
      const sId = activeSession.session_id || activeSession.s_id;
      await api.post('/sessions/participants/leave', { session_id: sId });
      Alert.alert('Success', 'Leave request sent. Awaiting approval from a roommate.');
      await fetchStatus();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to send leave request.');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── End Session ───────────────────────────────────────────────────────────
  const handleEnd = () => {
    Alert.alert(
      'End AC Session',
      'Are you sure? The AC will turn off and your final bill will be calculated.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End Session', style: 'destructive', onPress: confirmEnd },
      ]
    );
  };

  const confirmEnd = async () => {
    setActionLoading(true);
    try {
      // 1. Send STOP command to ESP32 over BLE
      setBleStatusText('Stopping AC...');
      try {
        await sendCommand({ cmd: 'STOP' });
      } catch (e) {
        // We log the error but still proceed to sync the session to the backend just in case
        console.warn('Failed to send BLE stop command, AC might already be offline:', e);
      }

      setBleStatusText('Syncing data...');

      // 2. Sync final data with the Backend
      try {
        await api.post('/sessions/sync', {
          session_id: activeSession.session_id || activeSession.s_id,
          total_units: acStatus?.units_consumed || 0,
          active_duration_sec: telemetryData?.active_sec || 0
        });
      } catch (syncErr) {
        // If it throws a 404, it means the auto-sync hook already settled it perfectly.
        if (syncErr.response?.status !== 404) {
          throw syncErr;
        }
      }

      // 3. Acknowledge sync to ESP32 so it clears its memory and returns to STANDBY
      try { await sendCommand({ cmd: 'SYNC_ACK' }); } catch (_) { }

      Alert.alert('Success', 'Session ended and billing settled.');
      setBleStatusText('');
      onRefresh();
      await fetchMe();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to end session.');
      setBleStatusText('');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Emergency Stop ────────────────────────────────────────────────────────
  const handleEStop = () => {
    Alert.alert(
      '🚨 Emergency Stop',
      'This will IMMEDIATELY cut power to the AC. Use only in emergencies!',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'EMERGENCY STOP', style: 'destructive', onPress: confirmEStop },
      ]
    );
  };

  const confirmEStop = async () => {
    setActionLoading(true);
    try {
      await api.post(`/sessions/${activeSession.s_id}/emergency-stop`);
      await fetchStatus();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Emergency stop failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const isAcOnline = acStatus?.is_online === true;
  const myParticipant = activeSession?.participants?.find(p => Number(p.u_id) === Number(user?.u_id));
  const isParticipant = !!myParticipant;

  // Accepted participants only (not invited/left/rejected)
  const acceptedParticipants = activeSession?.participants?.filter(p => p.status === 'accepted' && !p.left_at) || [];
  const hasMultipleParticipants = acceptedParticipants.length >= 2;

  // Anyone who has a pending leave request (for me to approve/reject)
  const pendingLeaveRequests = isParticipant
    ? (activeSession?.participants?.filter(
      p => p.leave_status === 'pending' && Number(p.u_id) !== Number(user?.u_id)
    ) || [])
    : [];

  // Has MY own leave request pending (waiting for roommate approval)
  const myLeaveIsPending = myParticipant?.leave_status === 'pending';

  // If everyone else has requested to leave, I shouldn't be able to request leave too (prevent UI deadlock).
  // I should approve them and/or end the session.
  const allOthersPending = pendingLeaveRequests.length > 0 && pendingLeaveRequests.length === (acceptedParticipants.length - 1);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.purple} />
      </View>
    );
  }

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.pageTitle}>AC Session</Text>

      {/* ── AC Status Badge (Bluetooth Connection) ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        {connectedDevice ? (
          <TouchableOpacity
            style={[styles.statusBadge, { backgroundColor: 'rgba(59, 130, 246, 0.25)', marginBottom: 0 }]}
            onPress={() => disconnectFromDevice()}
          >
            <Text style={{ color: '#60A5FA', fontWeight: '600' }}><Ionicons name="bluetooth" size={14} /> Connected</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.statusBadge, { backgroundColor: 'rgba(59, 130, 246, 0.1)', marginBottom: 0 }]}
            disabled={bleConnecting}
            onPress={async () => {
              if (!roomInfo?.ac_device_name) {
                Alert.alert('Configuration Error', 'This room does not have a registered AC device.');
                return;
              }
              const hasPermission = await requestPermissions();
              if (!hasPermission) return;
              const isBluetoothOn = await checkBluetoothState();
              if (!isBluetoothOn) {
                Alert.alert('Bluetooth Required', 'Please turn on Bluetooth to connect to the AC.');
                return;
              }
              setBleConnecting(true);
              scanForSpecificPeripheral(roomInfo.ac_device_name, async (device) => {
                const connected = await connectToDevice(device);
                setBleConnecting(false);
                if (!connected) {
                  Alert.alert('Connection Failed', 'Could not connect to the AC.');
                }
              });
              // Auto-reset UI if not found after 10s
              setTimeout(() => setBleConnecting(false), 10500);
            }}
          >
            <Text style={{ color: '#3B82F6', fontWeight: '600' }}>
              <Ionicons name="bluetooth" size={14} /> {bleConnecting ? 'Scanning...' : 'Not connected'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── IDLE STATE: No active session ── */}
      {!activeSession && (
        <View style={styles.card}>
          <Text style={styles.idleIcon}>🌙</Text>
          <Text style={styles.idleTitle}>No Active Session</Text>
          <Text style={styles.idleSub}>The AC is currently off. Start a session to turn it on.</Text>
          <TouchableOpacity
            style={[styles.btnStart, (!roomInfo || !connectedDevice) && styles.btnDisabled]}
            disabled={!roomInfo || actionLoading || !connectedDevice}
            onPress={handleStart}
          >
            {actionLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnStartText}>⚡ Start New Session</Text>
            }
          </TouchableOpacity>
          {!connectedDevice && (
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 12, textAlign: 'center' }}>
              Please connect to Bluetooth to start a session.
            </Text>
          )}
        </View>
      )}

      {/* ── ACTIVE STATE ── */}
      {activeSession && (
        <>
          {/* ── PRIORITY CARDS: Actionable items shown first ── */}

          {/* Pending leave requests from roommates */}
          {pendingLeaveRequests.map(leaver => (
            <View key={leaver.u_id} style={{
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              borderWidth: 1.5,
              borderColor: 'rgba(245, 158, 11, 0.5)',
              borderRadius: 14,
              padding: 16,
              marginBottom: 12,
            }}>
              <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 15, marginBottom: 4 }}>⏳ Leave Request</Text>
              <Text style={{ color: colors.textPrimary, fontSize: 13, marginBottom: 14 }}>
                <Text style={{ fontWeight: '600' }}>{leaver.name}</Text> wants to leave the session early. Approve to stop billing them.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)', padding: 12, borderRadius: 10, alignItems: 'center' }}
                  disabled={actionLoading}
                  onPress={async () => {
                    setActionLoading(true);
                    try {
                      const sId = activeSession.session_id || activeSession.s_id;
                      await api.post('/sessions/participants/leave/approve', { session_id: sId, leaving_u_id: leaver.u_id });
                      await fetchStatus();
                    } catch (err) {
                      Alert.alert('Error', err.response?.data?.message || 'Failed to approve.');
                    } finally { setActionLoading(false); }
                  }}
                >
                  <Text style={{ color: '#22C55E', fontWeight: '700', fontSize: 14 }}>✅ Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)', padding: 12, borderRadius: 10, alignItems: 'center' }}
                  disabled={actionLoading}
                  onPress={async () => {
                    setActionLoading(true);
                    try {
                      const sId = activeSession.session_id || activeSession.s_id;
                      await api.post('/sessions/participants/leave/reject', { session_id: sId, leaving_u_id: leaver.u_id });
                      await fetchStatus();
                    } catch (err) {
                      Alert.alert('Error', err.response?.data?.message || 'Failed to reject.');
                    } finally { setActionLoading(false); }
                  }}
                >
                  <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 14 }}>❌ Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* My own pending leave request status */}
          {myLeaveIsPending && (
            <View style={{
              backgroundColor: 'rgba(99,102,241,0.1)',
              borderWidth: 1.5,
              borderColor: 'rgba(99,102,241,0.4)',
              borderRadius: 14,
              padding: 16,
              marginBottom: 12,
              alignItems: 'center',
            }}>
              <Text style={{ color: '#818CF8', fontWeight: '700', fontSize: 15 }}>⏳ Awaiting Leave Approval</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 6, textAlign: 'center' }}>
                Waiting for a roommate to approve your leave request.{`\n`}You are still being billed until they approve.
              </Text>
            </View>
          )}

          {/* Live Power Ring */}
          <View style={styles.powerRing}>
            <Text style={styles.powerWatts}>{parseFloat(acStatus?.power || 0).toFixed(0)} W</Text>
            <Text style={styles.powerLabel}>Live Power</Text>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{parseFloat(acStatus?.units_consumed || activeSession.total_units || 0).toFixed(3)}</Text>
              <Text style={styles.statLabel}>kWh Used</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.teal }]}>
                ₹ {parseFloat((acStatus?.units_consumed || 0) * (activeSession.rate_per_unit || 10) * ((myParticipant?.share_percent || 100) / 100)).toFixed(2)}
              </Text>
              <Text style={styles.statLabel}>My Cost</Text>
            </View>
          </View>

          {/* Elapsed Timer Card */}
          <View style={styles.timerCard}>
            <Text style={styles.timerLabel}>Session Duration</Text>
            <Text style={styles.timerValue}>{elapsedTime}</Text>
          </View>

          {/* Room Members & Participants */}
          {roomInfo?.members?.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Roommates</Text>
              {roomInfo.members.map((member) => {
                const p = activeSession.participants?.find(part => part.u_id === member.u_id && !['rejected', 'left'].includes(part.status));
                return (
                  <View key={member.u_id} style={styles.participantRow}>
                    <View style={styles.participantAvatar}>
                      <Text style={styles.participantAvatarText}>{member.name?.[0] || '?'}</Text>
                    </View>
                    <Text style={[styles.participantName, member.u_id === user?.u_id && { fontWeight: '900' }]}>
                      {member.name} {member.u_id === user?.u_id ? '(You)' : ''}
                    </Text>
                    {p ? (
                      <Text style={styles.participantShare}>
                        {p.status === 'invited' ? 'Invited' : 'Accepted'}
                      </Text>
                    ) : (
                      member.u_id !== user?.u_id && (
                        <TouchableOpacity
                          style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}
                          onPress={() => handleInvite(member.u_id)}
                        >
                          <Text style={{ color: '#3B82F6', fontSize: 12, fontWeight: '600' }}>Invite</Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Join Button (if not participant) */}
          {!isParticipant && (
            <TouchableOpacity
              style={styles.btnJoin}
              onPress={handleJoin}
              disabled={actionLoading}
            >
              {actionLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnJoinText}>👋 Join This Session</Text>
              }
            </TouchableOpacity>
          )}

          {/* End Session & Leave Session (only for participants) */}
          {isParticipant && (
            <View style={{ marginTop: 8 }}>

              {/* ── End Session button ── */}
              <TouchableOpacity
                style={[styles.btnEnd, !connectedDevice && styles.btnDisabled]}
                onPress={handleEnd}
                disabled={actionLoading || !connectedDevice}
              >
                {actionLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnEndText}>■ End Session For Everyone</Text>
                }
              </TouchableOpacity>
              {!connectedDevice && (
                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center', marginBottom: 12 }}>
                  Bluetooth must be connected to stop the AC.
                </Text>
              )}

              {/* ── Leave Session Early — only when 2+ accepted participants ── */}
              {hasMultipleParticipants && !myLeaveIsPending && !allOthersPending && (
                <TouchableOpacity
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    padding: 14,
                    borderRadius: 12,
                    alignItems: 'center',
                    marginTop: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(239, 68, 68, 0.3)'
                  }}
                  onPress={handleLeaveSession}
                  disabled={actionLoading}
                >
                  <Text style={{ color: '#EF4444', fontSize: 15, fontWeight: '600' }}>🏃 Leave Session Early (Stop Billing Me)</Text>
                </TouchableOpacity>
              )}

              {/* Message when everyone else wants to leave */}
              {hasMultipleParticipants && !myLeaveIsPending && allOthersPending && (
                <View style={{ marginTop: 12, padding: 12, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 12, alignItems: 'center' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, textAlign: 'center' }}>
                    All your roommates have requested to leave. Please approve their requests or end the session for everyone.
                  </Text>
                </View>
              )}
            </View>
          )}
        </>
      )}
      {/* ── History Section ── */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 16, marginBottom: 16 }}>
        <View>
          <Text style={[styles.historySectionTitle, { marginTop: 0, marginBottom: 0 }]}>Session History ({sessionStats.total})</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
            This Month ({sessionStats.monthly})
          </Text>
        </View>
        <TouchableOpacity style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8 }} onPress={() => setShowFilterModal(true)}>
          <Ionicons name="options-outline" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <View style={[StyleSheet.absoluteFill, { padding: 4, flexDirection: 'row' }]}>
          <View style={{
            flex: 1,
            backgroundColor: colors.purple,
            borderRadius: 10,
            marginLeft: scope === 'room' ? '50%' : 0,
            marginRight: scope === 'me' ? '50%' : 0,
          }} />
        </View>
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => {
            if (scope !== 'me') {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setScope('me');
              fetchHistory(1, 'me', filterType, filterDate);
            }
          }}
        >
          <Text style={[styles.filterText, scope === 'me' && styles.filterTextActive]}>My Sessions</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => {
            if (scope !== 'room') {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setScope('room');
              fetchHistory(1, 'room', filterType, filterDate);
            }
          }}
        >
          <Text style={[styles.filterText, scope === 'room' && styles.filterTextActive]}>Room Sessions</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const handleSessionClick = async (s) => {
    setSelectedSession(s);
    setModalLoading(true);
    try {
      const res = await api.get(`/sessions/${s.session_id}`);
      const fullSession = res.data?.data?.session || res.data?.data;
      if (fullSession) {
        setSelectedSession({ ...fullSession, ...s });
      }
    } catch (err) {
      console.error('Failed to fetch session details:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const renderItem = ({ item }) => {
    const s = item;

    const h = Math.floor((s.duration_minutes || 0) / 60);
    const m = Math.round((s.duration_minutes || 0) % 60);
    const durationStr = s.duration_minutes ? `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m` : '—';

    return (
      <TouchableOpacity style={styles.historyItem} onPress={() => handleSessionClick(s)}>
        <View style={styles.historyIcon}>
          <Text style={{ fontSize: 16 }}>⚡</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.historyDate}>
            #{s.session_id} • {new Date(s.start_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
          <Text style={styles.historyMeta}>
            {durationStr} • {s.total_units ? parseFloat(s.total_units).toFixed(3) + ' kWh' : ''}
          </Text>
        </View>
        <Text style={styles.historyCost}>₹ {parseFloat(s.my_cost_display || s.my_cost || s.total_cost || 0).toFixed(2)}</Text>
      </TouchableOpacity>
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
    <View style={{ alignItems: 'center', paddingVertical: 32 }}>
      <Text style={styles.textMuted}>No past sessions found.</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <FlatList
        data={sessionHistory}
        keyExtractor={(s, i) => s.session_id?.toString() || i.toString()}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purple} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
      />

      <Modal visible={!!selectedSession} transparent animationType="fade" onRequestClose={() => setSelectedSession(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedSession(null)}>
          <TouchableOpacity activeOpacity={1} style={[styles.modalCard, { backgroundColor: '#1E1E2E' }]}>
            {modalLoading && !selectedSession?.participants ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.purple} />
              </View>
            ) : (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={styles.modalTitle}>Session #{selectedSession?.session_id}</Text>
                  <View style={[styles.badge, selectedSession?.status === 'active' ? styles.badgeOnline : { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                    <Text style={[styles.badgeText, selectedSession?.status !== 'active' && { color: colors.textSecondary }]}>
                      {selectedSession?.status?.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalGrid}>
                  <View style={styles.modalStat}>
                    <Text style={styles.modalStatLabel}>Type</Text>
                    <Text style={styles.modalStatValue}>{selectedSession?.session_type} {selectedSession?.target_value ? `(${selectedSession.target_value})` : ''}</Text>
                  </View>
                  <View style={styles.modalStat}>
                    <Text style={styles.modalStatLabel}>Date</Text>
                    <Text style={styles.modalStatValue}>{new Date(selectedSession?.start_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                  <View style={styles.modalStat}>
                    <Text style={styles.modalStatLabel}>Duration</Text>
                    <Text style={styles.modalStatValue}>
                      {(() => {
                        const h = Math.floor((selectedSession?.duration_minutes || 0) / 60);
                        const m = Math.round((selectedSession?.duration_minutes || 0) % 60);
                        return selectedSession?.duration_minutes ? `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m` : '—';
                      })()}
                    </Text>
                  </View>
                  <View style={styles.modalStat}>
                    <Text style={styles.modalStatLabel}>Energy</Text>
                    <Text style={styles.modalStatValue}>{selectedSession?.total_units ? parseFloat(selectedSession.total_units).toFixed(3) : '0'} kWh</Text>
                  </View>
                  <View style={styles.modalStat}>
                    <Text style={styles.modalStatLabel}>Total Cost</Text>
                    <Text style={styles.modalStatValue}>
                      ₹ {parseFloat(
                        (selectedSession?.total_cost && parseFloat(selectedSession.total_cost) > 0)
                          ? selectedSession.total_cost
                          : (parseFloat(selectedSession?.total_units || 0) * parseFloat(selectedSession?.rate_per_unit || 0))
                      ).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.modalStat}>
                    <Text style={styles.modalStatLabel}>My Share</Text>
                    <Text style={[styles.modalStatValue, { color: colors.teal }]}>₹ {parseFloat(selectedSession?.my_cost_display || selectedSession?.my_cost || selectedSession?.total_cost || 0).toFixed(2)}</Text>
                  </View>
                </View>

                {selectedSession?.participants && selectedSession.participants.length > 0 && (
                  <>
                    <Text style={[styles.historySectionTitle, { marginTop: 16, marginBottom: 8 }]}>Participants</Text>
                    {selectedSession.participants.map((p, idx) => {
                      // Bulletproof matching (u_id might be undefined in some edge cases from API)
                      const isMe = 
                        (p.u_id && user?.u_id && Number(p.u_id) === Number(user?.u_id)) || 
                        (p.email && user?.email && p.email === user?.email) ||
                        (p.name && user?.name && p.name.trim() === user?.name.trim());
                      
                      return (
                        <View key={p.u_id || idx} style={styles.participantRow}>
                        <View style={styles.participantAvatar}>
                          <Text style={styles.participantAvatarText}>{p.name?.[0] || 'U'}</Text>
                        </View>
                        <Text style={[styles.participantName, isMe && { fontWeight: '900' }]}>
                          {p.name} {isMe ? '(You)' : ''}
                        </Text>
                        <Text style={styles.participantShare}>
                          {p.cost ? `₹${parseFloat(p.cost).toFixed(2)}` : (p.share_amount ? `₹${parseFloat(p.share_amount).toFixed(2)}` : '')}
                          {p.share_percent ? ` (${Math.round(p.share_percent)}%)` : ''}
                        </Text>
                      </View>
                      );
                    })}
                  </>
                )}

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 24 }}>
                  <TouchableOpacity style={styles.btnClose} onPress={() => setSelectedSession(null)}>
                    <Text style={styles.btnCloseText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Filter Modal ── */}
      <Modal visible={showFilterModal} transparent animationType="fade" onRequestClose={() => setShowFilterModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowFilterModal(false)} />
          <View style={{ backgroundColor: '#1E1E2E', borderRadius: 24, padding: 28, width: '100%', borderWidth: 1, borderColor: colors.border }}>
            <Text style={styles.modalTitle}>Filters</Text>

            <Text style={{ color: colors.textSecondary, marginTop: 16, marginBottom: 8, fontSize: 13, fontWeight: '600' }}>Booking Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {['all', 'duration', 'budget', 'units', 'unlimited'].map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.badge, filterType === t ? { backgroundColor: colors.purple } : { backgroundColor: 'rgba(255,255,255,0.05)' }]}
                  onPress={() => setFilterType(t)}
                >
                  <Text style={[styles.badgeText, filterType === t && { color: '#fff' }]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ color: colors.textSecondary, marginTop: 24, marginBottom: 8, fontSize: 13, fontWeight: '600' }}>DATE</Text>
            <View style={[styles.modalInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }]}>
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
                          const yyyy = selectedDate.getFullYear();
                          const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
                          const dd = String(selectedDate.getDate()).padStart(2, '0');
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
                <Ionicons name="calendar-outline" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.btnPrimary, { marginTop: 24 }]}
              onPress={() => {
                setShowFilterModal(false);
                fetchHistory(1, scope, filterType, filterDate);
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
                fetchHistory(1, scope, 'all', '');
              }}
            >
              <Text style={{ color: colors.error, fontSize: 15, fontWeight: '700' }}>Clear All Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Booking Modal (Offline-First BLE) ── */}
      <Modal visible={showBookingModal} transparent animationType="fade" onRequestClose={() => setShowBookingModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => {
          if (!actionLoading) {
            setShowBookingModal(false);
            stopScanning();
          }
        }}>
          <TouchableOpacity style={[styles.modalCard, { padding: 0, overflow: 'hidden', backgroundColor: '#1E1E2E' }]} activeOpacity={1}>
            <View style={{ backgroundColor: '#1E1E2E', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={styles.modalTitle}>Book AC Session</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>Select a limit. The AC will stop automatically.</Text>
            </View>

            <View style={{ padding: 20 }}>
              <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4, marginBottom: 20 }}>
                {['duration', 'amount', 'units'].map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.filterBtn, bookingType === t && styles.filterBtnActive]}
                    onPress={() => {
                      setBookingType(t);
                      if (t === 'amount') setBookingValue('20');
                      else if (t === 'duration') setBookingValue('1.5');
                      else if (t === 'units') setBookingValue('1.5');
                    }}
                  >
                    <Text style={[styles.filterText, bookingType === t && styles.filterTextActive]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.inputGroup}>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>
                  {bookingType === 'duration' ? 'Duration (Hours)' : bookingType === 'amount' ? 'Amount (₹)' : 'Energy (kWh)'}
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={`Enter ${bookingType}`}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={bookingValue}
                  onChangeText={setBookingValue}
                />
              </View>

              {actionLoading ? (
                <View style={{ marginTop: 24, alignItems: 'center', padding: 14 }}>
                  <ActivityIndicator size="small" color={colors.purple} />
                  <Text style={{ color: colors.purple, marginTop: 12, fontWeight: '600' }}>
                    {bleStatusText || 'Connecting...'}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.btnPrimary, { marginTop: 24 }]}
                  onPress={async () => {
                    if (!bookingValue || isNaN(bookingValue) || parseFloat(bookingValue) <= 0) {
                      Alert.alert('Invalid', 'Please enter a valid number.');
                      return;
                    }

                    // Step 1: Request BLE Permissions
                    const hasPermission = await requestPermissions();
                    if (!hasPermission) {
                      Alert.alert('Permission Denied', 'Bluetooth permissions are required to start the AC.');
                      return;
                    }

                    // Start booking flow
                    confirmStart();
                  }}
                >
                  <Text style={styles.btnPrimaryText}>Connect & Start</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={{ marginTop: 16, alignItems: 'center' }}
                onPress={() => {
                  stopScanning();
                  setActionLoading(false);
                  setBleStatusText('');
                  setShowBookingModal(false);
                }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
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
          display="default"
          onChange={onDateChange}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  scroll: { padding: 24, paddingTop: 56, paddingBottom: 32 },
  headerContainer: { paddingBottom: 16 },
  pageTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  statusBadge: { borderRadius: 50, paddingVertical: 6, paddingHorizontal: 16, alignSelf: 'flex-start', marginBottom: 20 },
  statusOnline: { backgroundColor: 'rgba(34, 197, 94, 0.15)' },
  statusOffline: { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
  statusText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  card: { backgroundColor: colors.backgroundCard, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 20, marginBottom: 16, alignItems: 'center' },
  cardTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', alignSelf: 'flex-start', marginBottom: 12 },
  idleIcon: { fontSize: 48, marginBottom: 12 },
  idleTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  idleSub: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 24 },
  btnStart: { backgroundColor: colors.purple, borderRadius: 50, paddingVertical: 14, paddingHorizontal: 32, width: '100%', alignItems: 'center' },
  btnStartText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },
  disabledNote: { color: colors.textMuted, fontSize: 12, marginTop: 12 },
  powerRing: { backgroundColor: colors.backgroundCard, borderRadius: 100, width: 200, height: 200, alignSelf: 'center', justifyContent: 'center', alignItems: 'center', borderWidth: 6, borderColor: colors.purple, marginBottom: 24 },
  powerWatts: { color: colors.textPrimary, fontSize: 36, fontWeight: '700' },
  powerLabel: { color: colors.textSecondary, fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: colors.backgroundCard, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, alignItems: 'center' },
  statValue: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  statLabel: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  participantRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, width: '100%', gap: 12 },
  participantAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.purple, justifyContent: 'center', alignItems: 'center' },
  participantAvatarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  participantName: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  participantShare: { color: colors.teal, fontSize: 14, fontWeight: '600' },
  btnJoin: { backgroundColor: colors.purpleDark, borderRadius: 50, padding: 16, alignItems: 'center', marginBottom: 12 },
  btnJoinText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnEnd: { backgroundColor: colors.error, borderRadius: 50, padding: 16, alignItems: 'center', marginBottom: 12 },
  btnEndText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  timerCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  timerLabel: { color: colors.textSecondary, fontSize: 13, marginBottom: 4 },
  timerValue: { color: colors.textPrimary, fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  historySectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 16, marginTop: 16 },
  filterContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4, marginBottom: 0 },
  filterBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  filterBtnActive: { backgroundColor: colors.purple },
  filterText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  historyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  historyIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(168, 85, 247, 0.15)', justifyContent: 'center', alignItems: 'center' },
  historyDate: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  historyMeta: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  historyCost: { color: colors.teal, fontSize: 16, fontWeight: '700' },
  textMuted: { color: colors.textMuted, fontSize: 14, fontStyle: 'italic', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: colors.backgroundCard, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: colors.border },
  modalTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  modalGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, marginHorizontal: -8 },
  modalStat: { width: '50%', padding: 8 },
  modalStatLabel: { color: colors.textSecondary, fontSize: 13, marginBottom: 4 },
  modalStatValue: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  modalInput: { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16, color: colors.textPrimary, fontSize: 15 },
  badge: { borderRadius: 50, paddingVertical: 6, paddingHorizontal: 12 },
  badgeOnline: { backgroundColor: 'rgba(34, 197, 94, 0.15)' },
  badgeText: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  btnPrimary: { backgroundColor: colors.purple, borderRadius: 50, padding: 14, alignItems: 'center', marginTop: 4 },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnClose: { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderRadius: 50, paddingVertical: 10, paddingHorizontal: 24, alignItems: 'center' },
  btnCloseText: { color: colors.error, fontSize: 14, fontWeight: '700' },
});

export default SessionScreen;
