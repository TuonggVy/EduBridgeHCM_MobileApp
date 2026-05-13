import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
const Ionicons = require('@expo/vector-icons').Ionicons;

const SPRING = { damping: 22, stiffness: 220, mass: 0.85 } as const;
const DISMISS_Y = 130;
const SHEET_HEIGHT = 300;

type ImageViewerModalProps = {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
};

function triggerHaptic(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) {
  void Haptics.impactAsync(style);
}

function guessExtension(u: string): string {
  const path = u.split('?')[0] ?? u;
  const m = path.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  return m ? m[1].toLowerCase() : 'jpg';
}

export function ImageViewerModal({ visible, uri, onClose }: ImageViewerModalProps) {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = Dimensions.get('window');

  const [showChrome, setShowChrome] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadKey, setLoadKey] = useState(0);

  const backdropOpacity = useSharedValue(0);
  const enterScale = useSharedValue(0.92);
  const enterOpacity = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const sheetY = useSharedValue(SHEET_HEIGHT);

  const maxImgW = useMemo(() => Math.min(W - 24, W * 0.94), [W]);
  const maxImgH = useMemo(() => H * 0.72, [H]);
  /** Khung cố định — % width trên cha không có width sẽ co 0, ảnh không hiện. */
  const imageBox = useMemo(
    () => ({ width: maxImgW, height: maxImgH }),
    [maxImgW, maxImgH]
  );

  const resetTransforms = useCallback(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTx.value = 0;
    savedTy.value = 0;
  }, [savedScale, savedTx, savedTy, scale, translateX, translateY]);

  const closeAll = useCallback(() => {
    setSheetOpen(false);
    setShowChrome(true);
    setLoading(true);
    resetTransforms();
    onClose();
  }, [onClose, resetTransforms]);

  useEffect(() => {
    if (visible && uri) {
      setLoading(true);
      setLoadProgress(0);
      setLoadKey((k) => k + 1);
      setShowChrome(true);
      setSheetOpen(false);
      resetTransforms();
      backdropOpacity.value = withTiming(1, { duration: 280 });
      enterOpacity.value = withTiming(1, { duration: 320 });
      enterScale.value = withSpring(1, SPRING);
    } else if (!visible) {
      backdropOpacity.value = withTiming(0, { duration: 220 });
      enterOpacity.value = withTiming(0, { duration: 180 });
      enterScale.value = 0.92;
      sheetY.value = SHEET_HEIGHT;
    }
  }, [visible, uri, backdropOpacity, enterOpacity, enterScale, resetTransforms, sheetY]);

  useEffect(() => {
    sheetY.value = withSpring(sheetOpen ? 0 : SHEET_HEIGHT, SPRING);
  }, [sheetOpen, sheetY]);

  const toggleChrome = useCallback(() => {
    setShowChrome((c) => !c);
  }, []);

  const dismissSheet = useCallback(() => setSheetOpen(false), []);

  const onLongPressImage = useCallback(() => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setSheetOpen(true);
  }, []);

  const downloadImage = useCallback(async () => {
    if (!uri) return;
    dismissSheet();
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Quyền truy cập', 'Cần quyền lưu ảnh vào thư viện để tải xuống.');
        return;
      }
      const baseDir = FileSystem.cacheDirectory;
      if (!baseDir) {
        Alert.alert('Lỗi', 'Không có thư mục cache để tải ảnh.');
        return;
      }
      const ext = guessExtension(uri);
      const dest = `${baseDir}edubridge-chat-${Date.now()}.${ext}`;
      const res = await FileSystem.downloadAsync(uri, dest);
      await MediaLibrary.saveToLibraryAsync(res.uri);
      triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert('Đã lưu', 'Ảnh đã được lưu vào thư viện.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không tải được ảnh';
      Alert.alert('Lỗi', msg);
    }
  }, [dismissSheet, uri]);

  const shareImage = useCallback(async () => {
    if (!uri) return;
    dismissSheet();
    try {
      const baseDir = FileSystem.cacheDirectory;
      if (baseDir && (await Sharing.isAvailableAsync())) {
        const ext = guessExtension(uri);
        const dest = `${baseDir}edubridge-share-${Date.now()}.${ext}`;
        const res = await FileSystem.downloadAsync(uri, dest);
        await Sharing.shareAsync(res.uri, {
          mimeType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          dialogTitle: 'Chia sẻ ảnh',
        });
      } else {
        await Share.share({ url: uri, message: uri });
      }
      triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      try {
        await Share.share({ url: uri, message: uri });
      } catch {
        Alert.alert('Lỗi', 'Không thể chia sẻ ảnh.');
      }
    }
  }, [dismissSheet, uri]);

  const openInBrowser = useCallback(() => {
    if (!uri) return;
    dismissSheet();
    void Linking.openURL(uri);
  }, [dismissSheet, uri]);

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onUpdate((e) => {
          scale.value = clamp(savedScale.value * e.scale, 1, 4);
        })
        .onEnd(() => {
          savedScale.value = scale.value;
          if (scale.value < 1.02) {
            scale.value = withSpring(1, SPRING);
            savedScale.value = 1;
            translateX.value = withSpring(0, SPRING);
            translateY.value = withSpring(0, SPRING);
            savedTx.value = 0;
            savedTy.value = 0;
          }
        }),
    [savedScale, scale, translateX, translateY, savedTx, savedTy]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((e) => {
          if (savedScale.value > 1.02) {
            translateX.value = savedTx.value + e.translationX;
            translateY.value = savedTy.value + e.translationY;
          } else {
            translateY.value = e.translationY * 0.62;
            translateX.value = 0;
          }
        })
        .onEnd((e) => {
          if (savedScale.value > 1.02) {
            savedTx.value = translateX.value;
            savedTy.value = translateY.value;
          } else {
            const shouldClose =
              translateY.value > DISMISS_Y || (e.velocityY > 1100 && translateY.value > 40);
            if (shouldClose) {
              runOnJS(closeAll)();
            }
            translateY.value = withSpring(0, SPRING);
            savedTy.value = 0;
            translateX.value = withSpring(0, SPRING);
            savedTx.value = 0;
          }
        }),
    [closeAll, savedScale, savedTx, savedTy, translateX, translateY]
  );

  const zoomPan = useMemo(() => Gesture.Simultaneous(pinch, pan), [pinch, pan]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value * 0.94,
  }));

  const imageWrapperStyle = useAnimatedStyle(() => ({
    opacity: enterOpacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value * enterScale.value },
    ],
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));

  if (!uri) return null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={closeAll}>
      <GestureHandlerRootView style={styles.flex}>
        <Animated.View style={[styles.fill, backdropStyle]}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={58} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.androidDim]} />
          )}
        </Animated.View>

        <GestureDetector gesture={zoomPan}>
          <Animated.View
            pointerEvents="box-none"
            style={[styles.gestureLayer, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}
          >
            <Animated.View
              style={[
                styles.imageShell,
                imageBox,
                imageWrapperStyle,
              ]}
            >
              <Pressable
                onPress={toggleChrome}
                onLongPress={onLongPressImage}
                delayLongPress={480}
                style={[styles.pressFill, imageBox]}
              >
                <Image
                  key={`${uri}-${loadKey}`}
                  source={{ uri }}
                  style={[styles.expoImage, imageBox]}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  transition={280}
                  onLoadStart={() => {
                    setLoading(true);
                    setLoadProgress(0);
                  }}
                  onLoad={() => {
                    setLoading(false);
                    setLoadProgress(1);
                  }}
                  onError={() => {
                    setLoading(false);
                    setLoadProgress(0);
                  }}
                  onProgress={({ loaded, total }) => {
                    if (total > 0) setLoadProgress(Math.min(1, loaded / total));
                  }}
                />
                {loading ? (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.loadingHint}>Đang tải ảnh…</Text>
                    {loadProgress > 0 && loadProgress < 1 ? (
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${Math.round(loadProgress * 100)}%` }]} />
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </Pressable>
            </Animated.View>
          </Animated.View>
        </GestureDetector>

        {showChrome ? (
          <View
            pointerEvents="box-none"
            style={[StyleSheet.absoluteFill, styles.chromeLayer, { paddingTop: insets.top }]}
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.78)', 'rgba(0,0,0,0.38)', 'transparent']}
              locations={[0, 0.5, 1]}
              style={[styles.topGradient, { paddingHorizontal: 12 }]}
            >
              <View style={styles.topBarRow}>
                <Pressable
                  onPress={closeAll}
                  style={({ pressed }) => [styles.iconCircle, pressed && styles.pressed]}
                  hitSlop={12}
                  accessibilityLabel="Đóng"
                >
                  <Ionicons name="close" size={26} color="#fff" />
                </Pressable>
                <View style={styles.topBarSpacer} />
                <Pressable
                  onPress={() => void Linking.openURL(uri)}
                  style={({ pressed }) => [styles.iconCircle, pressed && styles.pressed]}
                  hitSlop={12}
                  accessibilityLabel="Mở liên kết"
                >
                  <Ionicons name="open-outline" size={22} color="#fff" />
                </Pressable>
                <Pressable
                  onPress={() => void shareImage()}
                  style={({ pressed }) => [styles.iconCircle, pressed && styles.pressed]}
                  hitSlop={12}
                  accessibilityLabel="Chia sẻ"
                >
                  <Ionicons name="share-outline" size={22} color="#fff" />
                </Pressable>
              </View>
            </LinearGradient>
          </View>
        ) : null}

        {sheetOpen ? (
          <Pressable style={[styles.sheetDim, styles.sheetLayer]} onPress={dismissSheet}>
            <Animated.View style={[styles.sheetWrap, { paddingBottom: insets.bottom + 12 }, sheetStyle]}>
              <Pressable onPress={(e) => e.stopPropagation()}>
                <BlurView intensity={Platform.OS === 'ios' ? 85 : 0} tint="dark" style={styles.sheetCard}>
                  {Platform.OS === 'android' ? <View style={styles.sheetAndroidBg} /> : null}
                  <View style={styles.sheetHandle} />
                  <Text style={styles.sheetTitle}>ẢNH</Text>
                  <Pressable
                    style={({ pressed }) => [styles.sheetRow, pressed && styles.pressed]}
                    onPress={() => void downloadImage()}
                  >
                    <Ionicons name="download-outline" size={22} color="#e2e8f0" />
                    <Text style={styles.sheetRowLabel}>Tải ảnh xuống</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.sheetRow, pressed && styles.pressed]}
                    onPress={() => void shareImage()}
                  >
                    <Ionicons name="share-social-outline" size={22} color="#e2e8f0" />
                    <Text style={styles.sheetRowLabel}>Chia sẻ ảnh</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.sheetRow, pressed && styles.pressed]}
                    onPress={openInBrowser}
                  >
                    <Ionicons name="globe-outline" size={22} color="#e2e8f0" />
                    <Text style={styles.sheetRowLabel}>Mở bằng trình duyệt</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.sheetCancel, pressed && styles.pressed]}
                    onPress={dismissSheet}
                  >
                    <Text style={styles.sheetCancelTxt}>Huỷ</Text>
                  </Pressable>
                </BlurView>
              </Pressable>
            </Animated.View>
          </Pressable>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { ...StyleSheet.absoluteFillObject },
  androidDim: { backgroundColor: 'rgba(5,8,15,0.94)' },
  gestureLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chromeLayer: { zIndex: 8 },
  sheetLayer: { zIndex: 20 },
  imageShell: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pressFill: { alignItems: 'center', justifyContent: 'center' },
  expoImage: {
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  loadingHint: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
  },
  progressTrack: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: 'rgba(96,165,250,0.95)',
  },
  topGradient: {
    paddingBottom: 28,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topBarSpacer: { flex: 1 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.82 },
  sheetDim: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetWrap: {
    paddingHorizontal: 12,
  },
  sheetCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  sheetAndroidBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18,22,32,0.98)',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginTop: 10,
    marginBottom: 8,
  },
  sheetTitle: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.42)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  sheetRowLabel: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '600',
  },
  sheetCancel: {
    paddingVertical: 16,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    marginTop: 2,
  },
  sheetCancelTxt: {
    color: 'rgba(248,250,252,0.78)',
    fontSize: 16,
    fontWeight: '700',
  },
});
