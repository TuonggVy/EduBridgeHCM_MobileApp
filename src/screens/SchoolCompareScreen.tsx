import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { fetchSchoolCampaignTemplates, fetchSchoolPublicDetail } from '../api/school';
import type { SchoolCampaignTemplate, SchoolDetail, SchoolSummary, SubjectJsonb } from '../types/school';
import { campaignQueryYears, resolveCampaignOfferingNodes } from '../utils/schoolCampaign';
import { MaterialIcons, radius, sp } from './tabs/tabConstants';

const PRIMARY = '#1976d2';
const HIGHLIGHT_DIFF = '#fffbeb';
const MUTED = '#64748b';
const TEXT = '#0f172a';
const MAX_SCHOOLS = 2;
const LABEL_W = 112;

function useColumnWidth(): number {
  const w = Dimensions.get('window').width;
  return Math.min(280, Math.max(156, Math.round((w - LABEL_W - sp.lg * 2) * 0.48)));
}

function formatVnd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(n);
}

function foundingYear(detail: SchoolDetail | null): string {
  if (!detail?.foundingDate) return '—';
  const y = new Date(detail.foundingDate).getFullYear();
  return Number.isFinite(y) ? String(y) : '—';
}

function primaryCampusAddress(detail: SchoolDetail | null): string {
  const list = detail?.campusList ?? [];
  const main = list.find((c) => /chính/i.test(c.name)) ?? list[0];
  const parts = [main?.address, main?.ward, main?.district, main?.city].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

function curriculumTypeVi(code: string | null | undefined): string {
  if (!code) return '—';
  if (code === 'INTERNATIONAL') return 'Quốc tế';
  if (code === 'NATIONAL' || code === 'VIETNAM') return 'Việt Nam';
  return code.replace(/_/g, ' ');
}

function getLearningModeLabel(learningMode: unknown): string {
  if (typeof learningMode !== 'string' || !learningMode.trim()) return '';
  const normalized = learningMode.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized === 'DAY_SCHOOL') return 'Học ban ngày';
  if (normalized === 'BOARDING' || normalized === 'FULL_BOARDING') return 'Nội trú';
  if (normalized === 'SEMI_BOARDING') return 'Bán trú';
  if (normalized === 'HALF_DAY' || normalized === 'HALF_BOARDING') return 'Bán ngày';
  return learningMode.trim();
}

function readOfferingField(o: Record<string, unknown>, key: string): unknown {
  return o[key];
}

function offeringTuition(o: Record<string, unknown>): number | null {
  const t = readOfferingField(o, 'tuitionFee');
  if (typeof t === 'number' && Number.isFinite(t)) return t;
  const { program } = resolveCampaignOfferingNodes(o);
  const bf = program?.baseTuitionFee;
  if (typeof bf === 'number' && Number.isFinite(bf)) return bf;
  return null;
}

function offeringFeeUnit(o: Record<string, unknown>): string | null {
  const { program } = resolveCampaignOfferingNodes(o);
  const u = program?.feeUnit;
  return typeof u === 'string' ? u : null;
}

function tuitionSummary(detail: SchoolDetail | null, campaign: SchoolCampaignTemplate | null): string {
  const fees: number[] = [];
  const offerings = campaign?.campusProgramOfferings ?? [];
  for (const raw of offerings) {
    if (!raw || typeof raw !== 'object') continue;
    const t = offeringTuition(raw as Record<string, unknown>);
    if (t != null) fees.push(t);
  }
  if (detail?.curriculumList) {
    for (const cur of detail.curriculumList) {
      for (const p of cur.programList ?? []) {
        if (typeof p.baseTuitionFee === 'number' && p.baseTuitionFee > 0) fees.push(p.baseTuitionFee);
      }
    }
  }
  if (fees.length === 0) return '—';
  const min = Math.min(...fees);
  const max = Math.max(...fees);
  const unit =
    campaign?.campusProgramOfferings?.[0] && typeof campaign.campusProgramOfferings[0] === 'object'
      ? offeringFeeUnit(campaign.campusProgramOfferings[0] as Record<string, unknown>)
      : null;
  const suffix = unit === 'SEMESTER' ? '/ học kỳ' : unit === 'YEAR' ? '/ năm' : '';
  if (min === max) return `${formatVnd(min)}${suffix}`;
  return `${formatVnd(min)} – ${formatVnd(max)}${suffix}`;
}

