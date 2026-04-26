import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  FlatList,
  ActivityIndicator,
} from 'react-native';
const MaterialIcons = require('@expo/vector-icons').MaterialIcons;
import { SchoolCard } from '../components/SchoolCard';
import type { SchoolSummary } from '../types/school';

const sp = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 } as const;
const radius = { md: 12, xl: 20, full: 9999 } as const;

const HEADER_TOP =
  Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight ?? 24) + 8;

const RESULT_PAGE_SIZE = 10;

type SearchScreenProps = {
  onClose: () => void;
  schools: SchoolSummary[];
  recentSearches: string[];
  favouriteMap?: Record<number, boolean>;
  onSelectSchool?: (schoolId: number) => void;
  onToggleFavourite?: (schoolId: number) => void;
  onClearRecent?: () => void;
  onAddRecent?: (term: string) => void;
};

export default function SearchScreen({
  onClose,
  schools,
  recentSearches,
  favouriteMap,
  onSelectSchool,
  onToggleFavourite,
  onClearRecent,
  onAddRecent,
}: SearchScreenProps) {
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(RESULT_PAGE_SIZE);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return schools.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q)
    );
  }, [query, schools]);

  useEffect(() => {
    setVisibleCount(RESULT_PAGE_SIZE);
  }, [query]);

  const displayedResults = useMemo(
    () => results.slice(0, visibleCount),
    [results, visibleCount]
  );

  const loadMoreResults = useCallback(() => {
    if (visibleCount >= results.length) return;
    setVisibleCount((c) => Math.min(c + RESULT_PAGE_SIZE, results.length));
  }, [results.length, visibleCount]);

  const showRecentAndSuggested = !query.trim();
  const suggestedSchools = schools.slice(0, 3);

  const renderSchoolCard = (school: SchoolSummary) => (
    <SchoolCard
      name={school.name}
      description={school.description}
      imageUrl={school.logoUrl}
      rating={school.averageRating}
      totalCampus={school.totalCampus}
      isFavourite={favouriteMap?.[school.id] ?? school.isFavourite}
      onToggleFavourite={() => onToggleFavourite?.(school.id)}
      onPress={() => {
        onAddRecent?.(school.name);
        onSelectSchool?.(school.id);
      }}
    />
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: HEADER_TOP }]}>
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <MaterialIcons name="search" size={20} color="#64748b" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm trường, địa điểm..."
              placeholderTextColor="#94a3b8"
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8} style={styles.searchClear}>
                <MaterialIcons name="cancel" size={20} color="#94a3b8" />
              </Pressable>
            ) : null}
          </View>
          <Pressable onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Huỷ</Text>
          </Pressable>
        </View>
      </View>

      {showRecentAndSuggested ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {recentSearches.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Tìm gần đây</Text>
                <Pressable onPress={onClearRecent} hitSlop={8}>
                  <Text style={styles.sectionAction}>Xoá</Text>
                </Pressable>
              </View>
              <View style={styles.recentList}>
                {recentSearches.map((term) => (
                  <Pressable
                    key={term}
                    style={styles.recentItem}
                    onPress={() => {
                      setQuery(term);
                    }}
                  >
                    <MaterialIcons name="schedule" size={18} color="#94a3b8" />
                    <Text style={styles.recentText}>{term}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gợi ý cho bạn</Text>
            <View style={styles.schoolList}>
              {suggestedSchools.map((school) => (
                <View key={school.id}>{renderSchoolCard(school)}</View>
              ))}
            </View>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          data={displayedResults}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <View style={styles.cardGap}>{renderSchoolCard(item)}</View>}
          ListHeaderComponent={
            <Text style={styles.sectionTitle}>
              {results.length > 0 ? `Kết quả (${results.length})` : 'Không tìm thấy trường'}
            </Text>
          }
          ListFooterComponent={
            visibleCount < results.length ? (
              <ActivityIndicator style={styles.footerLoader} color="#1976d2" />
            ) : null
          }
          onEndReached={loadMoreResults}
          onEndReachedThreshold={0.35}
          showsVerticalScrollIndicator={false}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: sp.md,
    paddingBottom: sp.md,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: radius.full,
    paddingHorizontal: sp.md,
    height: 44,
  },
  searchIcon: {
    marginRight: sp.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    paddingVertical: 0,
  },
  searchClear: {
    padding: sp.xxs,
  },
  cancelBtn: {
    paddingVertical: sp.xs,
    paddingHorizontal: sp.xs,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: sp.lg,
    paddingBottom: sp.xxl,
  },
  section: {
    marginBottom: sp.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sp.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: sp.md,
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  recentList: {
    gap: sp.xxs,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    paddingVertical: sp.sm,
    paddingHorizontal: sp.sm,
    backgroundColor: '#fff',
    borderRadius: radius.md,
  },
  recentText: {
    fontSize: 15,
    color: '#334155',
  },
  schoolList: {
    gap: sp.md,
  },
  cardGap: {
    marginBottom: sp.md,
  },
  footerLoader: {
    marginVertical: sp.md,
  },
});
