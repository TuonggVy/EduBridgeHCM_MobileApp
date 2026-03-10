import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { loginWithGoogle, isLoading, error, clearError } = useAuth();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <Image
            source={require('../../assets/LogoEdu2-removebg-preview.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>EduBridge HCM</Text>
        <Text style={styles.subtitle}>
          Kết nối tư vấn tuyển sinh lớp 10{'\n'}trường THPT tư thục tại TP.HCM
        </Text>

        {error ? (
          <Pressable style={styles.errorCard} onPress={clearError}>
            <Text style={styles.errorText}>{error}</Text>
          </Pressable>
        ) : null}

        <View style={styles.actions}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#1976d2" />
          ) : (
            <View style={styles.buttonWrap}>
              <GoogleSigninButton
                size={GoogleSigninButton.Size.Wide}
                color={GoogleSigninButton.Color.Dark}
                onPress={loginWithGoogle}
                style={styles.googleButton}
              />
            </View>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 340,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  logoWrap: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  errorCard: {
    width: '100%',
    backgroundColor: '#fef2f2',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonWrap: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  googleButton: {
    width: '100%',
    height: 52,
  },
});
