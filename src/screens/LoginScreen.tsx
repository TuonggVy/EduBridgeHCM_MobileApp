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

export default function LoginScreen() {
  const { loginWithGoogle, isLoading, error, clearError } = useAuth();

  return (
    <LinearGradient
      colors={[...GRADIENT_COLORS]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
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
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.googleButton,
                pressed && styles.googleButtonPressed,
              ]}
              onPress={loginWithGoogle}
            >
              <View style={styles.googleButtonContent}>
                <View style={styles.googleLogoWrap}>
                  <Ionicons name="logo-google" size={22} color="#4285F4" />
                </View>
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </View>
            </Pressable>
          )}
        </View>
      </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
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
    color: '#fff',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.92)',
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
    backgroundColor: '#fff',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  googleButtonPressed: {
    opacity: 0.92,
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
    color: '#1f2937',
  },
});
