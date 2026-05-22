import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
const MaterialIcons = require('@expo/vector-icons').MaterialIcons;

export type SystemFeedbackVariant = 'success' | 'error';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  variant: SystemFeedbackVariant;
  dismissLabel?: string;
  onDismiss: () => void;
};

export function SystemFeedbackModal({
  visible,
  title,
  message,
  variant,
  dismissLabel = 'Đã hiểu',
  onDismiss,
}: Props) {
  const isSuccess = variant === 'success';
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, isSuccess ? styles.iconSuccess : styles.iconError]}>
            <MaterialIcons
              name={isSuccess ? 'check-circle' : 'error-outline'}
              size={26}
              color={isSuccess ? '#15803d' : '#b91c1c'}
            />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <Pressable style={styles.btnWrap} onPress={onDismiss}>
            <LinearGradient
              colors={isSuccess ? ['#1976d2', '#42a5f5'] : ['#dc2626', '#ef4444']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.btn}
            >
              <Text style={styles.btnText}>{dismissLabel}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  iconSuccess: { backgroundColor: '#dcfce7' },
  iconError: { backgroundColor: '#fee2e2' },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
    textAlign: 'center',
  },
  btnWrap: {
    width: '100%',
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  btn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
