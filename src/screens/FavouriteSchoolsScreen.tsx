import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  Platform,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
const MaterialIcons = require('@expo/vector-icons').MaterialIcons;
import { useToast } from '../components/AppToast';
import { FavouriteSchoolCard } from '../components/FavouriteSchoolCard';
import { SchoolDetailModal } from '../components/SchoolDetailModal';
import { fetchSchoolPublicDetail } from '../api/school';
import { fetchFavouriteSchoolsPage, removeFavouriteSchool } from '../api/favouriteSchool';
import type { FavouriteSchoolItem, SchoolDetail } from '../types/school';

const sp = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 } as const;
const radius = { md: 12, lg: 16, xl: 20, full: 9999 } as const;
const BRAND = '#1976d2';

const HEADER_TOP =
  Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight ?? 24) + 8;

const PAGE_SIZE = 10;

type SortId = 'recent' | 'name' | 'rating';

const SORT_OPTIONS: { id: SortId; label: string }[] = [
  { id: 'recent', label: 'Mới lưu' },
  { id: 'name', label: 'Tên A-Z' },
  { id: 'rating', label: 'Đánh giá' },
];

type FavouriteSchoolsScreenProps = {
  visible: boolean;
  onClose: () => void;
  onUnfavourited: (schoolId: number) => void;
  onExploreSchools: () => void;
  onToggleSchoolFavourite: (schoolId: number) => Promise<boolean>;
  getIsSchoolFavourite: (schoolId: number) => boolean;
};

