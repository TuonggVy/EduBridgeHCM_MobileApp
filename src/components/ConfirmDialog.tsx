import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MAX_WIDTH = 320;
const CARD_MARGIN = 24;

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  cancelLabel?: string;
  confirmLabel: string;
  confirmRole?: 'destructive' | 'default';
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  cancelLabel = 'Hủy',
  confirmLabel,
  confirmRole = 'default',
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>

              <View style={styles.actions}>
                <Pressable
                  onPress={onCancel}
                  style={({ pressed }) => [
                    styles.button,
                    styles.cancelButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
                </Pressable>

                <Pressable
                  onPress={onConfirm}
                  style={({ pressed }) => [
                    styles.button,
                    confirmRole === 'destructive'
                      ? styles.destructiveButton
                      : styles.confirmButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.confirmButtonText,
                      confirmRole === 'destructive' && styles.destructiveButtonText,
                    ]}
                  >
                    {confirmLabel}
                  </Text>
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: CARD_MARGIN,
  },
  card: {
    width: '100%',
    maxWidth: CARD_MAX_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 15,
    fontWeight: '400',
    color: '#64748b',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  cancelButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  confirmButton: {
    backgroundColor: '#1976d2',
  },
  destructiveButton: {
    backgroundColor: '#dc2626',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  destructiveButtonText: {
    color: '#ffffff',
  },
});
