import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  ActivityIndicator,
  Animated,
  FlatList,
  Dimensions,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
const MaterialIcons = require('@expo/vector-icons').MaterialIcons;
import type { SchoolDetail } from '../types/school';
import type { SchoolCampaignTemplate } from '../types/school';
import type { ParentStudentProfile } from '../types/studentProfile';
import { fetchSchoolCampaignTemplates, fetchSchoolPublicDetail, searchNearbyCampus } from '../api/school';
import {
  badgePillStyle,
  getCurriculumStatusBadgeColors,
  getCurriculumStatusLabel,
  getCurriculumTypeBadgeColors,
  getCurriculumTypeLabel,
  getMethodLearningBadgeColors,
  getMethodLearningLabel,
  getProgramActiveBadgeColors,
  getProgramActiveLabel,
} from '../utils/curriculumLabels';

const HEADER_TOP = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight ?? 24) + 8;
const SCREEN_WIDTH = Dimensions.get('window').width;

/** Bán kính gọi nearby đủ rộng để vẫn nhận được các cơ sở của trường (km). */
const NEARBY_SEARCH_RADIUS_KM = 50;

function formatKm(d: number): string {
  return `${d.toFixed(d < 10 ? 1 : 0)} km`;
}

function formatIsoDateRange(startDate?: string | null, endDate?: string | null): string {
  if (!startDate && !endDate) return 'Đang cập nhật';
  const toLabel = (value?: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('vi-VN');
  };
  return `${toLabel(startDate)} - ${toLabel(endDate)}`;
}

function formatArrayDate(parts: number[]): string {
  if (parts.length < 3) return 'Đang cập nhật';
  const [year, month, day] = parts;
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

/** BE có thể trả HTML trong mô tả; RN Text không render tag — bỏ tag để hiển thị sạch. */
function stripBasicHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatTuitionVnd(amount: number | null): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  return `${new Intl.NumberFormat('vi-VN').format(amount)} đ`;
}

function formatFacilityValue(value?: number | null, unit?: string | null): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return unit ? `${value} ${unit}` : String(value);
}

function hasFacilityData(facility: SchoolDetail['campusList'][number]['facility']): boolean {
  if (!facility) return false;
  const hasItems = Array.isArray(facility.itemList) && facility.itemList.length > 0;
  const hasCover = typeof facility.imageData?.coverUrl === 'string' && facility.imageData.coverUrl.length > 0;
  const hasGallery =
    Array.isArray(facility.imageData?.imageList) && facility.imageData.imageList.some((img) => !!img?.url);
  return hasItems || hasCover || hasGallery;
}

/** Mở Google Maps với lộ trình tới điểm đích (ô tô). Hoạt động trên iOS/Android khi có app hoặc trình duyệt. */
function openGoogleMapsDirections(lat: number, lng: number) {
  const dest = encodeURIComponent(`${lat},${lng}`);
  const url = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
  void Linking.openURL(url);
}

type Props = {
  visible: boolean;
  loading: boolean;
  school: SchoolDetail | null;
  isFavourite: boolean;
  consultLoading?: boolean;
  onClose: () => void;
  onToggleFavourite: () => void;
  onContactConsult?: (campusId: number) => void;
  studentPickerVisible?: boolean;
  studentPickerOptions?: ParentStudentProfile[];
  studentPickerCampusName?: string | null;
  onCloseStudentPicker?: () => void;
  onSelectStudent?: (studentProfileId: number) => void;
};

type FacilityItem = NonNullable<NonNullable<SchoolDetail['campusList'][number]['facility']>['itemList']>[number];
type FacilityImage = NonNullable<
  NonNullable<NonNullable<SchoolDetail['campusList'][number]['facility']>['imageData']>['imageList']
>[number];

function normalizeFacilityText(value?: string | null): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchFacilityImageByItem(
  item: FacilityItem,
  imageList: FacilityImage[],
  usedImageIndexes: Set<number>,
  fallbackIndex: number
): FacilityImage | undefined {
  const codeKey = normalizeFacilityText(item.facilityCode);
  const nameKey = normalizeFacilityText(item.name);

  const findUnusedIndex = (predicate: (image: FacilityImage) => boolean) =>
    imageList.findIndex((image, idx) => !usedImageIndexes.has(idx) && predicate(image));

  // 1) Match theo facilityCode trước để giảm sai lệch.
  if (codeKey) {
    const matchedByCode = findUnusedIndex((image) => {
      const imageName = normalizeFacilityText(image.name);
      const imageAltName = normalizeFacilityText(image.altName);
      return imageName === codeKey || imageAltName === codeKey;
    });
    if (matchedByCode >= 0) {
      usedImageIndexes.add(matchedByCode);
      return imageList[matchedByCode];
    }
  }

  // 2) Fallback match theo name/altName.
  if (nameKey) {
    const matchedByName = findUnusedIndex((image) => {
      const imageName = normalizeFacilityText(image.name);
      const imageAltName = normalizeFacilityText(image.altName);
      return (
        imageName === nameKey ||
        imageAltName === nameKey ||
        (!!imageName && nameKey.includes(imageName)) ||
        (!!imageAltName && nameKey.includes(imageAltName))
      );
    });
    if (matchedByName >= 0) {
      usedImageIndexes.add(matchedByName);
      return imageList[matchedByName];
    }
  }

  // 3) Cuối cùng fallback theo index để vẫn có ảnh nếu dữ liệu thiếu key.
  if (!usedImageIndexes.has(fallbackIndex) && imageList[fallbackIndex]) {
    usedImageIndexes.add(fallbackIndex);
    return imageList[fallbackIndex];
  }

  return undefined;
}

function getFacilityItemValueLabel(item: FacilityItem): string | null {
  return formatFacilityValue(item.value, item.unit);
}

function getFacilityItemIcon(item: FacilityItem): string {
  const source = `${item.category ?? ''} ${item.name ?? ''}`.toLowerCase();
  if (source.includes('thư viện')) return 'menu-book';
  if (source.includes('thể thao') || source.includes('sân')) return 'sports-soccer';
  if (source.includes('lab') || source.includes('thí nghiệm')) return 'science';
  if (source.includes('máy tính') || source.includes('computer')) return 'computer';
  return 'meeting-room';
}