export default function FavouriteSchoolsScreen({
  visible,
  onClose,
  onUnfavourited,
  onExploreSchools,
  onToggleSchoolFavourite,
  getIsSchoolFavourite,
}: FavouriteSchoolsScreenProps) {
  const { showSuccess, showError } = useToast();
  const [items, setItems] = useState<FavouriteSchoolItem[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSchool, setDetailSchool] = useState<SchoolDetail | null>(null);
  const [detailSchoolId, setDetailSchoolId] = useState<number | null>(null);
  const [nextPage, setNextPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortId>('recent');

  const loadInitial = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetchFavouriteSchoolsPage(0, PAGE_SIZE);
      const body = res.body;
      setItems(body?.items ?? []);
      setHasNext(body?.hasNext ?? false);
      setNextPage(1);
    } catch (e) {
      setItems([]);
      setHasNext(false);
      setError(e instanceof Error ? e.message : 'Không tải được danh sách yêu thích');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    loadInitial();
  }, [visible, loadInitial]);

  useEffect(() => {
    if (!visible) {
      setDetailVisible(false);
      setDetailSchool(null);
      setDetailSchoolId(null);
    }
  }, [visible]);

  const openSchoolDetailFromFavourites = useCallback(async (schoolId: number) => {
    setDetailVisible(true);
    setDetailSchoolId(schoolId);
    setDetailLoading(true);
    setDetailSchool(null);
    try {
      const res = await fetchSchoolPublicDetail(schoolId);
      setDetailSchool(res.body ?? null);
    } catch {
      setDetailSchool(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeSchoolDetail = useCallback(() => {
    setDetailVisible(false);
    setDetailSchool(null);
    setDetailSchoolId(null);
  }, []);

  const handleDetailToggleFavourite = useCallback(async () => {
    if (detailSchoolId == null) return;
    const sid = detailSchoolId;
    const wasFav =
      getIsSchoolFavourite(sid) || items.some((i) => i.schoolId === sid);
    const ok = await onToggleSchoolFavourite(sid);
    if (ok && wasFav) {
      setItems((prev) => prev.filter((i) => i.schoolId !== sid));
    }
  }, [detailSchoolId, getIsSchoolFavourite, items, onToggleSchoolFavourite]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadInitial();
    } finally {
      setRefreshing(false);
    }
  }, [loadInitial]);

  const loadMore = useCallback(async () => {
    if (!hasNext || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const res = await fetchFavouriteSchoolsPage(nextPage, PAGE_SIZE);
      const body = res.body;
      setItems((prev) => [...prev, ...(body?.items ?? [])]);
      setHasNext(body?.hasNext ?? false);
      setNextPage((p) => p + 1);
    } catch {
      showError('Không tải thêm được');
    } finally {
      setLoadingMore(false);
    }
  }, [hasNext, loadingMore, loading, nextPage, showError]);

  const performRemove = useCallback(
    async (item: FavouriteSchoolItem) => {
      try {
        await removeFavouriteSchool(item.id);
        setItems((prev) => prev.filter((x) => x.id !== item.id));
        onUnfavourited(item.schoolId);
        showSuccess('Đã gỡ khỏi yêu thích');
      } catch (e) {
        showError(e instanceof Error ? e.message : 'Không gỡ được yêu thích');
      }
    },
    [onUnfavourited, showError, showSuccess]
  );

  const displayed = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q
      ? items.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            (s.description ?? '').toLowerCase().includes(q)
        )
      : [...items];

    if (sort === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    } else if (sort === 'rating') {
      list.sort((a, b) => {
        const ar = a.averageRating;
        const br = b.averageRating;
        if (ar == null && br == null) return 0;
        if (ar == null) return 1;
        if (br == null) return -1;
        return br - ar;
      });
    } else {
      list.sort((a, b) => b.id - a.id);
    }
    return list;
  }, [items, query, sort]);

  const renderSkeleton = () => (
    <View style={styles.skeletonWrap}>
      {[1, 2, 3, 4].map((k) => (
        <View key={k} style={styles.skeletonCard} />
      ))}
    </View>
  );

  const renderEmpty = () => {
    if (loading) return null;
    if (error) {
      return (
        <View style={styles.emptyWrap}>
          <MaterialIcons name="cloud-off" size={56} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>{error}</Text>
          <Pressable style={styles.primaryBtn} onPress={() => void loadInitial()}>
            <Text style={styles.primaryBtnText}>Thử lại</Text>
          </Pressable>
        </View>
      );
    }
    if (items.length === 0) {
      return (
        <View style={styles.emptyWrap}>
          <MaterialIcons name="favorite-border" size={56} color="#bfdbfe" />
          <Text style={styles.emptyTitle}>Chưa có trường yêu thích</Text>
          <Text style={styles.emptySub}>
            Khám phá và lưu các trường bạn quan tâm để xem lại nhanh hơn.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={onExploreSchools}>
            <Text style={styles.primaryBtnText}>Khám phá trường</Text>
          </Pressable>
        </View>
      );
    }
    if (displayed.length === 0) {
      return (
        <View style={styles.emptyWrap}>
          <MaterialIcons name="search-off" size={48} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>Không tìm thấy trường</Text>
          <Pressable hitSlop={8} onPress={() => setQuery('')}>
            <Text style={styles.linkText}>Xóa bộ lọc tìm kiếm</Text>
          </Pressable>
        </View>
      );
    }
    return null;
  };

  if (!visible) return null;

  const detailIsFavourite =
    detailSchoolId != null &&
    (getIsSchoolFavourite(detailSchoolId) ||
      items.some((i) => i.schoolId === detailSchoolId));

  return (
    <>
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: HEADER_TOP }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
          </Pressable>
          <View style={styles.headerTitles}>
            <Text style={styles.title}>Trường yêu thích</Text>
            <Text style={styles.subtitle}>Truy cập nhanh các trường đã lưu</Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <MaterialIcons name="search" size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm theo tên trường..."
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <MaterialIcons name="close" size={20} color="#94a3b8" />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.sortRow}>
          {SORT_OPTIONS.map((opt) => (
            <Pressable
              key={opt.id}
              onPress={() => setSort(opt.id)}
              style={[styles.sortChip, sort === opt.id && styles.sortChipActive]}
            >
              <Text style={[styles.sortChipText, sort === opt.id && styles.sortChipTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading && items.length === 0 ? (
        <View style={[styles.listContent, styles.skeletonList]}>{renderSkeleton()}</View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <FavouriteSchoolCard
              item={item}
              onViewDetail={() => void openSchoolDetailFromFavourites(item.schoolId)}
              onRemoveHeart={() => void performRemove(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={BRAND} />
          }
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.35}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.footerLoader} color={BRAND} /> : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>

    <SchoolDetailModal
      visible={detailVisible}
      loading={detailLoading}
      school={detailSchool}
      isFavourite={detailIsFavourite}
      onClose={closeSchoolDetail}
      onToggleFavourite={() => void handleDetailToggleFavourite()}
    />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: sp.lg,
    paddingBottom: sp.md,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: sp.md,
    paddingTop: sp.xs,
  },
  backBtn: {
    marginRight: sp.sm,
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#64748b',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: radius.lg,
    paddingHorizontal: sp.md,
    minHeight: 46,
    gap: sp.sm,
    marginBottom: sp.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp.xs,
  },
  sortChip: {
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    borderRadius: radius.full,
    backgroundColor: '#f1f5f9',
  },
  sortChipActive: {
    backgroundColor: BRAND,
  },
  sortChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  sortChipTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: sp.lg,
    paddingTop: sp.md,
    paddingBottom: 40,
    flexGrow: 1,
  },
  skeletonList: {
    flex: 1,
  },
  skeletonWrap: {
    gap: sp.md,
  },
  skeletonCard: {
    height: 200,
    borderRadius: radius.lg,
    backgroundColor: '#e2e8f0',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: sp.xxl * 2,
    paddingHorizontal: sp.lg,
  },
  emptyTitle: {
    marginTop: sp.md,
    fontSize: 18,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
  },
  emptySub: {
    marginTop: sp.sm,
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryBtn: {
    marginTop: sp.xl,
    backgroundColor: BRAND,
    paddingHorizontal: sp.xl,
    paddingVertical: 14,
    borderRadius: radius.lg,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  linkText: {
    marginTop: sp.md,
    fontSize: 14,
    fontWeight: '600',
    color: BRAND,
  },
  footerLoader: {
    marginVertical: sp.lg,
  },
});
