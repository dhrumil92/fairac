import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, RefreshControl,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import * as Notifications from 'expo-notifications';
import { useBLE } from '../../context/BLEContext';

const RoomScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { disconnectFromDevice } = useBLE();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // State A: Has Room
  const [room, setRoom] = useState(null);
  const [inviteIdentifier, setInviteIdentifier] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  // State B: No Room
  const [invitations, setInvitations] = useState([]);
  const [newRoomNo, setNewRoomNo] = useState('');
  const [newRoomCapacity, setNewRoomCapacity] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchRoomData = useCallback(async () => {
    try {
      const roomRes = await api.get('/rooms/my');
      setRoom(roomRes.data?.data?.room || roomRes.data?.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setRoom(null);
        fetchNoRoomData();
      } else {
        console.error('Failed to load room data', err);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchNoRoomData = async () => {
    try {
      const invRes = await api.get('/rooms/invitations');
      setInvitations(invRes.data?.data?.invitations || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchRoomData();

    // Listen for Push Notifications in the background to instantly refresh data
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data;
      if (data?.type === 'INVITE_RECEIVED' || data?.type === 'INVITE_ACCEPTED') {
        // Someone invited us OR someone accepted our invite -> refresh silently
        fetchRoomData();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [fetchRoomData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRoomData();
  };

  const handleInvite = async () => {
    if (!inviteIdentifier.trim()) return;
    setIsInviting(true);
    try {
      const res = await api.post('/rooms/invite', {
        room_id: room.r_id,
        identifier: inviteIdentifier
      });
      Alert.alert('Success', res.data.message);
      setInviteIdentifier('');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to send invite.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleLeaveRoom = () => {
    Alert.alert(
      'Leave Room?',
      'Are you sure you want to leave this room? You will lose access to it and will need an invitation to rejoin.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.patch(`/rooms/${room.r_id}/leave`);
              disconnectFromDevice(); // Instantly disconnect BLE when leaving
              Alert.alert('Success', 'Successfully left the room.');
              setRoom(null);
              fetchNoRoomData();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to leave room.');
            }
          }
        }
      ]
    );
  };

  const handleCreateRoom = async () => {
    if (!newRoomNo || !newRoomCapacity) {
      Alert.alert('Error', 'Please fill all fields to create a room.');
      return;
    }
    setIsCreating(true);
    try {
      const res = await api.post('/rooms', {
        room_no: newRoomNo,
        room_name: `Room ${newRoomNo}`,
        capacity: parseInt(newRoomCapacity, 10),
        rate_per_unit: 10.50
      });
      Alert.alert('Success', res.data.message);
      fetchRoomData();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to create room.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleInvitationAction = async (invitationId, action) => {
    try {
      const endpoint = action === 'accept' ? '/rooms/invite/accept' : '/rooms/invite/reject';
      const res = await api.post(endpoint, { invitation_id: invitationId });
      Alert.alert('Success', res.data.message);
      if (action === 'accept') {
        fetchRoomData();
      } else {
        setInvitations(invitations.filter(i => i.invitation_id !== invitationId));
      }
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || `Failed to ${action} invitation.`);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.purple} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Room</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purple} />}
      >
        {room ? (
          // ── STATE A: HAS ROOM ──
          <View style={styles.section}>
            {/* Room Info Card */}
            <View style={styles.glassCard}>
              <View style={styles.roomHeaderRow}>
                <View>
                  <Text style={styles.roomNoDisplay}>{room.room_name || `Room ${room.room_no}`}</Text>
                  <Text style={styles.hostelName}>{room.hostel_name || 'Hostel'}</Text>
                </View>
                <View style={[styles.badge, room.room_active ? styles.badgeActive : styles.badgeInactive]}>
                  {room.room_active && <View style={styles.pulseDot} />}
                  <Text style={[styles.badgeText, room.room_active ? styles.badgeTextActive : styles.badgeTextInactive]}>
                    {room.room_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>

              <View style={styles.roomStatsGrid}>
                <View style={styles.statGroup}>
                  <Text style={styles.statLabel}>Capacity</Text>
                  <Text style={styles.statValue}>{room.capacity} Persons</Text>
                </View>
                <View style={styles.statGroup}>
                  <Text style={styles.statLabel}>Billing Rate</Text>
                  <Text style={[styles.statValue, { color: colors.teal }]}>
                    ₹{room.rate_per_unit}
                    <Text style={styles.statUnit}>/unit</Text>
                  </Text>
                </View>
              </View>
            </View>

            {/* Roommates */}
            <View style={{ gap: 12 }}>
              <Text style={styles.sectionTitle}>Roommates</Text>
              <View style={styles.membersList}>
                {room.members?.map((member) => {
                  const isOwner = member.role === 'owner';
                  const isMe = user?.u_id === member.u_id;
                  return (
                    <View key={member.u_id} style={styles.memberCard}>
                      <View style={[styles.avatar, isOwner ? styles.avatarOwner : styles.avatarMember]}>
                        <Text style={[styles.avatarText, isOwner ? styles.avatarTextOwner : styles.avatarTextMember]}>
                          {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.memberDetails}>
                        <Text style={styles.memberName}>{member.name} {isMe && '(You)'}</Text>
                        <Text style={styles.memberEmail}>{member.email}</Text>
                      </View>
                      <View style={[styles.roleBadge, isOwner ? styles.roleBadgeOwner : styles.roleBadgeMember]}>
                        <Text style={[styles.roleBadgeText, isOwner ? styles.roleBadgeTextOwner : styles.roleBadgeTextMember]}>
                          {isOwner ? 'Owner' : 'Member'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Invite Roommate (Owner Only) */}
            {room.my_role === 'owner' && room.members?.length < room.capacity && (
              <View style={{ gap: 12 }}>
                <Text style={styles.sectionTitle}>Invite Roommate</Text>
                <View style={styles.glassCard}>
                  <Text style={styles.inviteSub}>Enter the email or mobile of the student you want to invite.</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      placeholder="Email or Mobile"
                      placeholderTextColor={colors.textMuted}
                      value={inviteIdentifier}
                      onChangeText={setInviteIdentifier}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.btnPrimary, isInviting && { opacity: 0.7 }]}
                    onPress={handleInvite}
                    disabled={isInviting}
                  >
                    {isInviting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Send Invite</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Leave Room */}
            <TouchableOpacity style={styles.btnDangerOutline} onPress={handleLeaveRoom}>
              <Ionicons name="log-out-outline" size={20} color={colors.error} />
              <Text style={styles.btnDangerOutlineText}>Leave Room</Text>
            </TouchableOpacity>

          </View>
        ) : (
          // ── STATE B: NO ROOM ──
          <View style={styles.section}>

            <View style={[styles.glassCard, { alignItems: 'center', paddingVertical: 40 }]}>
              <Ionicons name="home-outline" size={64} color={colors.purple} style={{ marginBottom: 16 }} />
              <Text style={styles.emptyTitle}>You haven't joined a room yet.</Text>
              <Text style={styles.emptySub}>Create a new room or check your invitations to get started.</Text>
            </View>

            {/* Pending Invitations */}
            {invitations.length > 0 && (
              <View style={{ marginTop: 24, gap: 1 }}>
                <Text style={[styles.sectionTitle, { color: colors.warning }]}>
                  <Ionicons name="notifications" size={18} /> Pending Invitations
                </Text>
                {invitations.map(inv => (
                  <View key={inv.invitation_id} style={styles.memberCard}>
                    <View style={styles.memberDetails}>
                      <Text style={styles.inviteText}>
                        <Text style={{ fontWeight: 'bold', color: '#fff' }}>{inv.invited_by_name || inv.sent_by}</Text> invited you to
                        <Text style={{ fontWeight: 'bold', color: colors.purple }}> {inv.room_name || `Room ${inv.room_no}`}</Text>
                      </Text>
                      <Text style={styles.memberEmail}>Status: Pending</Text>
                    </View>
                    <View style={styles.inviteActions}>
                      <TouchableOpacity style={styles.btnAccept} onPress={() => handleInvitationAction(inv.invitation_id, 'accept')}>
                        <Text style={styles.btnAcceptText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.btnReject} onPress={() => handleInvitationAction(inv.invitation_id, 'reject')}>
                        <Text style={styles.btnRejectText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Create New Room */}
            <View style={{ marginTop: 24, gap: 12 }}>
              <Text style={styles.sectionTitle}>Create New Room</Text>
              <View style={styles.glassCard}>
                <View style={styles.formRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Room Number</Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. 204"
                        placeholderTextColor={colors.textMuted}
                        value={newRoomNo}
                        onChangeText={setNewRoomNo}
                      />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Capacity</Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={styles.input}
                        placeholder="2-4"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        value={newRoomCapacity}
                        onChangeText={setNewRoomCapacity}
                      />
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.btnPrimary, isCreating && { opacity: 0.7 }, { marginTop: 12 }]}
                  onPress={handleCreateRoom}
                  disabled={isCreating}
                >
                  {isCreating ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Create Room</Text>}
                </TouchableOpacity>
              </View>
            </View>

          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  scroll: { padding: 24, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: 'rgba(15, 23, 41, 0.8)',
  },
  backBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  section: {
    flex: 1,
    gap: 10,
  },
  glassCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
  },
  roomHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  roomNoDisplay: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -1,
  },
  hostelName: {
    fontSize: 16,
    color: colors.purple,
    marginTop: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 50,
    borderWidth: 1,
    gap: 6,
  },
  badgeActive: {
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    borderColor: 'rgba(0, 212, 170, 0.2)',
  },
  badgeInactive: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderColor: 'rgba(255, 107, 107, 0.2)',
  },
  pulseDot: {
    width: 8, height: 8,
    borderRadius: 4,
    backgroundColor: colors.teal,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeTextActive: { color: colors.teal },
  badgeTextInactive: { color: colors.error },
  roomStatsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  statGroup: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statUnit: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '400',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  membersList: {
    gap: 12,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 16,
  },
  avatar: {
    width: 48, height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarOwner: {
    backgroundColor: 'rgba(108, 99, 255, 0.15)',
    borderColor: 'rgba(108, 99, 255, 0.3)',
  },
  avatarMember: {
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
    borderColor: 'rgba(0, 212, 170, 0.3)',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  avatarTextOwner: { color: colors.purple },
  avatarTextMember: { color: colors.teal },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  memberEmail: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 50,
  },
  roleBadgeOwner: { backgroundColor: 'rgba(108, 99, 255, 0.1)' },
  roleBadgeMember: { backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  roleBadgeText: { fontSize: 12, fontWeight: '600' },
  roleBadgeTextOwner: { color: colors.purple },
  roleBadgeTextMember: { color: colors.textSecondary },
  inviteSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  inputContainer: {
    backgroundColor: colors.backgroundInput,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  input: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  inputLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
    fontWeight: '500',
  },
  btnPrimary: {
    backgroundColor: colors.purple,
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  btnDangerOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    gap: 8,
  },
  btnDangerOutlineText: {
    color: colors.error,
    fontSize: 15,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  inviteText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  inviteActions: {
    gap: 8,
  },
  btnAccept: {
    backgroundColor: colors.teal,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 50,
    alignItems: 'center',
  },
  btnAcceptText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 13,
  },
  btnReject: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.error,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 50,
    alignItems: 'center',
  },
  btnRejectText: {
    color: colors.error,
    fontWeight: '600',
    fontSize: 13,
  },
  formRow: {
    flexDirection: 'row',
    gap: 16,
  }
});

export default RoomScreen;