function FacilityImageBlock({ imageUrl, height }: { imageUrl?: string | null; height: number }) {
  const [loadingImage, setLoadingImage] = useState(Boolean(imageUrl));
  const imageOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    imageOpacity.setValue(0);
    setLoadingImage(Boolean(imageUrl));
  }, [imageUrl, imageOpacity]);

  const handleImageLoaded = () => {
    setLoadingImage(false);
    Animated.timing(imageOpacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={[styles.facilityImageSkeletonWrap, { height }]}>
      {imageUrl ? (
        <>
          {loadingImage ? (
            <View style={styles.facilityImageSkeleton}>
              <ActivityIndicator size="small" color="#94a3b8" />
            </View>
          ) : null}
          <Animated.Image
            source={{ uri: imageUrl }}
            style={[styles.facilityImage, { opacity: imageOpacity }]}
            resizeMode="cover"
            onLoadStart={() => setLoadingImage(true)}
            onLoadEnd={handleImageLoaded}
          />
        </>
      ) : (
        <View style={styles.facilityItemImageFallback}>
          <MaterialIcons name="image-not-supported" size={18} color="#94a3b8" />
          <Text style={styles.facilityItemImageFallbackText}>Chưa có ảnh</Text>
        </View>
      )}
    </View>
  );
}

function getFacilityImageLabel(image: FacilityImage, index: number): string {
  return image.name?.trim() || image.altName?.trim() || `Ảnh ${index + 1}`;
}

