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
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';

const Ionicons = require('@expo/vector-icons').Ionicons;

const GRADIENT_COLORS = ['#1976d2', '#42a5f5', '#64b5f6'] as const;

type RegisterScreenProps = {
  onGoToLogin: () => void;
};

export default function RegisterScreen({ onGoToLogin }: RegisterScreenProps) {
  const { registerWithGoogle, isLoading, error, clearError } = useAuth();

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.content}>
            <View style={styles.logoWrap}>
              <Image
                source={require('../../assets/LogoEdu2-removebg-preview.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>Chào mừng đến EduBridge HCM</Text>
            <Text style={styles.subtitle}>
              Đăng ký tài khoản Phụ huynh để kết nối tư vấn tuyển sinh lớp 10
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
                <Pressable
                  style={({ pressed }) => [
                    styles.googleButton,
                    pressed && styles.googleButtonPressed,
                  ]}
                  onPress={registerWithGoogle}
                >
                  <LinearGradient
                    colors={[...GRADIENT_COLORS]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.googleButtonGradient}
                  >
                    <View style={styles.googleButtonContent}>
                      <View style={styles.googleLogoWrap}>
                        <Ionicons name="logo-google" size={22} color="#fff" />
                      </View>
                      <Text style={styles.googleButtonText}>
                        Sign up with Google
                      </Text>
                    </View>
                  </LinearGradient>
                </Pressable>
              )}
            </View>

            <Pressable style={styles.loginLink} onPress={onGoToLogin}>
              <Text style={styles.loginLinkText}>
                Đã có tài khoản?{' '}
                <Text style={styles.loginLinkHighlight}>Đăng nhập</Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 28,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  content: {
    alignItems: 'center',
  },
  logoWrap: {
    width: 88,
    height: 88,
    marginBottom: 20,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  errorCard: {
    width: '100%',
    backgroundColor: '#fef2f2',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
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
    marginBottom: 24,
  },
  googleButton: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  googleButtonPressed: {
    opacity: 0.92,
  },
  googleButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  googleLogoWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  loginLink: {
    paddingVertical: 8,
  },
  loginLinkText: {
    fontSize: 15,
    color: '#64748b',
  },
  loginLinkHighlight: {
    fontWeight: '600',
    color: '#1976d2',
  },
});
