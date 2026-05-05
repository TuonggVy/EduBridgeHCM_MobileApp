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
  Modal,
} from 'react-native';
import { SchoolCard } from '../../components/SchoolCard';
import type { SchoolSummary } from '../../types/school';
import { MaterialIcons, sp, radius } from './tabConstants';
import { fetchSchoolPublicDetail } from '../../api/school';

const SCHOOL_LIST_PAGE_SIZE = 10;
const BOARDING_TYPE_OPTIONS = [
  { id: 'FULL_BOARDING', label: 'Nội trú' },
  { id: 'SEMI_BOARDING', label: 'Bán trú' },
  { id: 'BOTH', label: 'Cả hai (Nội trú & Bán trú)' },
] as const;

type SchoolFilterMeta = {
  boardingTypes: string[];
  districts: string[];
};

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
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(SCHOOL_LIST_PAGE_SIZE);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [districtSearch, setDistrictSearch] = useState('');
  const [schoolFilterMetaById, setSchoolFilterMetaById] = useState<Record<number, SchoolFilterMeta>>({});
  const [appliedBoardingTypes, setAppliedBoardingTypes] = useState<string[]>([]);
  const [appliedDistricts, setAppliedDistricts] = useState<string[]>([]);
  const [draftBoardingTypes, setDraftBoardingTypes] = useState<string[]>([]);
  const [draftDistricts, setDraftDistricts] = useState<string[]>([]);

  const activeFilterCount = appliedBoardingTypes.length + appliedDistricts.length;

  const allDistricts = useMemo(() => {
    const districtSet = new Set<string>();
    Object.values(schoolFilterMetaById).forEach((meta) => {
      meta.districts.forEach((district) => {
        const normalized = district.trim();
        if (normalized) districtSet.add(normalized);
      });
    });
    return Array.from(districtSet).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [schoolFilterMetaById]);

  const displayedDistrictOptions = useMemo(() => {
    const q = districtSearch.trim().toLowerCase();
    if (!q) return allDistricts;
    return allDistricts.filter((district) => district.toLowerCase().includes(q));
  }, [allDistricts, districtSearch]);

  const resetDraftFilters = useCallback(() => {
    setDraftBoardingTypes([]);
    setDraftDistricts([]);
  }, []);

  const openFilterModal = useCallback(() => {
    setDraftBoardingTypes(appliedBoardingTypes);
    setDraftDistricts(appliedDistricts);
    setDistrictSearch('');
    setFilterModalVisible(true);
  }, [appliedBoardingTypes, appliedDistricts]);

  const applyFilters = useCallback(() => {
    setAppliedBoardingTypes(draftBoardingTypes);
    setAppliedDistricts(draftDistricts);
    setFilterModalVisible(false);
  }, [draftBoardingTypes, draftDistricts]);

  const clearAppliedFilters = useCallback(() => {
    setAppliedBoardingTypes([]);
    setAppliedDistricts([]);
  }, []);

  const toggleDraftBoardingType = useCallback((boardingType: string) => {
    setDraftBoardingTypes((prev) =>
      prev.includes(boardingType)
        ? prev.filter((item) => item !== boardingType)
        : [...prev, boardingType]
    );
  }, []);

  const toggleDraftDistrict = useCallback((district: string) => {
    setDraftDistricts((prev) =>
      prev.includes(district)
        ? prev.filter((item) => item !== district)
        : [...prev, district]
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    const missingSchoolIds = schools
      .map((school) => school.id)
      .filter((schoolId) => !schoolFilterMetaById[schoolId]);
    if (missingSchoolIds.length === 0) return;

    (async () => {
      const nextMetaEntries = await Promise.all(
        missingSchoolIds.map(async (schoolId) => {
          try {
            const res = await fetchSchoolPublicDetail(schoolId);
            const campusList = Array.isArray(res.body?.campusList) ? res.body.campusList : [];
            const boardingTypes = Array.from(
              new Set(
                campusList
                  .map((campus) => (typeof campus.boardingType === 'string' ? campus.boardingType.trim() : ''))
                  .filter((item) => item.length > 0)
              )
            );
            const districts = Array.from(
              new Set(
                campusList
                  .map((campus) => (typeof campus.district === 'string' ? campus.district.trim() : ''))
                  .filter((item) => item.length > 0)
              )
            );
            return [schoolId, { boardingTypes: [...boardingTypes], districts: [...districts] }] as [number, SchoolFilterMeta];
          } catch {
            return [schoolId, { boardingTypes: [], districts: [] }] as [number, SchoolFilterMeta];
          }
        })
      );

      if (cancelled) return;
      setSchoolFilterMetaById((prev) => {
        const next = { ...prev };
        nextMetaEntries.forEach(([schoolId, meta]) => {
          next[schoolId] = meta;
        });
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [schoolFilterMetaById, schools]);

  const filteredSchools = useMemo(() => {
    return schools.filter((school) => {
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        school.name.toLowerCase().includes(q) ||
        (school.description ?? '').toLowerCase().includes(q);
      if (!matchesQuery) return false;
      const meta = schoolFilterMetaById[school.id];
      const schoolBoardingTypes = meta?.boardingTypes ?? [];
      const schoolDistricts = meta?.districts ?? [];

      const matchesBoardingType =
        appliedBoardingTypes.length === 0 ||
        schoolBoardingTypes.some((boardingType) => {
          // Trường "BOTH" phải hiện khi user lọc FULL hoặc SEMI (hoặc cả hai).
          if (boardingType === 'BOTH') {
            return (
              appliedBoardingTypes.includes('BOTH') ||
              appliedBoardingTypes.includes('FULL_BOARDING') ||
              appliedBoardingTypes.includes('SEMI_BOARDING')
            );
          }
          return appliedBoardingTypes.includes(boardingType);
        });
      if (!matchesBoardingType) return false;

      const matchesDistrict =
        appliedDistricts.length === 0 ||
        schoolDistricts.some((district) => appliedDistricts.includes(district));
      return matchesDistrict;
    });
  }, [schools, query, schoolFilterMetaById, appliedBoardingTypes, appliedDistricts]);

  useEffect(() => {
    setVisibleCount(SCHOOL_LIST_PAGE_SIZE);
  }, [appliedBoardingTypes, appliedDistricts, query, schools]);

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

        <View style={styles.filterActionRow}>
          <Pressable style={styles.filterOpenBtn} onPress={openFilterModal}>
            <MaterialIcons name="tune" size={18} color="#1d4ed8" />
            <Text style={styles.filterOpenBtnText}>Bộ lọc</Text>
            {activeFilterCount > 0 ? (
              <View style={styles.filterCountBadge}>
                <Text style={styles.filterCountBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>
          {activeFilterCount > 0 ? (
            <Pressable onPress={clearAppliedFilters} hitSlop={8}>
              <Text style={styles.sectionLink}>Xóa bộ lọc</Text>
            </Pressable>
          ) : null}
        </View>
        {activeFilterCount > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeFilterScroll}
          >
            {appliedBoardingTypes.map((boardingType) => {
              const label =
                BOARDING_TYPE_OPTIONS.find((option) => option.id === boardingType)?.label ??
                boardingType;
              return (
                <View key={`boarding-${boardingType}`} style={styles.activeFilterChip}>
                  <Text style={styles.activeFilterChipText}>{label}</Text>
                </View>
              );
            })}
            {appliedDistricts.map((district) => (
              <View key={`district-${district}`} style={styles.activeFilterChip}>
                <Text style={styles.activeFilterChipText}>{district}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}
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
                totalCampus={item.totalCampus}
                isFavourite={item.isFavourite}
                onToggleFavourite={() => onToggleFavourite(item.id)}
                showFooter={false}
                containerStyle={styles.schoolCardFixedHeight}
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

      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.filterSheetBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setFilterModalVisible(false)}
          />
          <View style={styles.filterSheet}>
            <View style={styles.filterSheetHeader}>
              <View style={styles.sheetHeaderSide}>
                <Pressable onPress={() => setFilterModalVisible(false)} style={styles.sheetIconBtn}>
                  <MaterialIcons name="close" size={22} color="#0f172a" />
                </Pressable>
              </View>
              <Text style={styles.filterSheetTitle}>Bộ lọc</Text>
              <View style={[styles.sheetHeaderSide, styles.sheetHeaderSideRight]}>
                <Pressable onPress={resetDraftFilters} style={styles.sheetResetBtn}>
                  <Text style={styles.sheetResetText}>Đặt lại</Text>
                </Pressable>
              </View>
            </View>

            <ScrollView
              style={styles.filterBody}
              contentContainerStyle={styles.filterBodyContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.filterSectionLabel}>Loại nội trú</Text>
              <View style={styles.boardingChipWrap}>
                {BOARDING_TYPE_OPTIONS.map((option) => {
                  const selected = draftBoardingTypes.includes(option.id);
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => toggleDraftBoardingType(option.id)}
                      style={[
                        styles.boardingChip,
                        selected && styles.boardingChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.boardingChipText,
                          selected && styles.boardingChipTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.filterSectionLabel}>Quận</Text>
              <View style={styles.districtSearchWrap}>
                <MaterialIcons name="search" size={18} color="#94a3b8" />
                <TextInput
                  style={styles.districtSearchInput}
                  value={districtSearch}
                  onChangeText={setDistrictSearch}
                  placeholder="Tìm quận..."
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={styles.districtListWrap}>
                {displayedDistrictOptions.map((district) => {
                  const selected = draftDistricts.includes(district);
                  return (
                    <Pressable
                      key={district}
                      style={styles.districtRow}
                      onPress={() => toggleDraftDistrict(district)}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          selected && styles.checkboxSelected,
                        ]}
                      >
                        {selected ? (
                          <MaterialIcons name="check" size={14} color="#fff" />
                        ) : null}
                      </View>
                      <Text style={styles.districtText}>{district}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.filterFooter}>
              <Pressable style={styles.applyBtn} onPress={applyFilters}>
                <Text style={styles.applyBtnText}>
                  Áp dụng ({draftBoardingTypes.length + draftDistricts.length})
                </Text>
              </Pressable>
              <Pressable style={styles.clearBtn} onPress={resetDraftFilters}>
                <Text style={styles.clearBtnText}>Xóa bộ lọc</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  schoolCardFixedHeight: {
    height: 134,
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
  filterActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: sp.sm,
    marginBottom: sp.sm,
  },
  filterOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs,
  },
  filterOpenBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  filterCountBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1d4ed8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterCountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  activeFilterScroll: {
    gap: 8,
    marginBottom: sp.sm,
    paddingRight: 2,
  },
  activeFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  activeFilterChipText: {
    color: '#0369a1',
    fontSize: 12,
    fontWeight: '600',
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
  filterSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.35)',
    justifyContent: 'flex-end',
  },
  filterSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '86%',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  filterSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sheetHeaderSide: {
    width: 64,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sheetHeaderSideRight: {
    alignItems: 'flex-end',
  },
  sheetIconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  filterSheetTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#0f172a' },
  sheetResetBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  sheetResetText: { color: '#1d4ed8', fontSize: 14, fontWeight: '600' },
  filterBody: { maxHeight: 430 },
  filterBodyContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 14 },
  filterSectionLabel: { fontSize: 15, fontWeight: '600', color: '#334155' },
  boardingChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  boardingChip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  boardingChipSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#2563eb',
  },
  boardingChipText: { color: '#475569', fontSize: 13, fontWeight: '600' },
  boardingChipTextSelected: { color: '#fff' },
  districtSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 10,
    minHeight: 42,
    backgroundColor: '#fff',
  },
  districtSearchInput: { flex: 1, fontSize: 14, color: '#0f172a' },
  districtListWrap: { gap: 8, paddingBottom: 4 },
  districtRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#2563eb',
  },
  districtText: { fontSize: 14, color: '#334155' },
  filterFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 8,
  },
  applyBtn: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
  },
  applyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  clearBtn: {
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
  },
  clearBtnText: { color: '#475569', fontSize: 14, fontWeight: '600' },
});
