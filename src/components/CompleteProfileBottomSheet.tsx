import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
const Ionicons = require('@expo/vector-icons').Ionicons;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type CompleteProfileBottomSheetProps = {
  visible: boolean;
  onComplete: () => void;
  onDismiss: () => void;
};

export function CompleteProfileBottomSheet({
  visible,
  onComplete,
  onDismiss,
}: CompleteProfileBottomSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetWrap}>
              <LinearGradient
                colors={['#e8f4fd', '#f0f9ff', '#ffffff']}
                style={styles.sheet}
              >
                {/* Drag indicator */}
                <View style={styles.dragBar} />

                {/* Illustration: family / education */}
                <View style={styles.iconWrap}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="people" size={44} color="#1976d2" />
                  </View>
                </View>

                <Text style={styles.title}>Hoàn thiện hồ sơ Phụ Huynh</Text>
                <Text style={styles.description}>
                  Hãy hoàn thiện hồ sơ của bạn để được tư vấn tốt hơn.
                </Text>

                <Pressable
                  onPress={onComplete}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.primaryButtonPressed,
                  ]}
                >
                  <LinearGradient
                    colors={['#1976d2', '#42a5f5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryButtonGradient}
                  >
                    <Text style={styles.primaryButtonText}>Bây giờ</Text>
                  </LinearGradient>
                </Pressable>

                <Pressable
                  onPress={onDismiss}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.secondaryButtonPressed,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>Để sau</Text>
                </Pressable>
              </LinearGradient>
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    width: SCREEN_WIDTH,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  sheet: {
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    minHeight: 320,
  },
  dragBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginBottom: 24,
  },
  iconWrap: {
    marginBottom: 20,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(25, 118, 210, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  primaryButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    minHeight: 52,
    justifyContent: 'center',
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButton: {
    width: '100%',
    borderRadius: 16,
    minHeight: 52,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d4e8fa',
  },
  secondaryButtonPressed: {
    opacity: 0.7,
  },
  secondaryButtonText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
});
