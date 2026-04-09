import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Animated,
  PanResponder,
  Dimensions,
  ActivityIndicator,
  FlatList,
  Platform,
  StatusBar,
} from 'react-native';
import MapView, { Callout, Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
const MaterialIcons = require('@expo/vector-icons').MaterialIcons;
import { searchNearbyCampus } from '../api/school';
import type { NearbyCampus } from '../types/school';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BRAND = '#1976d2';
const INITIAL_RADIUS = 10;
const COLLAPSED_TOP = Math.round(SCREEN_HEIGHT * 0.66);
const EXPANDED_TOP = Math.round(SCREEN_HEIGHT * 0.2);
const MARKER_SIZE = 36;
const TOP_INSET = Platform.OS === 'ios' ? 54 : (StatusBar.currentHeight ?? 24) + 10;

type LatLng = { lat: number; lng: number };

type Props = {
  onClose: () => void;
  onOpenSchoolDetail: (schoolId: number) => void;
};

const RADIUS_OPTIONS = [5, 10, 20, 50, 80];

function regionToRadiusKm(region: Region): number {
  const km = Math.max(2, Math.round((region.longitudeDelta * 111) / 2));
  return Math.min(100, km);
}

function formatDistance(distance: number | null): string {
  if (distance == null || !Number.isFinite(distance)) return 'N/A';
  return `${distance.toFixed(distance < 10 ? 1 : 0)} km`;
}

export default function SchoolNearbyMapScreen({ onClose, onOpenSchoolDetail }: Props) {
  const mapRef = useRef<MapView | null>(null);
  const listRef = useRef<FlatList<NearbyCampus> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetTop = useRef(new Animated.Value(COLLAPSED_TOP)).current;
  const [campuses, setCampuses] = useState<NearbyCampus[]>([]);
  const [selectedCampusId, setSelectedCampusId] = useState<number | null>(null);
  const [radiusKm, setRadiusKm] = useState(INITIAL_RADIUS);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');

  const animateSheet = useCallback((toTop: number) => {
    Animated.spring(sheetTop, {
      toValue: toTop,
      useNativeDriver: false,
      bounciness: 0,
      speed: 16,
    }).start();
  }, [sheetTop]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8,
        onPanResponderMove: (_, gesture) => {
          const next = Math.min(COLLAPSED_TOP, Math.max(EXPANDED_TOP, COLLAPSED_TOP + gesture.dy));
          sheetTop.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => {
          const shouldExpand = gesture.vy < -0.2 || gesture.dy < -24;
          animateSheet(shouldExpand ? EXPANDED_TOP : COLLAPSED_TOP);
        },
      }),
    [animateSheet, sheetTop]
  );

  const loadNearby = useCallback(async (center: LatLng, radius: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await searchNearbyCampus(center.lat, center.lng, radius);
      setCampuses(res.body);
      if (res.body.length > 0) {
        setSelectedCampusId(res.body[0].id);
      } else {
        setSelectedCampusId(null);
      }
    } catch (e) {
      setCampuses([]);
      setSelectedCampusId(null);
      setError(e instanceof Error ? e.message : 'Không tải được trường gần bạn');
    } finally {
      setLoading(false);
    }
  }, []);

  const requestLocationAndLoad = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        throw new Error('Bạn chưa cấp quyền vị trí.');
      }
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const center = {
        lat: current.coords.latitude,
        lng: current.coords.longitude,
      };
      setUserLocation(center);
      await loadNearby(center, radiusKm);
      mapRef.current?.animateToRegion(
        {
          latitude: center.lat,
          longitude: center.lng,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        },
        400
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể lấy vị trí hiện tại');
    } finally {
      setLoading(false);
    }
  }, [loadNearby, radiusKm]);

  useEffect(() => {
    void requestLocationAndLoad();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [requestLocationAndLoad]);

  const onRegionChangeComplete = useCallback((region: Region) => {
    const nextRadius = regionToRadiusKm(region);
    setRadiusKm(nextRadius);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void loadNearby({ lat: region.latitude, lng: region.longitude }, nextRadius);
    }, 500);
  }, [loadNearby]);

  const filteredCampuses = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();
    if (!q) return campuses;
    return campuses.filter((item) => {
      const schoolName = item.schoolName ?? '';
      const address = item.address ?? '';
      return (
        item.name.toLowerCase().includes(q) ||
        schoolName.toLowerCase().includes(q) ||
        address.toLowerCase().includes(q)
      );
    });
  }, [campuses, searchKeyword]);

  const centerOnCampus = useCallback((item: NearbyCampus, openDetail = false) => {
    setSelectedCampusId(item.id);
    mapRef.current?.animateToRegion(
      {
        latitude: item.latitude,
        longitude: item.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      },
      350
    );
    if (openDetail && item.schoolId != null) {
      onOpenSchoolDetail(item.schoolId);
    }
  }, [onOpenSchoolDetail]);

  const onPressFilterRadius = useCallback(() => {
    const index = RADIUS_OPTIONS.findIndex((x) => x === radiusKm);
    const next = RADIUS_OPTIONS[(index + 1) % RADIUS_OPTIONS.length];
    setRadiusKm(next);
    if (userLocation) {
      void loadNearby(userLocation, next);
    }
  }, [loadNearby, radiusKm, userLocation]);

  const initialRegion: Region = {
    latitude: userLocation?.lat ?? 10.7769,
    longitude: userLocation?.lng ?? 106.7009,
    latitudeDelta: 0.12,
    longitudeDelta: 0.12,
  };

  return (
    <View style={styles.screen}>
      <MapView
        ref={(ref) => {
          mapRef.current = ref;
        }}
        style={styles.map}
        initialRegion={initialRegion}
        onRegionChangeComplete={onRegionChangeComplete}
        showsMyLocationButton={false}
        showsUserLocation={false}
      >
        {userLocation ? (
          <Marker coordinate={{ latitude: userLocation.lat, longitude: userLocation.lng }} pinColor={BRAND}>
            <Callout>
              <Text>Vị trí của bạn</Text>
            </Callout>
          </Marker>
        ) : null}

        {filteredCampuses.map((campus) => {
          const selected = campus.id === selectedCampusId;
          return (
            <Marker
              key={campus.id}
              coordinate={{ latitude: campus.latitude, longitude: campus.longitude }}
              onPress={() => setSelectedCampusId(campus.id)}
              onCalloutPress={() => {
                if (campus.schoolId != null) onOpenSchoolDetail(campus.schoolId);
              }}
            >
              <View style={[styles.schoolMarker, selected && styles.schoolMarkerSelected]}>
                <MaterialIcons name="school" size={18} color="#fff" />
              </View>
              <Callout>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle} numberOfLines={1}>{campus.schoolName ?? campus.name}</Text>
                  <Text style={styles.calloutSub} numberOfLines={1}>{campus.address ?? 'Đang cập nhật địa chỉ'}</Text>
                  <Text style={styles.calloutSub}>Khoảng cách: {formatDistance(campus.distance)}</Text>
                  <Text style={styles.calloutLink}>Chạm để xem chi tiết</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      <View style={styles.topOverlay}>
        <View style={styles.searchWrap}>
          <MaterialIcons name="search" size={20} color="#94a3b8" />
          <TextInput
            value={searchKeyword}
            onChangeText={setSearchKeyword}
            placeholder="Tìm trường gần bạn"
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
          />
        </View>
        <Pressable style={styles.filterBtn} onPress={onPressFilterRadius}>
          <MaterialIcons name="filter-list" size={20} color="#0f172a" />
          <Text style={styles.filterText}>{radiusKm}km</Text>
        </Pressable>
      </View>

      <Pressable style={styles.backBtn} onPress={onClose}>
        <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
      </Pressable>

      <Pressable style={styles.locateBtn} onPress={() => void requestLocationAndLoad()}>
        <MaterialIcons name="my-location" size={22} color="#0f172a" />
      </Pressable>

      <Animated.View style={[styles.sheet, { top: sheetTop }]}>
        <View style={styles.sheetHandleArea} {...panResponder.panHandlers}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Trường gần bạn ({filteredCampuses.length})</Text>
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={BRAND} />
            <Text style={styles.stateText}>Đang tải trường gần bạn...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={() => void requestLocationAndLoad()}>
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : filteredCampuses.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.stateText}>Không có trường gần bạn</Text>
          </View>
        ) : (
          <FlatList
            ref={(ref) => {
              listRef.current = ref;
            }}
            data={filteredCampuses}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => {
              const selected = item.id === selectedCampusId;
              return (
                <Pressable style={[styles.itemCard, selected && styles.itemCardSelected]} onPress={() => centerOnCampus(item)}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{item.schoolName ?? item.name}</Text>
                    <Text style={styles.distance}>{formatDistance(item.distance)}</Text>
                  </View>
                  <Text style={styles.itemSub} numberOfLines={1}>{item.address ?? 'Đang cập nhật địa chỉ'}</Text>
                  <View style={styles.itemFooter}>
                    <Text style={styles.rating}>
                      {typeof item.averageRating === 'number' ? `⭐ ${item.averageRating.toFixed(1)}` : '⭐ Chưa có đánh giá'}
                    </Text>
                    <Pressable
                      disabled={item.schoolId == null}
                      onPress={() => centerOnCampus(item, true)}
                      style={[styles.detailBtn, item.schoolId == null && styles.detailBtnDisabled]}
                    >
                      <Text style={styles.detailBtnText}>Xem chi tiết</Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            }}
            onViewableItemsChanged={({ viewableItems }) => {
              const first = viewableItems[0]?.item;
              if (first?.id) setSelectedCampusId(first.id);
            }}
            viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  map: { flex: 1 },
  topOverlay: {
    position: 'absolute',
    top: TOP_INSET + 46,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchWrap: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  searchInput: { flex: 1, marginLeft: 8, color: '#0f172a', fontSize: 14 },
  filterBtn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    minHeight: 44,
    minWidth: 74,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  filterText: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  backBtn: {
    position: 'absolute',
    top: TOP_INSET,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffffee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locateBtn: {
    position: 'absolute',
    right: 16,
    bottom: SCREEN_HEIGHT * 0.38,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffffee',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  schoolMarker: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  schoolMarkerSelected: {
    transform: [{ scale: 1.14 }],
    backgroundColor: '#0d47a1',
  },
  callout: { maxWidth: 220 },
  calloutTitle: { fontWeight: '700', color: '#0f172a', marginBottom: 3 },
  calloutSub: { color: '#475569', fontSize: 12 },
  calloutLink: { marginTop: 4, color: BRAND, fontWeight: '600', fontSize: 12 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetHandleArea: {
    paddingTop: 10,
    paddingBottom: 10,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#cbd5e1',
    marginBottom: 8,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  centerState: { paddingVertical: 28, alignItems: 'center', gap: 8 },
  stateText: { color: '#64748b', fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },
  retryBtn: {
    marginTop: 8,
    backgroundColor: BRAND,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryText: { color: '#fff', fontWeight: '700' },
  listContent: { padding: 12, paddingBottom: 30, gap: 10 },
  itemCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    backgroundColor: '#fff',
  },
  itemCardSelected: { borderColor: BRAND, backgroundColor: '#eff6ff' },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
  distance: { fontSize: 12, color: BRAND, fontWeight: '700' },
  itemSub: { marginTop: 5, color: '#64748b', fontSize: 13 },
  itemFooter: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rating: { color: '#334155', fontSize: 13 },
  detailBtn: {
    backgroundColor: BRAND,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailBtnDisabled: { backgroundColor: '#94a3b8' },
  detailBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
