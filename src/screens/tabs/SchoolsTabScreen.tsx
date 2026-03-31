/**
 * Nội dung tab Trường. Header toàn app (tiêu đề / gradient) do `HomeScreen` render theo tab.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SchoolCard } from '../../components/SchoolCard';
import type { SchoolSummary } from '../../types/school';
import { MaterialIcons, sp, radius } from './tabConstants';

type SchoolFilter = 'all' | 'topRated' | 'international' | 'nearby' | 'saved';

const SCHOOL_FILTER_OPTIONS: { id: SchoolFilter; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'topRated', label: 'Đánh giá cao' },
  { id: 'international', label: 'Chương trình quốc tế' },
  { id: 'nearby', label: 'Gần bạn' },
  { id: 'saved', label: 'Đã lưu' },
];

const SCHOOL_LIST_PAGE_SIZE = 10;

export type SchoolsTabScreenProps = {
  schools: SchoolSummary[];
  loading: boolean;
  refreshing: boolean;
  errorMessage: string | null;
  onRefresh: () => void;
  onRetry: () => void;
  onOpenSchool: (schoolId: number) => void;
  onToggleFavourite: (schoolId: number) => void;
};

export function SchoolsTabScreen({
  schools,
  loading,
  refreshing,
  errorMessage,
  onRefresh,
  onRetry,
  onOpenSchool,
  onToggleFavourite,
}: SchoolsTabScreenProps) {
  const [activeFilter, setActiveFilter] = useState<SchoolFilter>('all');
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(SCHOOL_LIST_PAGE_SIZE);

  const filteredSchools = useMemo(() => {
    return schools.filter((school) => {
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        school.name.toLowerCase().includes(q) ||
        (school.description ?? '').toLowerCase().includes(q);
      if (!matchesQuery) return false;

      if (activeFilter === 'saved') return school.isFavourite;
      if (activeFilter === 'topRated')
        return typeof school.averageRating === 'number' && school.averageRating >= 4;
      if (activeFilter === 'international') {
        const d = (school.description ?? '').toLowerCase();
        return d.includes('quốc tế') || d.includes('quoc te') || d.includes('international');
      }
      return true;
    });
  }, [schools, query, activeFilter]);

  useEffect(() => {
    setVisibleCount(SCHOOL_LIST_PAGE_SIZE);
  }, [activeFilter, query, schools]);

  const displayedSchools = useMemo(
    () => filteredSchools.slice(0, visibleCount),
    [filteredSchools, visibleCount]
  );

  const loadMore = useCallback(() => {
    if (visibleCount >= filteredSchools.length) return;
    setVisibleCount((c) => Math.min(c + SCHOOL_LIST_PAGE_SIZE, filteredSchools.length));
  }, [filteredSchools.length, visibleCount]);

  const showList = !((loading && schools.length === 0) || (errorMessage && !loading));

  const renderFallbackBody = () => {
    if (loading && schools.length === 0) {
      return (
        <View style={styles.schoolList}>
          {[1, 2, 3].map((item) => (
            <View key={item} style={styles.skeletonCard} />
          ))}
        </View>
      );
    }
    if (errorMessage && !loading) {
      return (
        <View style={styles.placeholder}>
          <MaterialIcons name="cloud-off" size={48} color="#cbd5e1" />
          <Text style={styles.placeholderText}>Không thể tải danh sách trường</Text>
          <Pressable onPress={onRetry}>
            <Text style={styles.sectionLink}>Thử lại</Text>
          </Pressable>
        </View>
      );
    }
    return null;
  };

  const renderListEmpty = () => {
    if (!loading && !errorMessage && filteredSchools.length === 0) {
      return (
        <View style={styles.placeholder}>
          <MaterialIcons name="search" size={48} color="#cbd5e1" />
          <Text style={styles.placeholderText}>Không tìm thấy trường phù hợp</Text>
          <Pressable onPress={() => setQuery('')}>
            <Text style={styles.sectionLink}>Thử lại</Text>
          </Pressable>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.screen}>
      <View style={styles.stickyHeader}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
          style={styles.filterScrollView}
        >
          {SCHOOL_FILTER_OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => setActiveFilter(option.id)}
              style={[
                styles.filterChip,
                activeFilter === option.id && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === option.id && styles.filterChipTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.inlineSearchWrap}>
          <MaterialIcons name="search" size={20} color="#94a3b8" />
          <TextInput
            style={styles.inlineSearchInputText}
            placeholder="Tìm trường theo tên..."
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} style={styles.searchClearBtn}>
              <MaterialIcons name="close" size={20} color="#94a3b8" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {showList ? (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={displayedSchools}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.schoolCardGap}>
              <SchoolCard
                name={item.name}
                description={item.description}
                imageUrl={item.logoUrl}
                rating={item.averageRating}
                totalCampus={item.totalCampus}
                representativeName={item.representativeName}
                isFavourite={item.isFavourite}
                onToggleFavourite={() => onToggleFavourite(item.id)}
                onPress={() => onOpenSchool(item.id)}
              />
            </View>
          )}
          ListEmptyComponent={renderListEmpty}
          ListFooterComponent={
            visibleCount < filteredSchools.length ? (
              <ActivityIndicator style={styles.schoolListFooterLoader} color="#1976d2" />
            ) : null
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1976d2" />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.35}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <ScrollView
          style={styles.fallbackScroll}
          contentContainerStyle={styles.fallbackContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1976d2" />
          }
          keyboardShouldPersistTaps="handled"
        >
          {renderFallbackBody()}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  stickyHeader: {
    paddingHorizontal: sp.lg,
    paddingTop: sp.lg,
    paddingBottom: sp.sm,
    backgroundColor: '#f8fafc',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: sp.lg,
    paddingTop: sp.md,
    paddingBottom: 100,
    flexGrow: 1,
  },
  fallbackScroll: {
    flex: 1,
  },
  fallbackContent: {
    paddingHorizontal: sp.lg,
    paddingTop: sp.md,
    paddingBottom: 100,
    flexGrow: 1,
  },
  schoolCardGap: {
    marginBottom: sp.md,
  },
  schoolListFooterLoader: {
    marginVertical: sp.md,
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
  filterScrollView: {
    marginHorizontal: -sp.lg,
    marginBottom: sp.md,
  },
  filterScroll: {
    paddingHorizontal: sp.lg,
    flexDirection: 'row',
    gap: sp.xs,
  },
  inlineSearchWrap: {
    marginBottom: 0,
    backgroundColor: '#fff',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 44,
    paddingHorizontal: sp.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
  },
  inlineSearchInputText: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
  },
  searchClearBtn: {
    padding: sp.xxs,
  },
  filterChip: {
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    borderRadius: radius.full,
    backgroundColor: '#fff',
    marginRight: sp.xs,
  },
  filterChipActive: {
    backgroundColor: '#1976d2',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  schoolList: {
    gap: sp.md,
  },
  skeletonCard: {
    backgroundColor: '#e2e8f0',
    height: 170,
    borderRadius: radius.xl,
  },
  placeholder: {
    alignItems: 'center',
    paddingVertical: sp.xxxl,
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748b',
    marginTop: sp.md,
  },
});
