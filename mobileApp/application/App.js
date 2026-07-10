// =============================================================================
// App.js — FairAC Mobile Application Root
// =============================================================================

import 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import { BLEProvider } from './src/context/BLEContext';
import AppNavigator    from './src/navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <BLEProvider>
        <AppNavigator />
      </BLEProvider>
    </AuthProvider>
  );
}
