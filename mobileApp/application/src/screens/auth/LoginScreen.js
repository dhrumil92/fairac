// =============================================================================
// src/screens/auth/LoginScreen.js
// Login Screen — Mobile version
// Logic copied from web LoginPage.jsx, UI rebuilt for React Native
// =============================================================================

import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, StatusBar, Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { colors } from '../../theme/colors';

const LoginScreen = ({ navigation }) => {
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]     = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState('');

  // ─── Copied from web LoginPage.jsx handleSubmit ────────────────────────────
  const handleSubmit = async () => {
    setError('');
    if (!identifier.trim() || !password) {
      setError('Please enter your email/mobile and password.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.post('/auth/login', { identifier, password });
      const { token, user } = response.data.data;
      await login(token, user);
      // Navigation is handled automatically by the root navigator
      // via the AuthContext user state change
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Logo ── */}
        <View style={styles.logoContainer}>
          <View style={styles.logoBox}>
            <Text style={styles.logoLetter}>F</Text>
            <View style={styles.logoDot} />
          </View>
          <Text style={styles.logoText}>FairAC</Text>
        </View>

        {/* ── Tagline ── */}
        <Text style={styles.tagline}>Fair AC Billing.{'\n'}Zero Disputes.</Text>
        <Text style={styles.subtitle}>Log in to your account</Text>

        {/* ── Glass Card ── */}
        <View style={styles.card}>

          {/* Error Banner */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️  {error}</Text>
            </View>
          ) : null}

          {/* Email / Mobile Input */}
          <Text style={styles.label}>Email or Mobile Number</Text>
          <TextInput
            style={styles.input}
            placeholder="raj@example.com or 9876543210"
            placeholderTextColor={colors.textMuted}
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          {/* Password Input */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Enter your password"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPass(!showPass)}
            >
              <Text style={styles.eyeIcon}>{showPass ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.btnPrimary, isLoading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnPrimaryText}>Login</Text>
            }
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>New to FairAC?</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Register Link */}
          <TouchableOpacity
            style={styles.btnOutline}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.btnOutlineText}>Create Account</Text>
          </TouchableOpacity>
        </View>

        {/* Features */}
        <View style={styles.features}>
          <Text style={styles.featureItem}>⚡  Usage-based billing</Text>
          <Text style={styles.featureItem}>👥  Share only your time</Text>
          <Text style={styles.featureItem}>💳  Instant wallet top-up</Text>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.purpleDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  logoLetter: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  logoDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.teal,
  },
  logoText: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
  },
  tagline: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    marginBottom: 32,
  },
  card: {
    backgroundColor: colors.backgroundCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    marginBottom: 32,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: colors.backgroundInput,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    color: colors.textPrimary,
    fontSize: 15,
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  eyeBtn: {
    padding: 14,
    backgroundColor: colors.backgroundInput,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyeIcon: {
    fontSize: 18,
  },
  btnPrimary: {
    backgroundColor: colors.purple,
    borderRadius: 50,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  btnOutline: {
    borderRadius: 50,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.purple,
  },
  btnOutlineText: {
    color: colors.purple,
    fontSize: 16,
    fontWeight: '600',
  },
  features: {
    gap: 12,
  },
  featureItem: {
    color: colors.textSecondary,
    fontSize: 15,
  },
});

export default LoginScreen;
