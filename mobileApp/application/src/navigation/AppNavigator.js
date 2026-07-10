// =============================================================================
// src/navigation/AppNavigator.js
// Root Navigation — controls which screens to show based on auth state
// =============================================================================

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';

// Auth Screens
import LoginScreen    from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Main App (Bottom Tabs)
import MainTabNavigator from './MainTabNavigator';
import RoomScreen from '../screens/student/RoomScreen';
import ChangePasswordScreen from '../screens/student/ChangePasswordScreen';
import usePushNotifications from '../hooks/usePushNotifications';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { user, isLoading } = useAuth();
  usePushNotifications(); // Initialize push notification listeners and tokens

  // Show spinner while checking saved login from AsyncStorage
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.purple} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          // User is logged in → show main app with bottom tabs
          <Stack.Group>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen name="MyRoom" component={RoomScreen} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
          </Stack.Group>
        ) : (
          // User is not logged in → show auth screens
          <>
            <Stack.Screen name="Login"    component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
