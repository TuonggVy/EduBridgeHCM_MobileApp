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
            Đăng ký tài khoản Phụ huynh{'\n'}kết nối tư vấn tuyển sinh lớp 10
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
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
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
  googleButton: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
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
    marginTop: 24,
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
