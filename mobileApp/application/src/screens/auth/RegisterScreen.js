// =============================================================================
// src/screens/auth/RegisterScreen.js
// Register Screen — Mobile version
// Logic copied from web RegisterPage.jsx, UI rebuilt for React Native
// =============================================================================

import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, StatusBar,
} from 'react-native';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';

const RegisterScreen = ({ navigation }) => {
  const { login } = useAuth();

  const [form, setForm] = useState({
    name: '', email: '', mobile: '', password: '', secret_code: '',
  });
  const [showPass, setShowPass]   = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState('');

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // ─── Copied from web RegisterPage.jsx handleSubmit ─────────────────────────
  const handleSubmit = async () => {
    setError('');
    if (!form.name || !form.email || !form.mobile || !form.password || !form.secret_code) {
      setError('All fields are required.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await api.post('/auth/register', form);
      const { token, user } = response.data.data;
      await login(token, user);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
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

        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join FairAC and start tracking your AC usage fairly.</Text>

        <View style={styles.card}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️  {error}</Text>
            </View>
          ) : null}

          {[
            { field: 'name',        label: 'Full Name',           placeholder: 'Rahul Sharma',            keyboard: 'default' },
            { field: 'email',       label: 'Email Address',       placeholder: 'rahul@example.com',       keyboard: 'email-address' },
            { field: 'mobile',      label: 'Mobile Number',       placeholder: '9876543210',              keyboard: 'phone-pad' },
            { field: 'secret_code', label: 'Hostel Secret Code',  placeholder: 'SMJV-ADB-G',             keyboard: 'default' },
          ].map(({ field, label, placeholder, keyboard }) => (
            <View key={field}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                style={styles.input}
                placeholder={placeholder}
                placeholderTextColor={colors.textMuted}
                value={form[field]}
                onChangeText={v => update(field, v)}
                keyboardType={keyboard}
                autoCapitalize={field === 'secret_code' ? 'characters' : 'none'}
              />
            </View>
          ))}

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Create a strong password"
              placeholderTextColor={colors.textMuted}
              value={form.password}
              onChangeText={v => update('password', v)}
              secureTextEntry={!showPass}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(!showPass)}>
              <Text style={styles.eyeIcon}>{showPass ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btnPrimary, isLoading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnPrimaryText}>Create Account</Text>
            }
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.loginLink}>Already have an account? <Text style={{ color: colors.purple }}>Log In</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.background },
  scroll:      { flexGrow: 1, padding: 24, paddingTop: 60 },
  back:        { marginBottom: 24 },
  backText:    { color: colors.purple, fontSize: 16 },
  title:       { color: colors.textPrimary, fontSize: 28, fontWeight: '700', marginBottom: 8 },
  subtitle:    { color: colors.textSecondary, fontSize: 15, marginBottom: 32 },
  card:        { backgroundColor: colors.backgroundCard, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 24, marginBottom: 24 },
  errorBox:    { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, padding: 12, marginBottom: 16 },
  errorText:   { color: colors.error, fontSize: 14 },
  label:       { color: colors.textSecondary, fontSize: 13, fontWeight: '500', marginBottom: 8, marginTop: 4 },
  input:       { backgroundColor: colors.backgroundInput, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, color: colors.textPrimary, fontSize: 15, marginBottom: 16 },
  inputRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  eyeBtn:      { padding: 14, backgroundColor: colors.backgroundInput, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  eyeIcon:     { fontSize: 18 },
  btnPrimary:  { backgroundColor: colors.purple, borderRadius: 50, padding: 16, alignItems: 'center', marginTop: 8 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loginLink:   { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
});

export default RegisterScreen;
