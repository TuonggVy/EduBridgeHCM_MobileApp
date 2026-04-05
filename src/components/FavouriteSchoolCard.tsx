import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
const MaterialIcons = require('@expo/vector-icons').MaterialIcons;
import type { FavouriteSchoolItem } from '../types/school';

function foundingYearFromDate(iso: string | null): string | null {
  if (!iso) return null;
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) ? String(y) : null;
}

type FavouriteSchoolCardProps = {
  item: FavouriteSchoolItem;
  onViewDetail: () => void;
  onRemoveHeart: () => void;
};

export function FavouriteSchoolCard({
  item,
  onViewDetail,
  onRemoveHeart,
}: FavouriteSchoolCardProps) {
  const year = foundingYearFromDate(item.foundingDate);

  return (
    <View style={styles.card}>
      <Pressable
        style={({ pressed }) => [styles.cardPressable, pressed && styles.cardPressed]}
        onPress={onViewDetail}
      >
        <View style={styles.contentRow}>
          <View style={styles.imageWrap}>
            {item.logoUrl ? (
              <Image source={{ uri: item.logoUrl }} style={styles.image} />
            ) : (
              <MaterialIcons name="school" size={28} color="#94a3b8" />
            )}
          </View>
          <View style={styles.body}>
            <Text style={styles.name} numberOfLines={2}>
              {item.name}
            </Text>
            {item.description ? (
              <Text style={styles.description} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              <MaterialIcons name="business" size={14} color="#64748b" />
              <Text style={styles.metaText}>
                {item.totalCampus === 1 ? '1 cơ sở' : `${item.totalCampus} cơ sở`}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <MaterialIcons name="star" size={14} color="#f59e0b" />
              <Text style={styles.metaText}>
                {typeof item.averageRating === 'number'
                  ? item.averageRating.toFixed(1)
                  : 'Chưa có đánh giá'}
              </Text>
            </View>
            {year ? (
              <View style={styles.metaRow}>
                <MaterialIcons name="event" size={14} color="#64748b" />
                <Text style={styles.metaText}>Thành lập {year}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>

      <View style={styles.actionsTop} pointerEvents="box-none">
        <Pressable onPress={onRemoveHeart} hitSlop={12} style={styles.iconBtn}>
          <MaterialIcons name="favorite" size={20} color="#ef4444" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 16,
  },
  cardPressable: {
    borderRadius: 16,
  },
  cardPressed: {
    opacity: 0.97,
  },
  actionsTop: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    paddingTop: 48,
    gap: 14,
  },
  imageWrap: {
    width: 72,
    height: 72,
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
    gap: 6,
    marginTop: 5,
  },
  metaText: {
    fontSize: 13,
    color: '#64748b',
    flex: 1,
  },
});