function programNamesLine(detail: SchoolDetail | null, campaign: SchoolCampaignTemplate | null): string {
  const namesFromCampaign = new Set<string>();
  for (const raw of campaign?.campusProgramOfferings ?? []) {
    if (!raw || typeof raw !== 'object') continue;
    const { program, curriculum } = resolveCampaignOfferingNodes(raw as Record<string, unknown>);
    if (typeof program?.name === 'string' && program.name.trim()) namesFromCampaign.add(program.name.trim());
    if (typeof curriculum?.name === 'string' && curriculum.name.trim()) namesFromCampaign.add(curriculum.name.trim());
  }
  if (namesFromCampaign.size > 0) {
    const names = [...namesFromCampaign];
    return names.slice(0, 3).join('\n') + (names.length > 3 ? '…' : '');
  }
  if (!detail?.curriculumList?.length) return '—';
  const names = detail.curriculumList.map((c) => c.name?.trim()).filter(Boolean) as string[];
  return names.length ? names.slice(0, 3).join('\n') + (names.length > 3 ? '…' : '') : '—';
}

function curriculumTypesLine(detail: SchoolDetail | null, campaign: SchoolCampaignTemplate | null): string {
  const campaignTypes = new Set<string>();
  for (const raw of campaign?.campusProgramOfferings ?? []) {
    if (!raw || typeof raw !== 'object') continue;
    const { curriculum } = resolveCampaignOfferingNodes(raw as Record<string, unknown>);
    const type = typeof curriculum?.curriculumType === 'string' ? curriculum.curriculumType : null;
    if (type) campaignTypes.add(curriculumTypeVi(type));
  }
  if (campaignTypes.size > 0) return [...campaignTypes].join(' · ');
  if (!detail?.curriculumList?.length) return '—';
  const types = [...new Set(detail.curriculumList.map((c) => curriculumTypeVi(c.curriculumType)))];
  return types.join(' · ');
}

function mergeSubjects(detail: SchoolDetail | null, campaign: SchoolCampaignTemplate | null): SubjectJsonb[] {
  const map = new Map<string, SubjectJsonb>();
  for (const raw of campaign?.campusProgramOfferings ?? []) {
    if (!raw || typeof raw !== 'object') continue;
    const { curriculum } = resolveCampaignOfferingNodes(raw as Record<string, unknown>);
    const subjectOptions = Array.isArray(curriculum?.subjectOptions) ? curriculum.subjectOptions : null;
    if (!subjectOptions) continue;
    for (const rawSubject of subjectOptions) {
      if (!rawSubject || typeof rawSubject !== 'object') continue;
      const subject = rawSubject as Record<string, unknown>;
      const name = typeof subject.name === 'string' ? subject.name : null;
      if (!name || map.has(name)) continue;
      map.set(name, {
        name,
        description: typeof subject.description === 'string' ? subject.description : null,
        isMandatory: Boolean(subject.isMandatory),
      });
    }
  }
  for (const cur of detail?.curriculumList ?? []) {
    const list = cur.subjectsJsonb ?? [];
    for (const s of list) {
      if (s?.name && !map.has(s.name)) map.set(s.name, s);
    }
    for (const prog of cur.programList ?? []) {
      const curObj = (prog as Record<string, unknown>).curriculum;
      if (curObj && typeof curObj === 'object') {
        const opts = (curObj as Record<string, unknown>).subjectOptions;
        if (Array.isArray(opts)) {
          for (const raw of opts) {
            if (!raw || typeof raw !== 'object') continue;
            const o = raw as Record<string, unknown>;
            const name = typeof o.name === 'string' ? o.name : null;
            if (!name || map.has(name)) continue;
            map.set(name, {
              name,
              description: typeof o.description === 'string' ? o.description : null,
              isMandatory: Boolean(o.isMandatory),
            });
          }
        }
      }
    }
  }
  return [...map.values()];
}

