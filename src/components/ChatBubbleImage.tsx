import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Animated,
  Image as RNImage,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

/** Kích thước gốc theo URL — tránh gọi getSize lặp lại khi scroll FlatList. */
const naturalSizeCache = new Map<string, { w: number; h: number }>();

function guessExtension(u: string): string {
  const path = u.split('?')[0] ?? u;
  const m = path.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  return m ? m[1].toLowerCase() : 'jpg';
}

/** Fit trong hộp maxW×maxH, giữ tỷ lệ (cảm giác contain, không crop). */
export function computeChatBubbleImageLayout(
  naturalW: number,
  naturalH: number,
  maxW: number,
  maxH: number
): { width: number; height: number } {
  if (!naturalW || !naturalH || naturalW <= 0 || naturalH <= 0) {
    return { width: maxW, height: Math.min(maxH, Math.round((maxW * 3) / 4)) };
  }
  const ratio = naturalW / naturalH;
  let w = maxW;
  let h = Math.round(w / ratio);
  if (h > maxH) {
    h = maxH;
    w = Math.round(h * ratio);
  }
  return { width: Math.max(1, w), height: Math.max(1, h) };
}

type ChatBubbleImageProps = {
  uri: string;
  isDark: boolean;
  maxWidth: number;
  maxHeight: number;
  /** Bubble chỉ ảnh — bo góc + shadow nổi khối. */
  standalone?: boolean;
  onRequestPreview: (previewUri: string) => void;
};

async function saveRemoteImageToLibrary(uri: string): Promise<void> {
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
  const dest = `${baseDir}edubridge-chat-inline-${Date.now()}.${ext}`;
  const res = await FileSystem.downloadAsync(uri, dest);
  await MediaLibrary.saveToLibraryAsync(res.uri);
}

async function shareRemoteImage(uri: string): Promise<void> {
  const baseDir = FileSystem.cacheDirectory;
  if (baseDir && (await Sharing.isAvailableAsync())) {
    const ext = guessExtension(uri);
    const dest = `${baseDir}edubridge-chat-inline-share-${Date.now()}.${ext}`;
    const res = await FileSystem.downloadAsync(uri, dest);
    await Sharing.shareAsync(res.uri, {
      mimeType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      dialogTitle: 'Chia sẻ ảnh',
    });
    return;
  }
  await Share.share({ url: uri, message: uri });
}

export const ChatBubbleImage = React.memo(function ChatBubbleImage({
  uri,
  isDark,
  maxWidth,
  maxHeight,
  standalone,
  onRequestPreview,
}: ChatBubbleImageProps) {
  const [layout, setLayout] = useState<{ width: number; height: number } | null>(() => {
    const n = naturalSizeCache.get(uri);
    return n ? computeChatBubbleImageLayout(n.w, n.h, maxWidth, maxHeight) : null;
  });
  const [imageLoaded, setImageLoaded] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const skelPulse = useRef(new Animated.Value(0.5)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    setImageLoaded(false);
    fade.setValue(0);
  }, [uri, fade]);

  useEffect(() => {
    let cancelled = false;
    const apply = (nw: number, nh: number) => {
      if (cancelled) return;
      setLayout(computeChatBubbleImageLayout(nw, nh, maxWidth, maxHeight));
    };
    const cached = naturalSizeCache.get(uri);
    if (cached) {
      apply(cached.w, cached.h);
      return () => {
        cancelled = true;
      };
    }
    setLayout(null);
    RNImage.getSize(
      uri,
      (w, h) => {
        if (cancelled) return;
        naturalSizeCache.set(uri, { w, h });
        apply(w, h);
      },
      () => {
        if (cancelled) return;
        apply(4, 3);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [uri, maxWidth, maxHeight]);

  useEffect(() => {
    if (imageLoaded) {
      pulseLoopRef.current?.stop();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(skelPulse, { toValue: 0.92, duration: 650, useNativeDriver: true }),
        Animated.timing(skelPulse, { toValue: 0.36, duration: 650, useNativeDriver: true }),
      ])
    );
    pulseLoopRef.current = loop;
    loop.start();
    return () => loop.stop();
  }, [imageLoaded, skelPulse]);

  const onExpoLoad = useCallback(() => {
    setImageLoaded(true);
    Animated.timing(fade, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [fade]);

  const runSave = useCallback(async () => {
    try {
      await saveRemoteImageToLibrary(uri);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert('Đã lưu', 'Ảnh đã được lưu vào thư viện.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không tải được ảnh';
      Alert.alert('Lỗi', msg);
    }
  }, [uri]);

  const runShare = useCallback(async () => {
    try {
      await shareRemoteImage(uri);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      try {
        await Share.share({ url: uri, message: uri });
      } catch {
        Alert.alert('Lỗi', 'Không thể chia sẻ ảnh.');
      }
    }
  }, [uri]);

  const onLongPress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Hủy', 'Lưu ảnh vào thư viện', 'Chia sẻ'],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) void runSave();
          else if (idx === 2) void runShare();
        }
      );
    } else {
      Alert.alert('Ảnh', undefined, [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Lưu ảnh', onPress: () => void runSave() },
        { text: 'Chia sẻ', onPress: () => void runShare() },
      ]);
    }
  }, [runSave, runShare]);

  const handlePreview = useCallback(() => {
    onRequestPreview(uri);
  }, [onRequestPreview, uri]);

  const placeholder = useMemo(
    () => ({
      width: maxWidth,
      height: Math.min(maxHeight, Math.round(maxWidth * 0.58)),
    }),
    [maxWidth, maxHeight]
  );

  const frame = layout ?? placeholder;

  const inner = (
    <Pressable
      onPress={handlePreview}
      onLongPress={onLongPress}
      accessibilityRole="image"
      accessibilityLabel="Ảnh trong chat. Nhấn để phóng to, giữ để lưu hoặc chia sẻ"
      style={({ pressed }) => [styles.press, { width: frame.width, opacity: pressed ? 0.9 : 1 }]}
    >
      <View
        style={[
          styles.frame,
          { width: frame.width, height: frame.height },
          isDark ? styles.frameDark : null,
        ]}
      >
        {layout ? (
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              recyclingKey={uri}
              transition={0}
              onLoad={onExpoLoad}
            />
          </Animated.View>
        ) : null}
        {!imageLoaded ? (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              styles.skeleton,
              isDark && styles.skeletonDark,
              { opacity: skelPulse },
            ]}
          />
        ) : null}
      </View>
    </Pressable>
  );

  return standalone ? <View style={styles.shadowHost}>{inner}</View> : inner;
});

const styles = StyleSheet.create({
  shadowHost: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  press: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  frame: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
  },
  frameDark: {
    backgroundColor: '#1e293b',
  },
  skeleton: {
    backgroundColor: '#cbd5e1',
  },
  skeletonDark: {
    backgroundColor: '#334155',
  },
});
