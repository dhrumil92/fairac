// =============================================================================
// src/navigation/MainTabNavigator.js
// Bottom Tab Navigation — 4 tabs: Home, Session, Wallet, Profile
// =============================================================================

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

// Screens
import DashboardScreen from '../screens/student/DashboardScreen';
import SessionScreen   from '../screens/student/SessionScreen';
import WalletScreen    from '../screens/student/WalletScreen';
import ProfileScreen   from '../screens/student/ProfileScreen';

const Tab = createBottomTabNavigator();

const MainTabNavigator = () => {
  const insets = useSafeAreaInsets();
  // On devices with a gesture bar or soft nav buttons, insets.bottom > 0
  const tabBarHeight = 65 + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopColor:  colors.border,
          borderTopWidth:  1,
          paddingBottom:   8 + insets.bottom,
          paddingTop:      8,
          height:          tabBarHeight,
        },
        tabBarActiveTintColor:   colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: {
          fontSize:   11,
          fontWeight: '600',
          marginTop:  2,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarActiveTintColor: colors.tabActive,
          tabBarIcon: ({ focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={focused ? colors.tabActive : 'rgba(168, 85, 247, 0.5)'} />,
        }}
      />
      <Tab.Screen
        name="Session"
        component={SessionScreen}
        options={{
          tabBarLabel: 'Session',
          tabBarActiveTintColor: '#f59e0b',
          tabBarIcon: ({ focused }) => <Ionicons name={focused ? 'flash' : 'flash-outline'} size={22} color={focused ? '#f59e0b' : 'rgba(245, 158, 11, 0.5)'} />,
        }}
      />
      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{
          tabBarLabel: 'Wallet',
          tabBarActiveTintColor: '#22c55e',
          tabBarIcon: ({ focused }) => <Ionicons name={focused ? 'wallet' : 'wallet-outline'} size={22} color={focused ? '#22c55e' : 'rgba(34, 197, 94, 0.5)'} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarActiveTintColor: '#3b82f6',
          tabBarIcon: ({ focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={focused ? '#3b82f6' : 'rgba(59, 130, 246, 0.5)'} />,
        }}
      />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