function pickPrimaryCampaign(templates: SchoolCampaignTemplate[] | null | undefined): SchoolCampaignTemplate | null {
  if (!templates?.length) return null;
  const open = templates.find(
    (t) => t.status === 'OPEN_ADMISSION_CAMPAIGN' || String(t.status).toUpperCase().includes('OPEN')
  );
  if (open) return open;
  return [...templates].sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0];
}

function admissionMethodLine(campaign: SchoolCampaignTemplate | null): string {
  const m = campaign?.admissionMethodDetails ?? [];
  if (!m.length) return '—';
  return m.map((x) => x.displayName).join('\n');
}

function campaignNameLine(campaign: SchoolCampaignTemplate | null): string {
  if (!campaign?.name) return '—';
  return campaign.name;
}

function formatCampaignDate(value: string | null | undefined): string {
  if (!value?.trim()) return '—';
  const trimmed = value.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}/${month}/${year}`;
  }
  const date = new Date(trimmed);
  if (!Number.isNaN(date.getTime())) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
  }
  return trimmed;
}

function admissionWindowLine(campaign: SchoolCampaignTemplate | null): string {
  const start = formatCampaignDate(campaign?.startDate);
  const end = formatCampaignDate(campaign?.endDate);
  if (start === '—' && end === '—') return '—';
  if (start === '—') return end;
  if (end === '—') return start;
  return `${start} → ${end}`;
}

function quotaLine(campaign: SchoolCampaignTemplate | null): string {
  const offerings = campaign?.campusProgramOfferings ?? [];
  const parts: string[] = [];
  for (const raw of offerings) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const q = o.quota;
    const r = o.remainingQuota;
    if (typeof q === 'number') {
      parts.push(typeof r === 'number' ? `${r}/${q}` : `${q}`);
    }
  }
  return parts.length ? parts.join('\n') : '—';
}

function quotaProgress(campaign: SchoolCampaignTemplate | null): { filled: number; total: number } | null {
  const offerings = campaign?.campusProgramOfferings ?? [];
  let total = 0;
  let rem = 0;
  for (const raw of offerings) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const q = o.quota;
    const r = o.remainingQuota;
    if (typeof q === 'number') {
      total += q;
      if (typeof r === 'number') rem += r;
    }
  }
  if (!total) return null;
  return { filled: Math.max(0, total - rem), total };
}

/** Gom `learningMode` từ các gói tuyển sinh (`campusProgramOfferings`). */
function learningModesFromCampaign(campaign: SchoolCampaignTemplate | null): string {
  const offerings = campaign?.campusProgramOfferings ?? [];
  const modes = new Set<string>();
  for (const raw of offerings) {
    if (!raw || typeof raw !== 'object') continue;
    const label = getLearningModeLabel(readOfferingField(raw as Record<string, unknown>, 'learningMode'));
    if (label) modes.add(label);
  }
  return modes.size ? [...modes].join('\n') : '—';
}

function mandatoryDocNames(campaign: SchoolCampaignTemplate | null): string[] {
  const m = campaign?.mandatoryAll ?? [];
  return m.map((d) => d.name).filter(Boolean);
}

function methodDocNames(campaign: SchoolCampaignTemplate | null): string[] {
  const out: string[] = [];
  for (const md of campaign?.admissionMethodDetails ?? []) {
    for (const d of md.methodDocumentRequirements ?? []) {
      if (d.name) out.push(d.name);
    }
  }
  return [...new Set(out)];
}

export type SchoolCompareScreenProps = {
  onClose: () => void;
  allSchools: SchoolSummary[];
  onOpenSchoolDetail: (schoolId: number) => void;
  onToggleFavourite: (schoolId: number) => Promise<boolean> | boolean;
  getIsFavourite: (schoolId: number) => boolean;
};

type CompareTableRowDef = {
  key: string;
  label: string;
  values?: string[];
  emphasize?: boolean;
  renderCells?: (highlighted: boolean[]) => React.ReactNode;
};

function computeRowHighlight(values: string[]): boolean[] {
  return values.map((_, i) => {
    const others = values.filter((_, j) => j !== i);
    return others.some((v) => v !== values[i]);
  });
}

type SchoolBundle = {
  id: number;
  detail: SchoolDetail | null;
  campaign: SchoolCampaignTemplate | null;
  loading: boolean;
  error: string | null;
};

export default function SchoolCompareScreen({
  onClose,
  allSchools,
  onOpenSchoolDetail,
  onToggleFavourite,
  getIsFavourite,
}: SchoolCompareScreenProps) {
  const COL_W = useColumnWidth();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bundles, setBundles] = useState<Record<number, SchoolBundle>>({});
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [expandedSubjects, setExpandedSubjects] = useState<Record<number, boolean>>({});
  const [docsExpanded, setDocsExpanded] = useState<Record<number, boolean>>({});

  const scrollRefs = useRef<Record<string, ScrollView | null>>({});
  const syncing = useRef(false);

  const registerHScroll = useCallback((key: string, r: ScrollView | null) => {
    scrollRefs.current[key] = r;
  }, []);

  const onSyncedScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>, sourceKey: string) => {
    if (syncing.current) return;
    const x = e.nativeEvent.contentOffset.x;
    syncing.current = true;
    Object.entries(scrollRefs.current).forEach(([key, r]) => {
      if (r && key !== sourceKey) {
        r.scrollTo({ x, animated: false });
      }
    });
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  }, []);

  const renderCompareTable = useCallback(
    (tableKey: string, rows: CompareTableRowDef[]) => (
      <View style={styles.compareTable}>
        {rows.map((row, rowIdx) => {
          const scrollKey = `${tableKey}-${row.key}`;
          const highlighted = row.values != null ? computeRowHighlight(row.values) : [];
          return (
            <View
              key={row.key}
              style={[
                styles.compareTableRow,
                rowIdx === rows.length - 1 ? styles.compareTableRowLast : null,
              ]}
            >
              <View style={[styles.labelCell, { width: LABEL_W }]}>
                <Text style={styles.labelText}>{row.label}</Text>
              </View>
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                style={styles.compareDataScroll}
                ref={(r) => registerHScroll(scrollKey, r)}
                onScroll={(e) => onSyncedScroll(e, scrollKey)}
                scrollEventThrottle={16}
              >
                {row.renderCells ? (
                  row.renderCells(highlighted)
                ) : (
                  <View style={styles.compareDataRow}>
                    {(row.values ?? []).map((v, i) => (
                      <View
                        key={i}
                        style={[
                          styles.dataCell,
                          { width: COL_W },
                          highlighted[i] ? styles.cellDiff : null,
                        ]}
                      >
                        <Text style={row.emphasize ? styles.dataTextEm : styles.dataText}>{v}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            </View>
          );
        })}
      </View>
    ),
    [COL_W, onSyncedScroll, registerHScroll]
  );

  useEffect(() => {
    let cancelled = false;
    const load = async (id: number) => {
      setBundles((prev) => ({
        ...prev,
        [id]: {
          id,
          detail: prev[id]?.detail ?? null,
          campaign: prev[id]?.campaign ?? null,
          loading: true,
          error: null,
        },
      }));
      let detail: SchoolDetail | null = null;
      let detailRejected: unknown = null;
      try {
        const detailRes = await fetchSchoolPublicDetail(id);
        detail = detailRes.body ?? null;
      } catch (reason) {
        detailRejected = reason;
      }
      if (cancelled) return;

      let campaigns: SchoolCampaignTemplate[] = [];
      let campaignRejected: unknown = null;
      for (const year of campaignQueryYears(detail)) {
        try {
          const res = await fetchSchoolCampaignTemplates(id, year);
          const rows = res.body ?? [];
          if (rows.length > 0) {
            campaigns = rows;
            break;
          }
          campaigns = rows;
        } catch (reason) {
          campaignRejected = reason;
        }
        if (cancelled) return;
      }

      const error =
        detailRejected != null && campaignRejected != null
          ? detailRejected instanceof Error
            ? detailRejected.message
            : campaignRejected instanceof Error
              ? campaignRejected.message
              : 'Lỗi tải'
          : null;

      setBundles((prev) => ({
        ...prev,
        [id]: {
          id,
          detail,
          campaign: pickPrimaryCampaign(campaigns),
          loading: false,
          error,
        },
      }));
    };

    selectedIds.forEach((id) => {
      void load(id);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedIds]);

  const orderedBundles = useMemo(
    () => selectedIds.map((id) => bundles[id]).filter(Boolean) as SchoolBundle[],
    [selectedIds, bundles]
  );

  const removeSchool = useCallback((id: number) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const addSchool = useCallback((id: number) => {
    if (selectedIds.includes(id) || selectedIds.length >= MAX_SCHOOLS) return;
    setSelectedIds((prev) => [...prev, id]);
    setAddSheetOpen(false);
    setAddQuery('');
  }, [selectedIds]);

  const filteredAddList = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    return allSchools.filter((s) => !selectedIds.includes(s.id) && (!q || s.name.toLowerCase().includes(q)));
  }, [allSchools, selectedIds, addQuery]);

  const buildGeneralRows = () => {
    const founding = orderedBundles.map((b) => foundingYear(b.detail));
    const campusN = orderedBundles.map((b) => String(b.detail?.totalCampus ?? '—'));
    const addr = orderedBundles.map((b) => primaryCampusAddress(b.detail));
    const rows = [
      { key: 'found', label: 'Năm thành lập', values: founding },
      { key: 'camp', label: 'Số cơ sở', values: campusN },
      { key: 'addr', label: 'Địa chỉ chính', values: addr },
    ];
    return rows;
  };

  const buildProgramRows = (): CompareTableRowDef[] => {
    const types = orderedBundles.map((b) => curriculumTypesLine(b.detail, b.campaign));
    const names = orderedBundles.map((b) => programNamesLine(b.detail, b.campaign));
    return [
      { key: 'type', label: 'Loại chương trình', values: types },
      { key: 'name', label: 'Tên chương trình', values: names },
    ];
  };

  if (selectedIds.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.iconBtn}>
            <MaterialIcons name="arrow-back" size={24} color={TEXT} />
          </Pressable>
          <Text style={styles.screenTitle}>So sánh trường</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyWrap}>
          <MaterialIcons name="compare-arrows" size={48} color={MUTED} />
          <Text style={styles.emptyTitle}>Chưa có trường để so sánh</Text>
          <Text style={styles.emptySub}>
            Chọn tối đa 2 trường từ danh sách để so sánh cạnh nhau.
          </Text>
          <Pressable style={styles.addBtn} onPress={() => setAddSheetOpen(true)}>
            <MaterialIcons name="add" size={20} color="#fff" />
            <Text style={styles.addBtnText}>Thêm trường</Text>
          </Pressable>
        </View>
        <Modal
          visible={addSheetOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setAddSheetOpen(false)}
        >
          <View style={styles.sheetRoot}>
            <Pressable style={styles.sheetBackdropFlex} onPress={() => setAddSheetOpen(false)} />
            <View style={styles.sheetInner}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Chọn trường</Text>
              <TextInput
                value={addQuery}
                onChangeText={setAddQuery}
                placeholder="Tìm theo tên..."
                style={styles.sheetSearch}
                placeholderTextColor={MUTED}
              />
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 360 }}>
                {filteredAddList.map((s) => (
                  <Pressable
                    key={s.id}
                    style={({ pressed }) => [styles.sheetItem, pressed && { opacity: 0.85 }]}
                    onPress={() => addSchool(s.id)}
                  >
                    {s.logoUrl ? (
                      <Image source={{ uri: s.logoUrl }} style={styles.sheetLogo} />
                    ) : (
                      <View style={[styles.sheetLogo, styles.logoPh]}>
                        <MaterialIcons name="school" size={20} color={PRIMARY} />
                      </View>
                    )}
                    <Text style={styles.sheetItemText} numberOfLines={2}>
                      {s.name}
                    </Text>
                  </Pressable>
                ))}
                {filteredAddList.length === 0 ? (
                  <Text style={styles.emptySheet}>Không tìm thấy trường</Text>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable onPress={onClose} hitSlop={12} style={styles.iconBtn}>
          <MaterialIcons name="arrow-back" size={24} color={TEXT} />
        </Pressable>
        <Text style={styles.screenTitle}>So sánh trường</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.toolbar}>
        <Pressable
          onPress={() => setAddSheetOpen(true)}
          disabled={selectedIds.length >= MAX_SCHOOLS}
          style={({ pressed }) => [
            styles.addBtn,
            pressed && { opacity: 0.9 },
            selectedIds.length >= MAX_SCHOOLS && { opacity: 0.45 },
          ]}
        >
          <MaterialIcons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Thêm trường</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header cards — đồng bộ scroll ngang */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          ref={(r) => registerHScroll('header', r)}
          onScroll={(e) => onSyncedScroll(e, 'header')}
          scrollEventThrottle={16}
          contentContainerStyle={styles.headerRow}
        >
          {selectedIds.map((id) => {
            const b = bundles[id];
            const detail = b?.detail;
            const loading = b?.loading ?? true;
            const err = b?.error;
            const fav = getIsFavourite(id);
            return (
              <View key={id} style={[styles.schoolHeaderCard, { width: COL_W }]}>
                <Pressable
                  hitSlop={10}
                  style={styles.removeChip}
                  onPress={() => removeSchool(id)}
                >
                  <MaterialIcons name="close" size={18} color={MUTED} />
                </Pressable>
                {loading ? (
                  <View style={styles.headerSkeleton}>
                    <ActivityIndicator color={PRIMARY} />
                  </View>
                ) : err ? (
                  <Text style={styles.errSmall}>{err}</Text>
                ) : (
                  <>
                    {detail?.logoUrl ? (
                      <Image source={{ uri: detail.logoUrl }} style={styles.logo} />
                    ) : (
                      <View style={[styles.logo, styles.logoPh]}>
                        <MaterialIcons name="school" size={36} color={PRIMARY} />
                      </View>
                    )}
                    <Text style={styles.schoolName} numberOfLines={2}>
                      {detail?.name ?? '—'}
                    </Text>
                    <Pressable
                      onPress={() => void onToggleFavourite(id)}
                      style={styles.favBtn}
                    >
                      <MaterialIcons
                        name={fav ? 'favorite' : 'favorite-border'}
                        size={22}
                        color={fav ? '#e11d48' : MUTED}
                      />
                    </Pressable>
                    <View style={styles.headerActions}>
                      <Pressable
                        onPress={() => onOpenSchoolDetail(id)}
                        style={styles.outlineBtn}
                      >
                        <Text style={styles.outlineBtnText}>Xem chi tiết</Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* Thông tin chung */}
        {buildGeneralRows().length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Thông tin chung</Text>
            {renderCompareTable('general', buildGeneralRows())}
          </View>
        ) : null}

        {/* Học phí & chương trình */}
        {(() => {
          const tuitionVals = orderedBundles.map((b) => tuitionSummary(b.detail, b.campaign));
          const progRows = buildProgramRows();
          if (orderedBundles.length === 0) return null;
          return (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Học phí & chương trình</Text>
              {renderCompareTable('tuition', [
                { key: 'tuition', label: 'Học phí', values: tuitionVals, emphasize: true },
                ...progRows,
              ])}
            </View>
          );
        })()}

        {/* Môn học */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Môn học</Text>
          {renderCompareTable('subjects', [
            {
              key: 'list',
              label: 'Danh sách',
              renderCells: () => (
                <View style={styles.compareDataRow}>
                  {orderedBundles.map((b) => {
                    const subs = mergeSubjects(b.detail, b.campaign);
                    const expanded = expandedSubjects[b.id] ?? false;
                    const shown = expanded ? subs : subs.slice(0, 8);
                    return (
                      <View key={b.id} style={[styles.dataCell, { width: COL_W }]}>
                        {subs.length === 0 ? (
                          <Text style={styles.dataText}>—</Text>
                        ) : (
                          <>
                            <View style={styles.tagWrap}>
                              {shown.map((s) => (
                                <View key={s.name} style={styles.tag}>
                                  <Text style={styles.tagText} numberOfLines={2}>
                                    {s.name}
                                    {s.isMandatory ? ' (Bắt buộc)' : ''}
                                  </Text>
                                </View>
                              ))}
                            </View>
                            {subs.length > 8 ? (
                              <Pressable onPress={() => setExpandedSubjects((p) => ({ ...p, [b.id]: !expanded }))}>
                                <Text style={styles.linkSm}>{expanded ? 'Thu gọn' : 'Xem thêm'}</Text>
                              </Pressable>
                            ) : null}
                          </>
                        )}
                      </View>
                    );
                  })}
                </View>
              ),
            },
          ])}
        </View>

        {/* Tuyển sinh */}
        {(() => {
          const campaignVals = orderedBundles.map((b) => campaignNameLine(b.campaign));
          const methodVals = orderedBundles.map((b) => admissionMethodLine(b.campaign));
          const timeVals = orderedBundles.map((b) => admissionWindowLine(b.campaign));
          const quotaVals = orderedBundles.map((b) => quotaLine(b.campaign));
          return (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tuyển sinh</Text>
              {renderCompareTable('admission', [
                { key: 'campaign', label: 'Chiến dịch tuyển sinh', values: campaignVals },
                { key: 'method', label: 'Phương thức', values: methodVals },
                { key: 'time', label: 'Thời gian tuyển sinh', values: timeVals },
                {
                  key: 'quota',
                  label: 'Chỉ tiêu',
                  values: quotaVals,
                  renderCells: (highlighted) => (
                    <View style={styles.compareDataRow}>
                      {orderedBundles.map((b, idx) => {
                        const qText = quotaLine(b.campaign);
                        const p = quotaProgress(b.campaign);
                        return (
                          <View
                            key={b.id}
                            style={[
                              styles.dataCell,
                              { width: COL_W },
                              highlighted[idx] ? styles.cellDiff : null,
                            ]}
                          >
                            <Text style={styles.dataText}>{qText}</Text>
                            {p ? (
                              <>
                                <Text style={styles.quotaCap}>
                                  Đã tuyển {p.filled} / {p.total}
                                </Text>
                                <View style={styles.progressTrack}>
                                  <View
                                    style={[
                                      styles.progressFill,
                                      { width: `${Math.min(100, (p.filled / p.total) * 100)}%` },
                                    ]}
                                  />
                                </View>
                              </>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  ),
                },
              ])}
            </View>
          );
        })()}

        {/* Hồ sơ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hồ sơ yêu cầu</Text>
          {renderCompareTable('docs', [
            {
              key: 'list',
              label: 'Danh mục',
              renderCells: () => (
                <View style={styles.compareDataRow}>
                  {orderedBundles.map((b) => {
                    const mandatory = mandatoryDocNames(b.campaign);
                    const extra = methodDocNames(b.campaign);
                    const merged = [...new Set([...mandatory, ...extra])];
                    const expanded = docsExpanded[b.id] ?? false;
                    const show = expanded ? merged : merged.slice(0, 3);
                    return (
                      <View key={b.id} style={[styles.dataCell, { width: COL_W }]}>
                        {merged.length === 0 ? (
                          <Text style={styles.dataText}>—</Text>
                        ) : (
                          <>
                            {show.map((name, idx) => (
                              <View key={idx} style={styles.checkRow}>
                                <MaterialIcons name="check-circle" size={16} color={PRIMARY} />
                                <Text style={styles.checkText} numberOfLines={2}>
                                  {name}
                                </Text>
                              </View>
                            ))}
                            {merged.length > 3 ? (
                              <Pressable onPress={() => setDocsExpanded((p) => ({ ...p, [b.id]: !expanded }))}>
                                <Text style={styles.linkSm}>{expanded ? 'Thu gọn' : 'Xem thêm'}</Text>
                              </Pressable>
                            ) : null}
                          </>
                        )}
                      </View>
                    );
                  })}
                </View>
              ),
            },
          ])}
        </View>

        {/* Hình thức học */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hình thức học</Text>
          {renderCompareTable('learning', [
            {
              key: 'mode',
              label: 'Chế độ',
              values: orderedBundles.map((b) => learningModesFromCampaign(b.campaign)),
            },
          ])}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal
        visible={addSheetOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setAddSheetOpen(false)}
      >
        <View style={styles.sheetRoot}>
          <Pressable style={styles.sheetBackdropFlex} onPress={() => setAddSheetOpen(false)} />
          <View style={styles.sheetInner}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Chọn trường</Text>
            <TextInput
              value={addQuery}
              onChangeText={setAddQuery}
              placeholder="Tìm theo tên..."
              style={styles.sheetSearch}
              placeholderTextColor={MUTED}
            />
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 360 }}>
              {filteredAddList.map((s) => (
                <Pressable
                  key={s.id}
                  style={({ pressed }) => [styles.sheetItem, pressed && { opacity: 0.85 }]}
                  onPress={() => addSchool(s.id)}
                >
                  {s.logoUrl ? (
                    <Image source={{ uri: s.logoUrl }} style={styles.sheetLogo} />
                  ) : (
                    <View style={[styles.sheetLogo, styles.logoPh]}>
                      <MaterialIcons name="school" size={20} color={PRIMARY} />
                    </View>
                  )}
                  <Text style={styles.sheetItemText} numberOfLines={2}>
                    {s.name}
                  </Text>
                </Pressable>
              ))}
              {filteredAddList.length === 0 ? (
                <Text style={styles.emptySheet}>Không còn trường phù hợp</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sp.sm,
    paddingBottom: sp.sm,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: sp.lg,
    paddingVertical: sp.sm,
    gap: sp.md,
    backgroundColor: '#fff',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PRIMARY,
    paddingVertical: 10,
    paddingHorizontal: sp.md,
    borderRadius: radius.lg,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    paddingBottom: sp.md,
  },
  headerRow: {
    paddingHorizontal: sp.lg,
    paddingVertical: sp.md,
    gap: sp.sm,
    flexDirection: 'row',
  },
  schoolHeaderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: sp.md,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  removeChip: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
    padding: 4,
  },
  headerSkeleton: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errSmall: {
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '600',
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 14,
    alignSelf: 'center',
    marginBottom: sp.sm,
  },
  logoPh: {
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  schoolName: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT,
    textAlign: 'center',
    marginBottom: 4,
  },
  favBtn: {
    alignSelf: 'center',
    marginTop: sp.sm,
    padding: 4,
  },
  headerActions: {
    marginTop: sp.md,
    gap: sp.sm,
  },
  outlineBtn: {
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: radius.lg,
    paddingVertical: 10,
    alignItems: 'center',
  },
  outlineBtnText: {
    color: PRIMARY,
    fontWeight: '800',
    fontSize: 13,
  },
  section: {
    marginTop: sp.lg,
    paddingHorizontal: sp.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT,
    marginBottom: sp.sm,
  },
  compareTable: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  compareTableRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  compareTableRowLast: {
    borderBottomWidth: 0,
  },
  compareDataScroll: {
    flex: 1,
  },
  compareDataRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  labelCell: {
    justifyContent: 'center',
    paddingHorizontal: sp.sm,
    paddingVertical: sp.sm,
    backgroundColor: '#f8fafc',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#e2e8f0',
    alignSelf: 'stretch',
  },
  labelText: {
    fontSize: 12,
    fontWeight: '700',
    color: MUTED,
  },
  dataCell: {
    padding: sp.sm,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#f1f5f9',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  cellDiff: {
    backgroundColor: HIGHLIGHT_DIFF,
  },
  dataText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT,
    lineHeight: 18,
  },
  dataTextEm: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT,
    lineHeight: 20,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    maxWidth: '100%',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0c4a6e',
  },
  linkSm: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '800',
    color: PRIMARY,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 6,
  },
  checkText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: TEXT,
    lineHeight: 16,
  },
  quotaCap: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED,
    marginBottom: 6,
  },
  progressTrack: {
    height: 6,
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: PRIMARY,
    borderRadius: 4,
  },
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  sheetBackdropFlex: {
    flex: 1,
  },
  sheetInner: {
    backgroundColor: '#fff',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: sp.lg,
    paddingBottom: sp.xl,
    maxHeight: '72%',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: sp.xl,
    gap: sp.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    fontWeight: '600',
    color: MUTED,
    textAlign: 'center',
    marginBottom: sp.md,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    marginTop: sp.sm,
    marginBottom: sp.md,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
    marginBottom: sp.sm,
  },
  sheetSearch: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: radius.md,
    paddingHorizontal: sp.md,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: sp.md,
    fontWeight: '600',
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
    paddingVertical: sp.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  sheetLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  sheetItemText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
  },
  emptySheet: {
    textAlign: 'center',
    color: MUTED,
    padding: sp.xl,
    fontWeight: '600',
  },
});
