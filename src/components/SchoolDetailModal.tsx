import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  Linking,
  Platform,
  StatusBar,
} from 'react-native';
const MaterialIcons = require('@expo/vector-icons').MaterialIcons;
import type { SchoolDetail } from '../types/school';
import {
  badgePillStyle,
  getCurriculumStatusBadgeColors,
  getCurriculumStatusLabel,
  getCurriculumTypeBadgeColors,
  getCurriculumTypeLabel,
  getMethodLearningBadgeColors,
  getMethodLearningLabel,
} from '../utils/curriculumLabels';

const HEADER_TOP = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight ?? 24) + 8;

type Props = {
  visible: boolean;
  loading: boolean;
  school: SchoolDetail | null;
  isFavourite: boolean;
  onClose: () => void;
  onToggleFavourite: () => void;
};

export function SchoolDetailModal({
  visible,
  loading,
  school,
  isFavourite,
  onClose,
  onToggleFavourite,
}: Props) {
  const [expandedDescription, setExpandedDescription] = useState(false);
  const [expandedCurriculum, setExpandedCurriculum] = useState<Record<string, boolean>>({});

  const curriculumList = useMemo(() => school?.curriculumList ?? [], [school?.curriculumList]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.screen}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.banner}>
            {school?.logoUrl ? (
              <Image source={{ uri: school.logoUrl }} style={styles.bannerImage} resizeMode="cover" />
            ) : (
              <MaterialIcons name="school" size={40} color="#94a3b8" />
            )}
            <Pressable style={[styles.iconBtn, { top: HEADER_TOP, left: 16 }]} onPress={onClose}>
              <MaterialIcons name="arrow-back" size={22} color="#0f172a" />
            </Pressable>
            <Pressable style={[styles.iconBtn, { top: HEADER_TOP, right: 16 }]} onPress={onToggleFavourite}>
              <MaterialIcons
                name={isFavourite ? 'favorite' : 'favorite-border'}
                size={22}
                color={isFavourite ? '#ef4444' : '#0f172a'}
              />
            </Pressable>
          </View>

          {loading ? (
            <Text style={styles.loadingText}>Đang tải chi tiết trường…</Text>
          ) : !school ? (
            <Text style={styles.loadingText}>Không có dữ liệu trường.</Text>
          ) : (
            <View style={styles.content}>
              <View style={styles.card}>
                <Text style={styles.name}>{school.name}</Text>
                <View style={styles.metaRow}>
                  <MaterialIcons name="star" size={16} color="#f59e0b" />
                  <Text style={styles.meta}>
                    {typeof school.averageRating === 'number' ? school.averageRating.toFixed(1) : 'Chưa có đánh giá'}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <MaterialIcons name="event" size={16} color="#64748b" />
                  <Text style={styles.meta}>{school.foundingDate ?? 'Đang cập nhật'}</Text>
                </View>
                {school.hotline ? (
                  <Pressable onPress={() => Linking.openURL(`tel:${school.hotline}`)} style={styles.metaRow}>
                    <MaterialIcons name="phone" size={16} color="#2563eb" />
                    <Text style={styles.link}>{school.hotline}</Text>
                  </Pressable>
                ) : null}
                {school.websiteUrl ? (
                  <Pressable onPress={() => Linking.openURL(String(school.websiteUrl))} style={styles.metaRow}>
                    <MaterialIcons name="language" size={16} color="#2563eb" />
                    <Text style={styles.link} numberOfLines={1}>
                      {school.websiteUrl}
                    </Text>
                  </Pressable>
                ) : null}
                {school.representativeName ? (
                  <View style={styles.metaRow}>
                    <MaterialIcons name="person-outline" size={16} color="#64748b" />
                    <Text style={styles.meta}>{school.representativeName}</Text>
                  </View>
                ) : null}
              </View>

              {school.description ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Giới thiệu</Text>
                  <Text numberOfLines={expandedDescription ? undefined : 3} style={styles.sectionText}>
                    {school.description}
                  </Text>
                  <Pressable onPress={() => setExpandedDescription((prev) => !prev)}>
                    <Text style={styles.expandText}>{expandedDescription ? 'Thu gọn' : 'Xem thêm'}</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Chương trình đào tạo</Text>
                {curriculumList.map((curriculum) => {
                  const key = curriculum.groupCode || curriculum.name;
                  const expanded = !!expandedCurriculum[key];
                  const typeColors = getCurriculumTypeBadgeColors(curriculum.curriculumType);
                  const methodColors = getMethodLearningBadgeColors(curriculum.methodLearning);
                  const statusColors = getCurriculumStatusBadgeColors(curriculum.curriculumStatus);
                  const typePill = badgePillStyle(typeColors);
                  const methodPill = badgePillStyle(methodColors);
                  const statusPill = badgePillStyle({
                    bg: statusColors.bg,
                    text: statusColors.text,
                  });

                  return (
                    <View key={key} style={styles.curriculumCard}>
                      <Pressable
                        onPress={() =>
                          setExpandedCurriculum((prev) => ({ ...prev, [key]: !prev[key] }))
                        }
                      >
                        <View style={styles.curriculumHeaderRow}>
                          <Text style={styles.curriculumName}>{curriculum.name}</Text>
                          <MaterialIcons
                            name={expanded ? 'expand-less' : 'expand-more'}
                            size={22}
                            color="#64748b"
                          />
                        </View>
                        <Text style={styles.metaSmall}>
                          Năm tuyển sinh: {curriculum.enrollmentYear}
                        </Text>
                        <View style={styles.badgeRow}>
                          <View style={typePill.wrap}>
                            <Text style={typePill.text}>{getCurriculumTypeLabel(curriculum.curriculumType)}</Text>
                          </View>
                          <View style={methodPill.wrap}>
                            <Text style={methodPill.text}>{getMethodLearningLabel(curriculum.methodLearning)}</Text>
                          </View>
                          <View style={statusPill.wrap}>
                            <Text style={statusPill.text}>
                              {getCurriculumStatusLabel(curriculum.curriculumStatus)}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                      {expanded ? (
                        <View style={styles.curriculumBody}>
                          {curriculum.description ? (
                            <Text style={styles.sectionText}>{curriculum.description}</Text>
                          ) : null}
                          {curriculum.subjectsJsonb.map((subject) => (
                            <View key={`${key}-${subject.name}`} style={styles.subjectItem}>
                              <View style={styles.subjectTitleRow}>
                                <MaterialIcons
                                  name={subject.isMandatory ? 'check-circle' : 'radio-button-unchecked'}
                                  size={18}
                                  color={subject.isMandatory ? '#16a34a' : '#94a3b8'}
                                />
                                <Text style={styles.subjectName}>{subject.name}</Text>
                              </View>
                              {subject.description ? (
                                <Text style={styles.subjectDesc}>{subject.description}</Text>
                              ) : null}
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
        <View style={styles.bottomCtaWrap}>
          <Pressable
            onPress={() => {
              if (school?.hotline) {
                Linking.openURL(`tel:${school.hotline}`);
              }
            }}
            style={styles.bottomCta}
          >
            <MaterialIcons name="phone-in-talk" size={20} color="#fff" style={styles.bottomCtaIcon} />
            <Text style={styles.bottomCtaText}>Liên hệ tư vấn</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  banner: {
    height: 240,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerImage: { width: '100%', height: '100%' },
  iconBtn: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffffde',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: { textAlign: 'center', marginTop: 32, color: '#64748b', fontSize: 15 },
  content: { padding: 16, paddingBottom: 100, gap: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  name: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  meta: { color: '#334155', fontSize: 14, flex: 1 },
  metaSmall: { color: '#64748b', fontSize: 13, marginTop: 4 },
  link: { color: '#2563eb', fontSize: 14, flex: 1, textDecorationLine: 'underline' },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  sectionText: { color: '#475569', fontSize: 14, lineHeight: 20 },
  expandText: { marginTop: 8, color: '#2563eb', fontSize: 14, fontWeight: '600' },
  curriculumCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  curriculumHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  curriculumName: { fontSize: 15, fontWeight: '700', color: '#0f172a', flex: 1 },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  curriculumBody: { marginTop: 10, gap: 8 },
  subjectItem: { backgroundColor: '#f8fafc', borderRadius: 10, padding: 10 },
  subjectTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subjectName: { fontSize: 14, fontWeight: '600', color: '#0f172a', flex: 1 },
  subjectDesc: { marginTop: 4, fontSize: 13, color: '#64748b', marginLeft: 26 },
  bottomCtaWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: '#ffffffeb',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  bottomCta: {
    alignSelf: 'center',
    width: '88%',
    maxWidth: 360,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1976d2',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  bottomCtaIcon: { marginRight: 2 },
  bottomCtaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
