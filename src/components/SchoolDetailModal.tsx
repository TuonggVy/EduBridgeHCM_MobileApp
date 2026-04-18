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
import { searchNearbyCampus } from '../api/school';
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
  onContactConsult?: () => void;
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
}: Props) {
  const [expandedDescription, setExpandedDescription] = useState(false);
  const [expandedCurriculum, setExpandedCurriculum] = useState<Record<string, boolean>>({});
  const [expandedCampus, setExpandedCampus] = useState<Record<number, boolean>>({});
  const [distancesKmByCampusId, setDistancesKmByCampusId] = useState<Record<number, number>>({});
  const [facilityViewerVisible, setFacilityViewerVisible] = useState(false);
  const [facilityViewerImages, setFacilityViewerImages] = useState<FacilityImage[]>([]);
  const [facilityViewerIndex, setFacilityViewerIndex] = useState(0);
  const facilityViewerListRef = useRef<FlatList<FacilityImage> | null>(null);

  const curriculumList = useMemo(() => school?.curriculumList ?? [], [school?.curriculumList]);
  const campusList = useMemo(() => school?.campusList ?? [], [school?.campusList]);

  useEffect(() => {
    if (!visible) {
      setDistancesKmByCampusId({});
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
                {school.hotline ? (
                  <Pressable onPress={() => Linking.openURL(`tel:${school.hotline}`)} style={styles.metaRow}>
                    <MaterialIcons name="phone" size={16} color="#2563eb" />
                    <Text style={styles.link}>{school.hotline}</Text>
                  </Pressable>
                ) : null}
                {school.emailSupport ? (
                  <Pressable onPress={() => Linking.openURL(`mailto:${school.emailSupport}`)} style={styles.metaRow}>
                    <MaterialIcons name="email" size={16} color="#2563eb" />
                    <Text style={styles.link} numberOfLines={1}>
                      {school.emailSupport}
                    </Text>
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
                <Text style={styles.sectionTitle}>Chương trình đào tạo</Text>
                {curriculumList.map((curriculum) => {
                  const key = curriculum.groupCode || curriculum.name;
                  const expanded = !!expandedCurriculum[key];
                  const typeColors = getCurriculumTypeBadgeColors(curriculum.curriculumType);
                  const statusColors = getCurriculumStatusBadgeColors(curriculum.curriculumStatus);
                  const typePill = badgePillStyle(typeColors);
                  const statusPill = badgePillStyle({
                    bg: statusColors.bg,
                    text: statusColors.text,
                  });
                  const methodKeys =
                    curriculum.methodLearningList.length > 0
                      ? curriculum.methodLearningList
                      : curriculum.methodLearning
                        ? [curriculum.methodLearning]
                        : [];

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
                          Năm tuyển sinh:{' '}
                          {typeof curriculum.applicationYear === 'number' && curriculum.applicationYear > 0
                            ? curriculum.applicationYear
                            : curriculum.enrollmentYear ?? '—'}
                        </Text>
                        <View style={styles.badgeRow}>
                          <View style={typePill.wrap}>
                            <Text style={typePill.text}>{getCurriculumTypeLabel(curriculum.curriculumType)}</Text>
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
                          {methodKeys.length > 0 ? (
                            <View style={styles.badgeRow}>
                              {methodKeys.map((method) => {
                                const methodColors = getMethodLearningBadgeColors(method);
                                const methodPill = badgePillStyle(methodColors);
                                return (
                                  <View key={`${key}-method-${method}`} style={methodPill.wrap}>
                                    <Text style={methodPill.text}>{getMethodLearningLabel(method)}</Text>
                                  </View>
                                );
                              })}
                            </View>
                          ) : null}
                          {curriculum.description ? (
                            <Text style={styles.sectionText}>{curriculum.description}</Text>
                          ) : null}
                          {curriculum.programList.length > 0 ? (
                            <View style={styles.programSection}>
                              <Text style={styles.programSectionTitle}>Chương trình / lớp</Text>
                              {curriculum.programList.map((program, pi) => {
                                const activeColors = program.isActive
                                  ? getProgramActiveBadgeColors(program.isActive)
                                  : null;
                                const activePill = activeColors ? badgePillStyle(activeColors) : null;
                                const tuitionLabel = formatTuitionVnd(program.baseTuitionFee);
                                return (
                                  <View key={`${key}-prog-${pi}`} style={styles.programCard}>
                                    <View style={styles.programHeaderRow}>
                                      <Text style={styles.programName}>
                                        {(program.name ?? '').trim() || 'Chương trình'}
                                      </Text>
                                      {activePill && program.isActive ? (
                                        <View style={activePill.wrap}>
                                          <Text style={activePill.text}>
                                            {getProgramActiveLabel(program.isActive)}
                                          </Text>
                                        </View>
                                      ) : null}
                                    </View>
                                    {tuitionLabel ? (
                                      <Text style={styles.programTuition}>Học phí tham khảo: {tuitionLabel}</Text>
                                    ) : null}
                                    {program.targetStudentDescription ? (
                                      <Text style={styles.programBodyText}>
                                        {stripBasicHtml(program.targetStudentDescription)}
                                      </Text>
                                    ) : null}
                                    {program.graduationStandard ? (
                                      <>
                                        <Text style={styles.programSubLabel}>Chuẩn tốt nghiệp</Text>
                                        <Text style={styles.programBodyText}>
                                          {stripBasicHtml(program.graduationStandard)}
                                        </Text>
                                      </>
                                    ) : null}
                                  </View>
                                );
                              })}
                            </View>
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
              if (onContactConsult) {
                onContactConsult();
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
  programName: { fontSize: 14, fontWeight: '700', color: '#0f172a', flex: 1 },
  programTuition: { fontSize: 13, fontWeight: '600', color: '#0369a1' },
  programSubLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 4 },
  programBodyText: { fontSize: 13, color: '#475569', lineHeight: 19 },
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
});
