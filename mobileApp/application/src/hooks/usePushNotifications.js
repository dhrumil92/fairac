import { useState, useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

// ─── Show notifications even while app is foregrounded ───────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─── Register Actionable Notification Categories ──────────────────────────────
// This registers the "Accept/Reject" button sets on the device.
// Must be called once at app startup, before any notifications arrive.
async function registerCategories() {
  await Notifications.setNotificationCategoryAsync('SESSION_INVITE', [
    {
      identifier: 'accept_session',
      buttonTitle: '✅ Accept',
      options: { opensAppToForeground: true }, // Must be true for killed state on Android
    },
    {
      identifier: 'reject_session',
      buttonTitle: '❌ Reject',
      options: { opensAppToForeground: true },
    },
  ]);

  await Notifications.setNotificationCategoryAsync('LEAVE_REQUEST', [
    {
      identifier: 'approve_leave',
      buttonTitle: '✅ Approve',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'reject_leave',
      buttonTitle: '❌ Reject',
      options: { opensAppToForeground: true },
    },
  ]);

  await Notifications.setNotificationCategoryAsync('ROOM_INVITE', [
    {
      identifier: 'accept_room',
      buttonTitle: '✅ Accept',
      options: { opensAppToForeground: true },
    },
    {
      identifier: 'reject_room',
      buttonTitle: '❌ Decline',
      options: { opensAppToForeground: true },
    },
  ]);
}

// ─── Handle a button tap from notification (background OR foreground) ─────────
export async function handleNotificationAction(response, navigationRef) {
  const actionId = response.actionIdentifier;
  const data = response.notification.request.content.data;

  try {
    if (actionId === 'accept_session' && data?.session_id) {
      await api.post('/sessions/participants/accept', { session_id: data.session_id });
      Alert.alert('✅ Joined!', 'You have joined the AC session. Your share will be tracked from now.');
    } else if (actionId === 'reject_session') {
      await api.post('/sessions/participants/reject', { session_id: data.session_id });
      Alert.alert('❌ Rejected', 'You have declined the session invite. You will not be charged.');
    } else if (actionId === 'approve_leave') {
      await api.post('/sessions/participants/leave/approve', {
        session_id: data.session_id,
        leaving_u_id: data.leaving_u_id,
      });
      Alert.alert('✅ Approved', 'Leave request approved.');
    } else if (actionId === 'reject_leave') {
      await api.post('/sessions/participants/leave/reject', {
        session_id: data.session_id,
        leaving_u_id: data.leaving_u_id,
      });
      Alert.alert('❌ Rejected', 'Leave request rejected. They remain in the session.');
    } else if (actionId === 'accept_room' && data?.invitation_id) {
      await api.post('/rooms/invite/accept', { invitation_id: data.invitation_id });
      Alert.alert('✅ Joined!', 'You are now a member of the room.');
    } else if (actionId === 'reject_room' && data?.invitation_id) {
      await api.post('/rooms/invite/reject', { invitation_id: data.invitation_id });
      Alert.alert('Declined', 'Room invitation declined.');
    } else if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      // User tapped the notification itself (not a button)
      const type = data?.type;
      const sessionTypes = [
        'SESSION_STARTED', 'SESSION_INVITE', 'LEAVE_REQUEST', 'LEAVE_APPROVED',
        'LEAVE_REJECTED', 'INVITE_ACCEPTED', 'INVITE_REJECTED',
        'SESSION_INVITE_REMINDER', 'LEAVE_REMINDER'
      ];
      if (sessionTypes.includes(type)) {
        navigationRef?.current?.navigate('Main', { screen: 'Session' });
      } else if (type === 'ROOM_INVITE') {
        navigationRef?.current?.navigate('MyRoom');
      }
    }
  } catch (err) {
    console.error('Notification action error:', err);
    const msg = err.response?.data?.message || 'Action failed. Please open the app.';
    Alert.alert('Error', msg);
  }
}

// ─── Main Hook ────────────────────────────────────────────────────────────────
export default function usePushNotifications(navigationRef) {
  const { user, token } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(false);
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // 1. Register notification categories (Accept/Reject buttons)
    registerCategories().catch(console.error);

    // 2. Register device push token with backend
    if (user && token) {
      registerForPushNotificationsAsync().then(pushToken => {
        if (pushToken) {
          setExpoPushToken(pushToken);
          api.post('/auth/push-token', { pushToken }).catch(console.error);
        }
      });
    }

    // 3. Listen for notifications received while app is open
    notificationListener.current = Notifications.addNotificationReceivedListener(notif => {
      setNotification(notif);
    });

    // 4. Listen for user tapping a notification button (the magic!)
    //    This fires both in foreground AND background (when app is open in background)
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      handleNotificationAction(response, navigationRef);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user, token]);

  return { expoPushToken, notification };
}

// ─── Register Device for Push Notifications ───────────────────────────────────
async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'FairAC Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7C3AED',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied.');
      return;
    }

    try {
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      if (!projectId) {
        console.warn('No EAS projectId found in app.json.');
      }
      token = (await Notifications.getExpoPushTokenAsync({
        projectId,
      })).data;
      // console.log('Expo Push Token:', token);
    } catch (e) {
      console.error('Failed to get push token:', e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}