export function SchoolDetailModal({
  visible,
  loading,
  school,
  isFavourite,
  consultLoading = false,
  onClose,
  onToggleFavourite,
  onContactConsult,
  studentPickerVisible = false,
  studentPickerOptions = [],
  studentPickerCampusName = null,
  onCloseStudentPicker,
  onSelectStudent,
}: Props) {
  const [expandedDescription, setExpandedDescription] = useState(false);
  const [expandedCampaign, setExpandedCampaign] = useState<Record<number, boolean>>({});
  const [expandedMethod, setExpandedMethod] = useState<Record<string, boolean>>({});
  const [expandedMandatoryDocs, setExpandedMandatoryDocs] = useState<Record<number, boolean>>({});
  const [expandedCurriculum, setExpandedCurriculum] = useState<Record<string, boolean>>({});
  const [expandedCurriculumDesc, setExpandedCurriculumDesc] = useState<Record<string, boolean>>({});
  const [expandedCurriculumMethods, setExpandedCurriculumMethods] = useState<Record<string, boolean>>({});
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  const [expandedProgram, setExpandedProgram] = useState<Record<string, boolean>>({});
  const [expandedProgramGraduation, setExpandedProgramGraduation] = useState<Record<string, boolean>>({});
  const [expandedCampus, setExpandedCampus] = useState<Record<number, boolean>>({});
  const [distancesKmByCampusId, setDistancesKmByCampusId] = useState<Record<number, number>>({});
  const [campaignTemplates, setCampaignTemplates] = useState<SchoolCampaignTemplate[]>([]);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [apiCurriculumList, setApiCurriculumList] = useState<SchoolDetail['curriculumList']>([]);
  const [apiSchoolContact, setApiSchoolContact] = useState<{
    hotline: string | null;
    emailSupport: string | null;
    websiteUrl: string | null;
  }>({
    hotline: null,
    emailSupport: null,
    websiteUrl: null,
  });
  const [curriculumLoading, setCurriculumLoading] = useState(false);
  const [facilityViewerVisible, setFacilityViewerVisible] = useState(false);
  const [facilityViewerImages, setFacilityViewerImages] = useState<FacilityImage[]>([]);
  const [facilityViewerIndex, setFacilityViewerIndex] = useState(0);
  const [campusPickerVisible, setCampusPickerVisible] = useState(false);
  const facilityViewerListRef = useRef<FlatList<FacilityImage> | null>(null);

  const curriculumList = useMemo(
    () => (apiCurriculumList.length > 0 ? apiCurriculumList : school?.curriculumList ?? []),
    [apiCurriculumList, school?.curriculumList]
  );
  const campusList = useMemo(() => school?.campusList ?? [], [school?.campusList]);
  const consultCampuses = useMemo(() => campusList, [campusList]);
  const displayHotline = apiSchoolContact.hotline ?? school?.hotline ?? null;
  const displayEmailSupport = apiSchoolContact.emailSupport ?? school?.emailSupport ?? null;
  const displayWebsiteUrl = apiSchoolContact.websiteUrl ?? school?.websiteUrl ?? null;

  useEffect(() => {
    if (!visible) {
      setDistancesKmByCampusId({});
      setCampusPickerVisible(false);
    }
  }, [visible]);

  const openFacilityGallery = (images: FacilityImage[], startIndex = 0) => {
    if (images.length === 0) return;
    setFacilityViewerImages(images);
    setFacilityViewerIndex(Math.min(Math.max(startIndex, 0), images.length - 1));
    setFacilityViewerVisible(true);
  };

  const closeFacilityGallery = () => {
    setFacilityViewerVisible(false);
  };

  const activeFacilityImage = facilityViewerImages[facilityViewerIndex];

  useEffect(() => {
    if (!facilityViewerVisible || facilityViewerImages.length === 0) return;
    const timeout = setTimeout(() => {
      facilityViewerListRef.current?.scrollToIndex({
        index: facilityViewerIndex,
        animated: false,
      });
    }, 0);
    return () => clearTimeout(timeout);
  }, [facilityViewerVisible, facilityViewerImages.length, facilityViewerIndex]);

  useEffect(() => {
    if (!visible || !school || loading) return;
    let cancelled = false;
    setDistancesKmByCampusId({});
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted' || cancelled) return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const res = await searchNearbyCampus(
          pos.coords.latitude,
          pos.coords.longitude,
          NEARBY_SEARCH_RADIUS_KM
        );
        if (cancelled) return;
        const allowed = new Set(school.campusList.map((c) => c.id));
        const next: Record<number, number> = {};
        for (const row of res.body) {
          if (allowed.has(row.id)) next[row.id] = row.distance;
        }
        setDistancesKmByCampusId(next);
      } catch {
        if (!cancelled) setDistancesKmByCampusId({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, loading, school?.id]);

  useEffect(() => {
    if (!visible || !school?.id || loading) return;
    let cancelled = false;
    setCampaignLoading(true);
    const year = new Date().getFullYear();
    void fetchSchoolCampaignTemplates(school.id, year)
      .then((res) => {
        if (!cancelled) setCampaignTemplates(res.body);
      })
      .catch(() => {
        if (!cancelled) setCampaignTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setCampaignLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, loading, school?.id]);

  useEffect(() => {
    if (!visible || !school?.id || loading) return;
    let cancelled = false;
    setCurriculumLoading(true);
    void fetchSchoolPublicDetail(school.id)
      .then((res) => {
        if (cancelled) return;
        setApiCurriculumList(Array.isArray(res.body?.curriculumList) ? res.body.curriculumList : []);
        setApiSchoolContact({
          hotline: res.body?.hotline ?? null,
          emailSupport: res.body?.emailSupport ?? null,
          websiteUrl: res.body?.websiteUrl ?? null,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setApiCurriculumList([]);
          setApiSchoolContact({
            hotline: null,
            emailSupport: null,
            websiteUrl: null,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setCurriculumLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, loading, school?.id]);

  return (
    <>
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
                <View style={styles.metaRow}>
                  <MaterialIcons name="phone" size={16} color="#2563eb" />
                  {displayHotline ? (
                    <Pressable onPress={() => Linking.openURL(`tel:${displayHotline}`)}>
                      <Text style={styles.link}>{displayHotline}</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.meta}>Hotline: Đang cập nhật</Text>
                  )}
                </View>
                <View style={styles.metaRow}>
                  <MaterialIcons name="email" size={16} color="#2563eb" />
                  {displayEmailSupport ? (
                    <Pressable onPress={() => Linking.openURL(`mailto:${displayEmailSupport}`)}>
                      <Text style={styles.link} numberOfLines={1}>
                        {displayEmailSupport}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.meta}>Email: Đang cập nhật</Text>
                  )}
                </View>
                <View style={styles.metaRow}>
                  <MaterialIcons name="language" size={16} color="#2563eb" />
                  {displayWebsiteUrl ? (
                    <Pressable onPress={() => Linking.openURL(String(displayWebsiteUrl))}>
                      <Text style={styles.link} numberOfLines={1}>
                        {displayWebsiteUrl}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.meta}>Website: Đang cập nhật</Text>
                  )}
                </View>
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
                <Text style={styles.sectionTitle}>Danh sách cơ sở</Text>
                {campusList.length === 0 ? (
                  <Text style={styles.sectionText}>Nhà trường chưa cập nhật thông tin cơ sở.</Text>
                ) : (
                  campusList.map((campus) => {
                    const expanded = !!expandedCampus[campus.id];
                    return (
                      <View key={campus.id} style={styles.campusCard}>
                        <Pressable
                          onPress={() =>
                            setExpandedCampus((prev) => ({ ...prev, [campus.id]: !prev[campus.id] }))
                          }
                        >
                          <View style={styles.campusHeaderRow}>
                            <View style={styles.campusTitleCol}>
                              <Text style={styles.campusName}>{campus.name}</Text>
                              {distancesKmByCampusId[campus.id] != null ? (
                                <Text style={styles.campusDistance}>
                                  Cách bạn: {formatKm(distancesKmByCampusId[campus.id]!)}
                                </Text>
                              ) : null}
                            </View>
                            <MaterialIcons
                              name={expanded ? 'expand-less' : 'expand-more'}
                              size={22}
                              color="#64748b"
                            />
                          </View>
                        </Pressable>

                        {expanded ? (
                          <>
                            {campus.address ? (
                              <View style={styles.metaRow}>
                                <MaterialIcons name="place" size={16} color="#64748b" />
                                <Text style={styles.meta}>{campus.address}</Text>
                              </View>
                            ) : null}

                            {(campus.ward || campus.district || campus.city) ? (
                              <View style={styles.metaRow}>
                                <MaterialIcons name="location-city" size={16} color="#64748b" />
                                <Text style={styles.meta}>
                                  {[campus.ward, campus.district, campus.city].filter(Boolean).join(', ')}
                                </Text>
                              </View>
                            ) : null}

                            {typeof campus.latitude === 'number' && typeof campus.longitude === 'number' ? (
                              <Pressable
                                onPress={() => openGoogleMapsDirections(campus.latitude!, campus.longitude!)}
                                style={styles.campusMiniMapWrap}
                              >
                                {Platform.OS === 'android' ? (
                                  <View style={styles.campusMapFallback}>
                                    <MaterialIcons name="map" size={18} color="#1976d2" />
                                    <Text style={styles.campusMapFallbackText}>Mở Google Maps để xem vị trí</Text>
                                  </View>
                                ) : (
                                  <MapView
                                    style={styles.campusMiniMap}
                                    pointerEvents="none"
                                    scrollEnabled={false}
                                    rotateEnabled={false}
                                    zoomEnabled={false}
                                    pitchEnabled={false}
                                    initialRegion={{
                                      latitude: campus.latitude,
                                      longitude: campus.longitude,
                                      latitudeDelta: 0.01,
                                      longitudeDelta: 0.01,
                                    }}
                                  >
                                    <Marker
                                      coordinate={{
                                        latitude: campus.latitude,
                                        longitude: campus.longitude,
                                      }}
                                    />
                                  </MapView>
                                )}
                                <View style={styles.mapTapHint} pointerEvents="none">
                                  <MaterialIcons name="directions" size={16} color="#fff" />
                                  <Text style={styles.mapTapHintText}>Chạm để chỉ đường (Google Maps)</Text>
                                </View>
                              </Pressable>
                            ) : null}

                            {campus.phoneNumber ? (
                              <Pressable
                                onPress={() => Linking.openURL(`tel:${campus.phoneNumber}`)}
                                style={styles.metaRow}
                              >
                                <MaterialIcons name="phone" size={16} color="#2563eb" />
                                <Text style={styles.link}>{campus.phoneNumber}</Text>
                              </Pressable>
                            ) : null}

                            {campus.consultantEmails.map((email) => (
                              <Pressable
                                key={`${campus.id}-${email}`}
                                onPress={() => Linking.openURL(`mailto:${email}`)}
                                style={styles.metaRow}
                              >
                                <MaterialIcons name="email" size={16} color="#2563eb" />
                                <Text style={styles.link} numberOfLines={1}>
                                  {email}
                                </Text>
                              </Pressable>
                            ))}

                            {hasFacilityData(campus.facility) ? (
                              <View style={styles.facilityWrap}>
                                <View style={styles.facilityHeaderRow}>
                                  <View style={styles.facilityHeaderTitleRow}>
                                    <MaterialIcons name="apartment" size={18} color="#1976d2" />
                                    <Text style={styles.facilityTitle}>Cơ sở vật chất</Text>
                                  </View>
                                </View>

                                {(() => {
                                  const galleryImages = Array.isArray(campus.facility?.imageData?.imageList)
                                    ? campus.facility.imageData.imageList.filter(
                                        (img): img is FacilityImage => typeof img?.url === 'string' && img.url.length > 0
                                      )
                                    : [];
                                  const totalImages = galleryImages.length;
                                  const overflowCount = Math.max(0, totalImages - 2);
                                  const previewImages = galleryImages.slice(0, 4);

                                  if (totalImages === 0) return null;

                                  if (totalImages === 1) {
                                    return (
                                      <Pressable
                                        onPress={() => openFacilityGallery(galleryImages, 0)}
                                        style={({ pressed }) => [styles.facilityGallerySingle, pressed && styles.facilityCardPressed]}
                                      >
                                        <FacilityImageBlock imageUrl={galleryImages[0].url} height={210} />
                                        <View style={styles.facilityImageNameOverlay}>
                                          <Text numberOfLines={1} style={styles.facilityImageNameText}>
                                            {getFacilityImageLabel(galleryImages[0], 0)}
                                          </Text>
                                        </View>
                                        <View style={styles.facilityImageBadge}>
                                          <MaterialIcons name="photo-library" size={14} color="#fff" />
                                          <Text style={styles.facilityImageBadgeText}>{`${totalImages} ảnh`}</Text>
                                        </View>
                                      </Pressable>
                                    );
                                  }

                                  if (totalImages === 2) {
                                    return (
                                      <View style={styles.facilityGalleryGridTwo}>
                                        {galleryImages.map((image, idx) => (
                                          <Pressable
                                            key={`${campus.id}-gallery-${image.url ?? idx}`}
                                            onPress={() => openFacilityGallery(galleryImages, idx)}
                                            style={({ pressed }) => [
                                              styles.facilityGalleryGridTwoItem,
                                              pressed && styles.facilityCardPressed,
                                            ]}
                                          >
                                            <FacilityImageBlock imageUrl={image.url} height={132} />
                                            <View style={styles.facilityImageNameOverlay}>
                                              <Text numberOfLines={1} style={styles.facilityImageNameText}>
                                                {getFacilityImageLabel(image, idx)}
                                              </Text>
                                            </View>
                                            {idx === 0 ? (
                                              <View style={styles.facilityImageBadge}>
                                                <MaterialIcons name="photo-library" size={14} color="#fff" />
                                                <Text style={styles.facilityImageBadgeText}>{`${totalImages} ảnh`}</Text>
                                              </View>
                                            ) : null}
                                          </Pressable>
                                        ))}
                                      </View>
                                    );
                                  }

                                  return (
                                    <View style={styles.facilityGalleryGridFour}>
                                      {previewImages.map((image, idx) => {
                                        const isOverflowTile = overflowCount > 0 && idx === previewImages.length - 1;
                                        return (
                                          <Pressable
                                            key={`${campus.id}-gallery-${image.url ?? idx}`}
                                            onPress={() => openFacilityGallery(galleryImages, idx)}
                                            style={({ pressed }) => [
                                              styles.facilityGalleryGridFourItem,
                                              pressed && styles.facilityCardPressed,
                                            ]}
                                          >
                                            <FacilityImageBlock imageUrl={image.url} height={110} />
                                            <View style={styles.facilityImageNameOverlay}>
                                              <Text numberOfLines={1} style={styles.facilityImageNameText}>
                                                {getFacilityImageLabel(image, idx)}
                                              </Text>
                                            </View>
                                            {idx === 0 ? (
                                              <View style={styles.facilityImageBadge}>
                                                <MaterialIcons name="photo-library" size={14} color="#fff" />
                                                <Text style={styles.facilityImageBadgeText}>{`${totalImages} ảnh`}</Text>
                                              </View>
                                            ) : null}
                                            {isOverflowTile ? (
                                              <View style={styles.facilityImageOverflowOverlay}>
                                                <MaterialIcons name="photo-library" size={16} color="#fff" />
                                                <Text style={styles.facilityImageOverflowText}>{`+${overflowCount}`}</Text>
                                              </View>
                                            ) : null}
                                          </Pressable>
                                        );
                                      })}
                                    </View>
                                  );
                                })()}
                                {Array.isArray(campus.facility?.imageData?.imageList) &&
                                campus.facility.imageData.imageList.length === 0 &&
                                campus.facility?.imageData?.coverUrl ? (
                                  <Pressable
                                    onPress={() =>
                                      openFacilityGallery([{ url: campus.facility!.imageData!.coverUrl!, name: 'Ảnh cơ sở' }])
                                    }
                                    style={({ pressed }) => [styles.facilityGallerySingle, pressed && styles.facilityCardPressed]}
                                  >
                                    <FacilityImageBlock imageUrl={campus.facility.imageData.coverUrl} height={210} />
                                    <View style={styles.facilityImageNameOverlay}>
                                      <Text numberOfLines={1} style={styles.facilityImageNameText}>
                                        Ảnh cơ sở
                                      </Text>
                                    </View>
                                    <View style={styles.facilityImageBadge}>
                                      <MaterialIcons name="photo" size={14} color="#fff" />
                                      <Text style={styles.facilityImageBadgeText}>Ảnh cơ sở</Text>
                                    </View>
                                  </Pressable>
                                ) : null}
                              </View>
                            ) : null}
                          </>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Chiến dịch tuyển sinh</Text>
                {campaignLoading ? <Text style={styles.sectionText}>Đang tải chiến dịch tuyển sinh...</Text> : null}
                {!campaignLoading && campaignTemplates.length === 0 ? (
                  <Text style={styles.sectionText}>Nhà trường chưa cập nhật chiến dịch tuyển sinh.</Text>
                ) : null}
                {campaignTemplates.map((campaign) => {
                  const expanded = !!expandedCampaign[campaign.id];
                  const isOpen = campaign.status === 'OPEN_ADMISSION_CAMPAIGN';
                  const statusPill = badgePillStyle({
                    bg: isOpen ? '#dcfce7' : '#fee2e2',
                    text: isOpen ? '#15803d' : '#b91c1c',
                  });
                  const mandatoryExpanded = !!expandedMandatoryDocs[campaign.id];
                  const mandatoryItems = mandatoryExpanded ? campaign.mandatoryAll : campaign.mandatoryAll.slice(0, 3);
                  return (
                    <View key={campaign.id} style={styles.campaignCard}>
                      <Pressable
                        onPress={() => setExpandedCampaign((prev) => ({ ...prev, [campaign.id]: !prev[campaign.id] }))}
                      >
                        <View style={styles.curriculumHeaderRow}>
                          <Text style={styles.curriculumName}>{campaign.name}</Text>
                          <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={22} color="#64748b" />
                        </View>
                        <View style={styles.badgeRow}>
                          <View style={statusPill.wrap}>
                            <Text style={statusPill.text}>{isOpen ? 'ĐANG MỞ' : 'ĐÃ ĐÓNG'}</Text>
                          </View>
                        </View>
                        <Text style={styles.metaSmall}>Năm: {campaign.year}</Text>
                        <Text style={styles.metaSmall}>
                          {formatIsoDateRange(campaign.startDate, campaign.endDate)}
                        </Text>
                        {campaign.description ? (
                          <Text numberOfLines={expanded ? undefined : 1} style={styles.sectionText}>
                            Mô tả: {stripBasicHtml(campaign.description)}
                          </Text>
                        ) : null}
                      </Pressable>
                      {expanded ? (
                        <View style={styles.curriculumBody}>
                          <Text style={styles.programSectionTitle}>Phương thức tuyển sinh</Text>
                          {campaign.admissionMethodDetails.map((method) => {
                            const methodKey = `${campaign.id}-${method.methodCode}`;
                            const methodExpanded = !!expandedMethod[methodKey];
                            return (
                              <View key={methodKey} style={styles.methodCard}>
                                <Pressable
                                  onPress={() => setExpandedMethod((prev) => ({ ...prev, [methodKey]: !prev[methodKey] }))}
                                >
                                  <View style={styles.programHeaderRow}>
                                    <Text style={styles.programName}>{method.displayName}</Text>
                                    <MaterialIcons
                                      name={methodExpanded ? 'expand-less' : 'expand-more'}
                                      size={20}
                                      color="#64748b"
                                    />
                                  </View>
                                  <Text style={styles.metaSmall}>
                                    {formatArrayDate(method.startDate)} - {formatArrayDate(method.endDate)}
                                  </Text>
                                  {method.allowReservationSubmission ? (
                                    <Text style={styles.methodReservationTag}>Cho phép giữ chỗ</Text>
                                  ) : null}
                                </Pressable>
                                {methodExpanded ? (
                                  <View style={styles.methodBody}>
                                    {method.description ? <Text style={styles.sectionText}>{method.description}</Text> : null}
                                    {method.admissionProcessSteps.length > 0 ? (
                                      <View style={styles.stepsWrap}>
                                        <Text style={styles.programSubLabel}>Quy trình</Text>
                                        {method.admissionProcessSteps
                                          .slice()
                                          .sort((a, b) => a.stepOrder - b.stepOrder)
                                          .map((step) => (
                                            <View key={`${methodKey}-step-${step.stepOrder}`} style={styles.stepItem}>
                                              <View style={styles.stepDot} />
                                              <View style={styles.stepContent}>
                                                <Text style={styles.stepTitle}>
                                                  Bước {step.stepOrder}: {step.stepName}
                                                </Text>
                                                {step.description ? (
                                                  <Text style={styles.subjectDesc}>{step.description}</Text>
                                                ) : null}
                                              </View>
                                            </View>
                                          ))}
                                      </View>
                                    ) : null}
                                    {method.methodDocumentRequirements.length > 0 ? (
                                      <View style={styles.programSection}>
                                        <Text style={styles.programSubLabel}>Hồ sơ theo phương thức</Text>
                                        {method.methodDocumentRequirements.map((doc) => (
                                          <View key={`${methodKey}-doc-${doc.code}`} style={styles.docItemRow}>
                                            <MaterialIcons
                                              name={doc.required ? 'check-circle' : 'radio-button-unchecked'}
                                              size={16}
                                              color={doc.required ? '#dc2626' : '#94a3b8'}
                                            />
                                            <Text style={styles.docItemText}>{doc.name}</Text>
                                          </View>
                                        ))}
                                      </View>
                                    ) : null}
                                  </View>
                                ) : null}
                              </View>
                            );
                          })}
                          {campaign.mandatoryAll.length > 0 ? (
                            <View style={styles.programSection}>
                              <Text style={styles.programSectionTitle}>Hồ sơ bắt buộc</Text>
                              {mandatoryItems.map((doc) => (
                                <View key={`${campaign.id}-mandatory-${doc.code}`} style={styles.docItemRow}>
                                  <MaterialIcons name="description" size={16} color="#ef4444" />
                                  <Text style={styles.docItemText}>{doc.name}</Text>
                                </View>
                              ))}
                              {campaign.mandatoryAll.length > 3 ? (
                                <Pressable
                                  onPress={() =>
                                    setExpandedMandatoryDocs((prev) => ({ ...prev, [campaign.id]: !prev[campaign.id] }))
                                  }
                                >
                                  <Text style={styles.expandText}>{mandatoryExpanded ? 'Thu gọn' : 'Xem thêm'}</Text>
                                </Pressable>
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Chương trình học</Text>
                {curriculumLoading ? (
                  <Text style={styles.sectionText}>Đang tải chương trình học...</Text>
                ) : null}
                {!curriculumLoading && curriculumList.length === 0 ? (
                  <Text style={styles.sectionText}>Nhà trường chưa cập nhật chương trình học.</Text>
                ) : null}
                {curriculumList.map((curriculum) => {
                  const key = curriculum.groupCode || curriculum.name;
                  const expanded = !!expandedCurriculum[key];
                  const typePill = badgePillStyle(getCurriculumTypeBadgeColors(curriculum.curriculumType));
                  const statusPill = badgePillStyle(getCurriculumStatusBadgeColors(curriculum.curriculumStatus));
                  const methodExpanded = !!expandedCurriculumMethods[key];
                  const methodItems = methodExpanded
                    ? curriculum.methodLearningList
                    : curriculum.methodLearningList.slice(0, 3);
                  const methodOverflow = Math.max(0, curriculum.methodLearningList.length - 3);
                  const descExpanded = !!expandedCurriculumDesc[key];
                  const subjectsExpanded = !!expandedSubjects[key];
                  const subjects = subjectsExpanded ? curriculum.subjectsJsonb : curriculum.subjectsJsonb.slice(0, 3);
                  return (
                    <View key={key} style={styles.curriculumCard}>
                      <Pressable onPress={() => setExpandedCurriculum((prev) => ({ ...prev, [key]: !prev[key] }))}>
                        <View style={styles.curriculumHeaderRow}>
                          <Text style={styles.curriculumName}>{curriculum.name}</Text>
                          <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={22} color="#64748b" />
                        </View>
                        <Text style={styles.metaSmall}>Năm tuyển sinh: {curriculum.applicationYear || '—'}</Text>
                        <View style={styles.badgeRow}>
                          <View style={typePill.wrap}>
                            <Text style={typePill.text}>{getCurriculumTypeLabel(curriculum.curriculumType)}</Text>
                          </View>
                          <View style={statusPill.wrap}>
                            <Text style={statusPill.text}>{getCurriculumStatusLabel(curriculum.curriculumStatus)}</Text>
                          </View>
                        </View>
                      </Pressable>
                      {expanded ? (
                        <View style={styles.curriculumBody}>
                          {curriculum.methodLearningList.length > 0 ? (
                            <View style={styles.programSection}>
                              <Text style={styles.programSectionTitle}>Phương pháp học</Text>
                              <View style={styles.methodBadgeRow}>
                                {methodItems.map((method) => {
                                  const methodPill = badgePillStyle(getMethodLearningBadgeColors(method));
                                  return (
                                    <View key={`${key}-method-${method}`} style={methodPill.wrap}>
                                      <Text style={methodPill.text}>{getMethodLearningLabel(method)}</Text>
                                    </View>
                                  );
                                })}
                                {!methodExpanded && methodOverflow > 0 ? (
                                  <Pressable
                                    style={styles.moreChip}
                                    onPress={() => setExpandedCurriculumMethods((prev) => ({ ...prev, [key]: true }))}
                                  >
                                    <Text style={styles.moreChipText}>+{methodOverflow}</Text>
                                  </Pressable>
                                ) : null}
                              </View>
                            </View>
                          ) : null}
                          {curriculum.description ? (
                            <View style={styles.programSection}>
                              <Text style={styles.programSectionTitle}>Mô tả</Text>
                              <Text numberOfLines={descExpanded ? undefined : 3} style={styles.sectionText}>
                                {curriculum.description}
                              </Text>
                              <Pressable
                                onPress={() =>
                                  setExpandedCurriculumDesc((prev) => ({ ...prev, [key]: !prev[key] }))
                                }
                              >
                                <Text style={styles.expandText}>{descExpanded ? 'Thu gọn' : 'Xem thêm'}</Text>
                              </Pressable>
                            </View>
                          ) : null}
                          {curriculum.programList.length > 0 ? (
                            <View style={styles.programSection}>
                              <Text style={styles.programSectionTitle}>Danh sách chương trình đào tạo</Text>
                              {curriculum.programList.map((program, pi) => {
                                const programKey = `${key}-prog-${pi}`;
                                const programExpanded = !!expandedProgram[programKey];
                                const graduationExpanded = !!expandedProgramGraduation[programKey];
                                const activeColors = program.isActive ? getProgramActiveBadgeColors(program.isActive) : null;
                                const activePill = activeColors ? badgePillStyle(activeColors) : null;
                                const tuitionLabel = formatTuitionVnd(program.baseTuitionFee);
                                return (
                                  <View key={programKey} style={styles.programCard}>
                                    <Pressable
                                      onPress={() => setExpandedProgram((prev) => ({ ...prev, [programKey]: !prev[programKey] }))}
                                    >
                                      <View style={styles.programHeaderRow}>
                                        <Text style={styles.programName}>{(program.name ?? '').trim() || 'Chương trình'}</Text>
                                        <View style={styles.programHeaderActions}>
                                          {activePill && program.isActive ? (
                                            <View style={activePill.wrap}>
                                              <Text style={activePill.text}>{getProgramActiveLabel(program.isActive)}</Text>
                                            </View>
                                          ) : null}
                                          <MaterialIcons
                                            name={programExpanded ? 'expand-less' : 'expand-more'}
                                            size={20}
                                            color="#64748b"
                                          />
                                        </View>
                                      </View>
                                      {tuitionLabel ? <Text style={styles.programTuition}>Học phí: {tuitionLabel}</Text> : null}
                                      {program.targetStudentDescription ? (
                                        <>
                                          <Text style={styles.studentTargetLabel}>Đối tượng học sinh</Text>
                                          <Text numberOfLines={programExpanded ? undefined : 1} style={styles.programBodyText}>
                                            {stripBasicHtml(program.targetStudentDescription)}
                                          </Text>
                                        </>
                                      ) : null}
                                    </Pressable>
                                    {programExpanded && program.graduationStandard ? (
                                      <>
                                        <Pressable
                                          style={styles.graduationHeader}
                                          onPress={() =>
                                            setExpandedProgramGraduation((prev) => ({
                                              ...prev,
                                              [programKey]: !prev[programKey],
                                            }))
                                          }
                                        >
                                          <Text style={styles.programSubLabel}>Tiêu chuẩn đầu ra</Text>
                                          <MaterialIcons
                                            name={graduationExpanded ? 'expand-less' : 'expand-more'}
                                            size={18}
                                            color="#64748b"
                                          />
                                        </Pressable>
                                        {graduationExpanded ? (
                                          <Text style={styles.programBodyText}>{stripBasicHtml(program.graduationStandard)}</Text>
                                        ) : null}
                                      </>
                                    ) : null}
                                  </View>
                                );
                              })}
                            </View>
                          ) : null}
                          {curriculum.subjectsJsonb.length > 0 ? (
                            <View style={styles.programSection}>
                              <Text style={styles.programSectionTitle}>Môn học</Text>
                              {subjects.map((subject) => (
                                <View key={`${key}-${subject.name}`} style={styles.subjectItem}>
                                  <View style={styles.subjectTitleRow}>
                                    <MaterialIcons
                                      name={subject.isMandatory ? 'check-circle' : 'radio-button-unchecked'}
                                      size={18}
                                      color={subject.isMandatory ? '#16a34a' : '#94a3b8'}
                                    />
                                    <Text style={styles.subjectName}>{subject.name}</Text>
                                  </View>
                                  {subject.description ? <Text style={styles.subjectDesc}>{subject.description}</Text> : null}
                                </View>
                              ))}
                              {curriculum.subjectsJsonb.length > 3 ? (
                                <Pressable
                                  onPress={() => setExpandedSubjects((prev) => ({ ...prev, [key]: !prev[key] }))}
                                >
                                  <Text style={styles.expandText}>
                                    {subjectsExpanded ? 'Thu gọn môn học' : 'Xem tất cả môn học'}
                                  </Text>
                                </Pressable>
                              ) : null}
                            </View>
                          ) : null}
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
              if (onContactConsult) {
                setCampusPickerVisible(true);
                return;
              }
              if (school?.hotline) {
                void Linking.openURL(`tel:${school.hotline}`);
              }
            }}
            disabled={consultLoading}
            style={[styles.bottomCta, consultLoading && styles.bottomCtaDisabled]}
          >
            {consultLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialIcons name="phone-in-talk" size={20} color="#fff" style={styles.bottomCtaIcon} />
            )}
            <Text style={styles.bottomCtaText}>
              {consultLoading ? 'Đang kết nối tư vấn...' : 'Liên hệ tư vấn'}
            </Text>
          </Pressable>
        </View>
        <Modal
          visible={campusPickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCampusPickerVisible(false)}
        >
          <Pressable style={styles.campusPickerBackdrop} onPress={() => setCampusPickerVisible(false)}>
            <Pressable style={styles.campusPickerCard} onPress={() => {}}>
              <View style={styles.campusPickerHeader}>
                <Text style={styles.campusPickerTitle}>Chọn cơ sở muốn tư vấn</Text>
                <Pressable onPress={() => setCampusPickerVisible(false)} hitSlop={8}>
                  <MaterialIcons name="close" size={20} color="#64748b" />
                </Pressable>
              </View>
              {consultCampuses.length === 0 ? (
                <Text style={styles.campusPickerEmptyText}>Trường chưa cập nhật danh sách cơ sở.</Text>
              ) : (
                consultCampuses.map((campus) => (
                  <Pressable
                    key={`consult-campus-${campus.id}`}
                    style={({ pressed }) => [
                      styles.campusPickerItem,
                      pressed && styles.campusPickerItemPressed,
                      !campus.consultantEmails.some((email) => email?.trim()) && styles.campusPickerItemDisabled,
                    ]}
                    disabled={consultLoading || !campus.consultantEmails.some((email) => email?.trim())}
                    onPress={() => {
                      if (!onContactConsult) return;
                      setCampusPickerVisible(false);
                      onContactConsult(campus.id);
                    }}
                  >
                    <Text style={styles.campusPickerItemName}>{campus.name}</Text>
                    {campus.address ? (
                      <Text style={styles.campusPickerItemAddress} numberOfLines={2}>
                        {campus.address}
                      </Text>
                    ) : null}
                    {!campus.consultantEmails.some((email) => email?.trim()) ? (
                      <Text style={styles.campusPickerItemHint}>Chưa có tư vấn viên cho cơ sở này</Text>
                    ) : null}
                  </Pressable>
                ))
              )}
            </Pressable>
          </Pressable>
        </Modal>
        <Modal
          visible={studentPickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (consultLoading) return;
            onCloseStudentPicker?.();
          }}
        >
          <Pressable style={styles.studentPickerBackdrop} onPress={() => (consultLoading ? null : onCloseStudentPicker?.())}>
            <Pressable style={styles.studentPickerCard} onPress={() => {}}>
              <View style={styles.studentPickerHeader}>
                <Text style={styles.studentPickerTitle}>Chọn học sinh để nhắn tin</Text>
                <Pressable disabled={consultLoading} onPress={onCloseStudentPicker} hitSlop={8}>
                  <MaterialIcons name="close" size={20} color="#64748b" />
                </Pressable>
              </View>
              <Text style={styles.studentPickerSubtitle}>
                {studentPickerCampusName?.trim()
                  ? `Cơ sở đã chọn: ${studentPickerCampusName.trim()}`
                  : 'Vui lòng chọn hồ sơ học sinh bạn muốn tư vấn.'}
              </Text>
              {studentPickerOptions.map((student) => {
                const studentId = Number(student.id);
                const isPressDisabled = consultLoading || !Number.isFinite(studentId);
                return (
                  <Pressable
                    key={`student-picker-${student.id}`}
                    disabled={isPressDisabled}
                    style={({ pressed }) => [
                      styles.studentPickerItem,
                      pressed && !isPressDisabled && styles.studentPickerItemPressed,
                    ]}
                    onPress={() => {
                      if (!Number.isFinite(studentId)) return;
                      onSelectStudent?.(studentId);
                    }}
                  >
                    <Text style={styles.studentPickerName}>
                      {student.studentName?.trim() || `Học sinh #${student.id}`}
                    </Text>
                    {student.personalityTypeCode ? (
                      <Text style={styles.studentPickerMeta}>
                        Nhóm tính cách: {student.personalityTypeCode}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
              {consultLoading ? (
                <View style={styles.studentPickerLoading}>
                  <ActivityIndicator size="small" color="#1976d2" />
                  <Text style={styles.studentPickerLoadingText}>Đang kết nối tư vấn...</Text>
                </View>
              ) : null}
            </Pressable>
          </Pressable>
        </Modal>
        {facilityViewerVisible ? (
          <View style={styles.facilityViewerBackdrop}>
            <Pressable style={styles.facilityViewerCloseBtn} onPress={closeFacilityGallery}>
              <MaterialIcons name="close" size={24} color="#fff" />
            </Pressable>
            <View style={styles.facilityViewerImageWrap}>
              <FlatList
                ref={facilityViewerListRef}
                data={facilityViewerImages}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item, index) => `${item.url ?? 'image'}-${index}`}
                getItemLayout={(_, index) => ({
                  length: SCREEN_WIDTH,
                  offset: SCREEN_WIDTH * index,
                  index,
                })}
                initialScrollIndex={facilityViewerIndex}
                onMomentumScrollEnd={(event) => {
                  const nextIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                  if (nextIndex !== facilityViewerIndex) setFacilityViewerIndex(nextIndex);
                }}
                renderItem={({ item }) => (
                  <View style={styles.facilityViewerPage}>
                    {item.url ? (
                      <Image source={{ uri: item.url }} style={styles.facilityViewerImage} resizeMode="contain" />
                    ) : null}
                  </View>
                )}
              />
            </View>
            <View style={styles.facilityViewerFooter}>
              <Text numberOfLines={1} style={styles.facilityViewerTitle}>
                {activeFacilityImage ? getFacilityImageLabel(activeFacilityImage, facilityViewerIndex) : ''}
              </Text>
              <Text style={styles.facilityViewerIndex}>
                {facilityViewerImages.length > 0 ? `${facilityViewerIndex + 1}/${facilityViewerImages.length}` : ''}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
      </Modal>
    </>
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
  campusCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  campusName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  campusTitleCol: { flex: 1 },
  campusDistance: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#1976d2',
  },
  campusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  campusMiniMapWrap: {
    marginTop: 10,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  campusMiniMap: {
    height: 140,
    width: '100%',
  },
  campusMapFallback: {
    height: 140,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    gap: 8,
  },
  campusMapFallbackText: { color: '#0f172a', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  mapTapHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  mapTapHintText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  facilityWrap: {
    marginTop: 10,
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    gap: 10,
  },
  facilityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  facilityHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  facilityTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  facilityViewAll: { fontSize: 12, fontWeight: '700', color: '#1976d2' },
  facilityGallerySingle: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  facilityGalleryGridTwo: {
    flexDirection: 'row',
    gap: 8,
  },
  facilityGalleryGridTwoItem: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  facilityGalleryGridFour: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  facilityGalleryGridFourItem: {
    width: '49%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  facilityImageSkeletonWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
  },
  facilityImageSkeleton: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
    zIndex: 2,
  },
  facilityImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e2e8f0',
  },
  facilityImageNameOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  facilityImageNameText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  facilityImageBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  facilityImageBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  facilityImageOverflowOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  facilityImageOverflowText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  facilityViewerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.96)',
    justifyContent: 'center',
    zIndex: 30,
  },
  facilityViewerCloseBtn: {
    position: 'absolute',
    top: HEADER_TOP,
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    zIndex: 2,
  },
  facilityViewerImageWrap: {
    width: '100%',
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingBottom: 56,
  },
  facilityViewerPage: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  facilityViewerImage: {
    width: '100%',
    height: 420,
  },
  facilityViewerFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 22,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
  },
  facilityViewerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  facilityViewerIndex: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  facilityViewAllPhotosBtn: {
    alignSelf: 'flex-start',
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  facilityViewAllPhotosText: {
    color: '#1976d2',
    fontSize: 12,
    fontWeight: '700',
  },
  facilityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  facilityItemCard: {
    width: '48.5%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  facilityCardPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  facilityItemBody: {
    padding: 9,
    gap: 4,
  },
  facilityItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  facilityItemTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: '#0f172a' },
  facilityItemValue: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  facilityHighlightBadge: {
    marginTop: 2,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#dbeafe',
  },
  facilityHighlightBadgeText: { fontSize: 10, color: '#1d4ed8', fontWeight: '700' },
  facilityItemImageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  facilityItemImageFallbackText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  facilityEmptyState: {
    marginTop: 8,
    minHeight: 92,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  facilityEmptyText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
  },
  curriculumCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  campaignCard: {
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    backgroundColor: '#f8fbff',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
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
  methodBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  curriculumBody: { marginTop: 10, gap: 8 },
  methodCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    padding: 10,
    gap: 8,
  },
  methodReservationTag: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    fontSize: 12,
    fontWeight: '700',
  },
  methodBody: {
    gap: 8,
  },
  stepsWrap: {
    gap: 8,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  stepDot: {
    marginTop: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1976d2',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  docItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  docItemText: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  programSection: { marginTop: 4, gap: 10 },
  programSectionTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  programCard: {
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  programHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  programHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  programName: { fontSize: 14, fontWeight: '700', color: '#0f172a', flex: 1 },
  programTuition: { fontSize: 13, fontWeight: '600', color: '#0369a1' },
  graduationHeader: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  programSubLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 4 },
  studentTargetLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 8 },
  programBodyText: { fontSize: 13, color: '#475569', lineHeight: 19 },
  moreChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#e3f2fd',
  },
  moreChipText: {
    color: '#1976d2',
    fontSize: 12,
    fontWeight: '700',
  },
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
  bottomCtaDisabled: {
    opacity: 0.85,
  },
  bottomCtaIcon: { marginRight: 2 },
  bottomCtaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  campusPickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  campusPickerCard: {
    width: '100%',
    maxWidth: 430,
    maxHeight: '70%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  campusPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  campusPickerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#0f172a' },
  campusPickerEmptyText: { color: '#64748b', fontSize: 14, lineHeight: 20 },
  campusPickerItem: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    gap: 4,
    backgroundColor: '#fff',
  },
  campusPickerItemDisabled: {
    opacity: 0.6,
  },
  campusPickerItemPressed: { backgroundColor: '#f8fafc' },
  campusPickerItemName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  campusPickerItemAddress: { fontSize: 13, color: '#64748b', lineHeight: 18 },
  campusPickerItemHint: { marginTop: 4, fontSize: 12, color: '#b45309', fontWeight: '600' },
  studentPickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  studentPickerCard: {
    width: '100%',
    maxWidth: 430,
    maxHeight: '70%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  studentPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  studentPickerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  studentPickerSubtitle: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 4,
  },
  studentPickerItem: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    gap: 4,
    backgroundColor: '#fff',
  },
  studentPickerItemPressed: { backgroundColor: '#f8fafc' },
  studentPickerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  studentPickerMeta: {
    fontSize: 13,
    color: '#64748b',
  },
  studentPickerLoading: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  studentPickerLoadingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1976d2',
  },
});
