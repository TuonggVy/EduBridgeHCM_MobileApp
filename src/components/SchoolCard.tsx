import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
const MaterialIcons = require('@expo/vector-icons').MaterialIcons;

const radius = { xl: 20 } as const;

type SchoolCardProps = {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  rating?: number | null;
  totalCampus?: number;
  representativeName?: string | null;
  isFavourite?: boolean;
  onToggleFavourite?: () => void;
  ctaLabel?: string;
  onPress: () => void;
};

export function SchoolCard({
  name,
  description,
  imageUrl,
  rating,
  totalCampus,
  representativeName,
  isFavourite,
  onToggleFavourite,
  ctaLabel = 'Xem chi tiết',
  onPress,
}: SchoolCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.favoriteWrap}>
        <Pressable onPress={onToggleFavourite} hitSlop={8} style={styles.favoriteBtn}>
          <MaterialIcons
            name={isFavourite ? 'favorite' : 'favorite-border'}
            size={18}
            color={isFavourite ? '#ef4444' : '#64748b'}
          />
        </Pressable>
      </View>
      <View style={styles.contentRow}>
        <View style={styles.imageWrap}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} />
          ) : (
            <MaterialIcons name="school" size={26} color="#94a3b8" />
          )}
        </View>
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          {description ? (
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <MaterialIcons name="star" size={14} color="#f59e0b" />
            <Text style={styles.metaText}>
              {typeof rating === 'number' ? rating.toFixed(1) : 'Chưa có đánh giá'}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <MaterialIcons name="business" size={14} color="#64748b" />
            <Text style={styles.metaText}>{`${totalCampus ?? 0} cơ sở`}</Text>
          </View>
          {representativeName ? (
            <View style={styles.metaRow}>
              <MaterialIcons name="person-outline" size={14} color="#64748b" />
              <Text style={styles.metaText} numberOfLines={1}>
                {representativeName}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.ctaText}>{ctaLabel}</Text>
        <MaterialIcons name="chevron-right" size={18} color="#2563eb" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.95,
  },
  favoriteWrap: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
  },
  favoriteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    gap: 12,
  },
  imageWrap: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  body: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 21,
  },
  description: {
    marginTop: 4,
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#64748b',
    flex: 1,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    height: 44,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  ctaText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '700',
  },
});
