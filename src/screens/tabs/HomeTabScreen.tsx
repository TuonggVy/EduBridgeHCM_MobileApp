import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
} from 'react-native';
import { SchoolCard } from '../../components/SchoolCard';
import type { SchoolSummary } from '../../types/school';
import { FEATURED_CARD_WIDTH, MaterialIcons, sp, radius } from './tabConstants';

const BANNER_IMAGE = require('../../../assets/Banner.png');

const QUICK_ACTIONS: { id: string; label: string; icon: string }[] = [
  { id: 'profile', label: 'Hồ sơ', icon: 'description' },
  { id: 'consult', label: 'Tư vấn', icon: 'chat-bubble-outline' },
  { id: 'news', label: 'Tin tức', icon: 'article' },
  { id: 'contact', label: 'Liên hệ', icon: 'call' },
];

export type HomeTabScreenProps = {
  schools: SchoolSummary[];
  onOpenSearch: () => void;
  onOpenSchool: (schoolId: number) => void;
  onToggleFavourite: (schoolId: number) => void;
  onOpenConsult: () => void;
  onOpenNews: () => void;
};

export function HomeTabScreen({
  schools,
  onOpenSearch,
  onOpenSchool,
  onToggleFavourite,
  onOpenConsult,
  onOpenNews,
}: HomeTabScreenProps) {
  const featuredSchools = schools.slice(0, 3);

  return (
    <>
      <Pressable style={({ pressed }) => [styles.bannerCard, pressed && styles.bannerPressed]}>
        <Image source={BANNER_IMAGE} style={styles.bannerImage} resizeMode="cover" />
      </Pressable>

      <View style={styles.quickActions}>
        {QUICK_ACTIONS.map((action) => (
          <Pressable
            key={action.id}
            onPress={() => {
              if (action.id === 'consult') onOpenConsult();
              if (action.id === 'news') onOpenNews();
            }}
            style={({ pressed }) => [
              styles.quickActionItem,
              pressed && styles.quickActionPressed,
            ]}
          >
            <View style={styles.quickActionIconWrap}>
              <MaterialIcons name={action.icon as any} size={24} color="#1976d2" />
            </View>
            <Text style={styles.quickActionLabel}>{action.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Trường nổi bật</Text>
          <Pressable hitSlop={sp.sm} onPress={onOpenSearch}>
            <Text style={styles.sectionLink}>Xem tất cả</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.featuredScroll}
          style={styles.featuredScrollView}
        >
          {featuredSchools.map((school) => (
            <View key={school.id} style={[styles.featuredCardWrap, { width: FEATURED_CARD_WIDTH }]}>
              <SchoolCard
                name={school.name}
                description={school.description}
                imageUrl={school.logoUrl}
                rating={school.averageRating}
                totalCampus={school.totalCampus}
                representativeName={school.representativeName}
                isFavourite={school.isFavourite}
                onToggleFavourite={() => onToggleFavourite(school.id)}
                onPress={() => onOpenSchool(school.id)}
              />
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Tin tức</Text>
          <Pressable hitSlop={sp.sm} onPress={onOpenNews}>
            <Text style={styles.sectionLink}>Xem tất cả</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={onOpenNews}
          style={({ pressed }) => [styles.newsCard, pressed && styles.newsCardPressed]}
        >
          <View style={styles.newsIconWrap}>
            <MaterialIcons name="article" size={28} color="#1976d2" />
          </View>
          <View style={styles.newsBody}>
            <Text style={styles.newsTitle}>Tin tức tuyển sinh</Text>
            <Text style={styles.newsSub} numberOfLines={2}>
              Cập nhật lịch tuyển sinh, hướng dẫn hồ sơ và thông tin hữu ích cho phụ huynh — sắp ra mắt.
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color="#cbd5e1" />
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  bannerCard: {
    width: '100%',
    minHeight: 160,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: sp.xl,
    backgroundColor: '#e0f2fe',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  bannerPressed: {
    opacity: 0.98,
  },
  bannerImage: {
    width: '100%',
    height: 160,
    borderRadius: radius.xl,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: sp.xl,
  },
  quickActionItem: {
    alignItems: 'center',
    flex: 1,
  },
  quickActionPressed: {
    opacity: 0.7,
  },
  quickActionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.xxl,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sp.xs,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  section: {
    marginBottom: sp.xl,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sp.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: sp.md,
    letterSpacing: -0.3,
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
  },
  featuredScrollView: {
    marginHorizontal: -sp.lg,
  },
  featuredScroll: {
    paddingHorizontal: sp.lg,
    gap: sp.xs,
    paddingBottom: sp.sm,
  },
  featuredCardWrap: {
    marginRight: sp.xs,
  },
  newsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    padding: sp.md,
    gap: sp.md,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  newsCardPressed: {
    opacity: 0.96,
  },
  newsIconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newsBody: {
    flex: 1,
  },
  newsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: sp.xxs,
  },
  newsSub: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
});
