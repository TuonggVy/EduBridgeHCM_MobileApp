import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import { fetchPostList } from '../api/post';
import type { PostCategory, SchoolPost } from '../types/post';
import { MaterialIcons, radius, sp } from './tabs/tabConstants';

type FilterItem = { id: 'ALL' | PostCategory; label: string };

const FILTERS: FilterItem[] = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'CAMPUS_ADMISSION', label: 'Tin tuyển sinh' },
  { id: 'CAMPUS_EVENTS', label: 'Sự kiện của trường' },
  { id: 'CAMPUS_SCHOLARSHIP', label: 'Thông tin học bổng' },
];

const TOP_SAFE_PADDING = Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight ?? 24) + 12;
const SCREEN_WIDTH = Dimensions.get('window').width;

function relativeTime(isoDate: string | null): string {
  if (!isoDate) return 'Vừa đăng';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Vừa đăng';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return 'Vừa đăng';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

function categoryLabel(category: string): string {
  if (category === 'CAMPUS_ADMISSION') return 'Tin tuyển sinh';
  if (category === 'CAMPUS_EVENTS') return 'Sự kiện của trường';
  if (category === 'CAMPUS_SCHOLARSHIP') return 'Thông tin học bổng';
  return 'Bài đăng';
}

function postImages(post: SchoolPost): string[] {
  const imageList = post.imageJson?.imageItemList ?? [];
  const sorted = [...imageList].sort((a, b) => a.position - b.position).map((item) => item.url);
  if (sorted.length > 0) return sorted;
  if (post.thumbnail) return [post.thumbnail];
  return [];
}

function normalizeText(rawText: string): string {
  return rawText.replace(/<[^>]*>/g, '').trim();
}

type PostFeedScreenProps = {
  onOpenPostDetail?: (postId: number) => void;
  onClose?: () => void;
};

export default function PostFeedScreen({ onOpenPostDetail, onClose }: PostFeedScreenProps) {
  const [posts, setPosts] = useState<SchoolPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterItem['id']>('ALL');
  const [selectedPost, setSelectedPost] = useState<SchoolPost | null>(null);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerImages, setImageViewerImages] = useState<string[]>([]);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const imageViewerListRef = useRef<FlatList<string> | null>(null);

  const loadPosts = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setErrorMessage(null);
    try {
      const response = await fetchPostList();
      setPosts(Array.isArray(response.body) ? response.body : []);
    } catch (error) {
      setPosts([]);
      setErrorMessage(error instanceof Error ? error.message : 'Không thể tải bài đăng');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const openImageViewer = useCallback((images: string[], startIndex = 0) => {
    if (!Array.isArray(images) || images.length === 0) return;
    const safeIndex = Math.min(Math.max(startIndex, 0), images.length - 1);
    setImageViewerImages(images);
    setImageViewerIndex(safeIndex);
    setImageViewerVisible(true);
  }, []);

  const closeImageViewer = useCallback(() => {
    setImageViewerVisible(false);
  }, []);

  useEffect(() => {
    if (!imageViewerVisible || imageViewerImages.length === 0) return;
    const timer = setTimeout(() => {
      imageViewerListRef.current?.scrollToIndex({
        index: imageViewerIndex,
        animated: false,
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [imageViewerVisible, imageViewerImages.length, imageViewerIndex]);

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return posts.filter((post) => {
      const byCategory = activeFilter === 'ALL' || post.categoryPost === activeFilter;
      if (!byCategory) return false;
      if (!normalizedQuery) return true;
      const schoolName = (post.author?.name ?? '').toLowerCase();
      const shortDescription = (post.content?.shortDescription ?? '').toLowerCase();
      const hashtags = post.hashTag.join(' ').toLowerCase();
      return (
        schoolName.includes(normalizedQuery) ||
        shortDescription.includes(normalizedQuery) ||
        hashtags.includes(normalizedQuery)
      );
    });
  }, [activeFilter, posts, query]);

  const renderImages = (post: SchoolPost) => {
    const images = postImages(post);
    if (images.length === 0) return null;
    if (images.length === 1) {
      return <Image source={{ uri: images[0] }} style={styles.singleImage} resizeMode="cover" />;
    }
    const topThree = images.slice(0, 3);
    return (
      <View style={styles.gridWrap}>
        {topThree.map((url, index) => {
          const isLast = index === 2 && images.length > 3;
          return (
            <View key={`${post.id}-${url}-${index}`} style={styles.gridItemWrap}>
              <Image source={{ uri: url }} style={styles.gridItem} resizeMode="cover" />
              {isLast && (
                <View style={styles.moreOverlay}>
                  <Text style={styles.moreOverlayText}>+{images.length - 3}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const renderPostCard = ({ item }: { item: SchoolPost }) => {
    const description = item.content?.shortDescription
      ? item.content.shortDescription
      : normalizeText(item.content?.contentDataList?.[0]?.text ?? '');
    return (
      <Pressable
        onPress={() => {
          onOpenPostDetail?.(item.id);
          setSelectedPost(item);
        }}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.avatarWrap}>
            <MaterialIcons name="school" size={20} color="#2563eb" />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.schoolName} numberOfLines={1}>
              {item.author?.name ?? 'Trường học'}
            </Text>
            <Text style={styles.publishedTime}>{relativeTime(item.publishedDate)}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{categoryLabel(item.categoryPost)}</Text>
          </View>
        </View>

        {renderImages(item)}

        <Text numberOfLines={3} style={styles.description}>
          {description || 'Bài đăng từ nhà trường'}
        </Text>

        {item.hashTag.length > 0 && (
          <View style={styles.hashTagRow}>
            {item.hashTag.slice(0, 4).map((tag) => (
              <Pressable key={`${item.id}-${tag}`} style={styles.hashTagChip}>
                <Text style={styles.hashTagText}>#{tag.replace(/^#/, '')}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.actionRow}>
          <Pressable style={styles.actionButton}>
            <MaterialIcons name="favorite-border" size={18} color="#64748b" />
          </Pressable>
          <Pressable style={styles.actionButton}>
            <MaterialIcons name="chat-bubble-outline" size={18} color="#64748b" />
          </Pressable>
          <Pressable style={styles.actionButton}>
            <MaterialIcons name="share" size={18} color="#64748b" />
          </Pressable>
          <Pressable style={styles.actionButton}>
            <MaterialIcons name="bookmark-border" size={18} color="#64748b" />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.leftWrap}>
          <Pressable style={styles.iconButton} onPress={onClose}>
            <MaterialIcons name="arrow-back" size={22} color="#0f172a" />
          </Pressable>
        </View>
        <Text style={styles.title}>Bài viết từ Trường</Text>
        <View style={styles.rightWrap}>
          <Pressable style={styles.iconButton}>
            <MaterialIcons name="notifications-none" size={22} color="#0f172a" />
          </Pressable>
          <View style={styles.profileAvatar}>
            <MaterialIcons name="person" size={18} color="#475569" />
          </View>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <MaterialIcons name="search" size={20} color="#94a3b8" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Tìm bài viết..."
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
        />
      </View>

      <FlatList
        data={filteredPosts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderPostCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
        ListHeaderComponent={
          <View style={styles.filterWrap}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={FILTERS}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.filterContent}
              renderItem={({ item }) => {
                const active = activeFilter === item.id;
                return (
                  <Pressable
                    onPress={() => setActiveFilter(item.id)}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centeredBlock}>
              <ActivityIndicator color="#2563eb" />
              <Text style={styles.emptyText}>Đang tải bài đăng...</Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.centeredBlock}>
              <Text style={styles.errorText}>{errorMessage}</Text>
              <Pressable style={styles.retryButton} onPress={() => loadPosts('initial')}>
                <Text style={styles.retryText}>Thử lại</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.centeredBlock}>
              <Text style={styles.emptyText}>Không có bài đăng phù hợp</Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadPosts('refresh')} tintColor="#2563eb" />
        }
      />

      <Modal
        visible={selectedPost != null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setSelectedPost(null)}
      >
        <View style={styles.detailScreen}>
          <View style={styles.detailHeader}>
            <Pressable onPress={() => setSelectedPost(null)} style={styles.detailBackButton}>
              <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
            </Pressable>
            <Text style={styles.detailTitle}>Chi tiết bài đăng</Text>
            <View style={styles.detailHeaderSpacer} />
          </View>
          {selectedPost && (
            <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.detailSchoolName}>{selectedPost.author?.name ?? 'Trường học'}</Text>
              <Text style={styles.detailPublishedTime}>{relativeTime(selectedPost.publishedDate)}</Text>
              <Text style={styles.detailDescription}>
                {selectedPost.content?.shortDescription ??
                  normalizeText(selectedPost.content?.contentDataList?.[0]?.text ?? '')}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.detailImagesRow}
              >
                {postImages(selectedPost).map((imageUrl, index, allImages) => (
                  <Pressable
                    key={`${selectedPost.id}-${imageUrl}-${index}`}
                    onPress={() => openImageViewer(allImages, index)}
                    style={({ pressed }) => [pressed && styles.detailImagePressed]}
                  >
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.detailImage}
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </ScrollView>
              {selectedPost.hashTag.length > 0 && (
                <View style={styles.hashTagRow}>
                  {selectedPost.hashTag.map((tag) => (
                    <View key={`${selectedPost.id}-${tag}-detail`} style={styles.hashTagChip}>
                      <Text style={styles.hashTagText}>#{tag.replace(/^#/, '')}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          )}
          {imageViewerVisible ? (
            <View style={styles.imageViewerBackdrop}>
              <Pressable style={styles.imageViewerCloseBtn} onPress={closeImageViewer}>
                <MaterialIcons name="close" size={24} color="#fff" />
              </Pressable>
              <View style={styles.imageViewerImageWrap}>
                <FlatList
                  ref={imageViewerListRef}
                  data={imageViewerImages}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item, index) => `${item}-${index}`}
                  getItemLayout={(_, index) => ({
                    length: SCREEN_WIDTH,
                    offset: SCREEN_WIDTH * index,
                    index,
                  })}
                  initialScrollIndex={imageViewerIndex}
                  onMomentumScrollEnd={(event) => {
                    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                    if (nextIndex !== imageViewerIndex) setImageViewerIndex(nextIndex);
                  }}
                  renderItem={({ item }) => (
                    <View style={styles.imageViewerPage}>
                      <Image source={{ uri: item }} style={styles.imageViewerImage} resizeMode="contain" />
                    </View>
                  )}
                />
              </View>
              <View style={styles.imageViewerFooter}>
                <Text style={styles.imageViewerIndex}>
                  {imageViewerImages.length > 0 ? `${imageViewerIndex + 1}/${imageViewerImages.length}` : ''}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sp.lg,
    paddingTop: TOP_SAFE_PADDING,
    paddingBottom: sp.sm,
    backgroundColor: '#fff',
  },
  leftWrap: {
    width: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '700',
  },
  rightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 96,
    gap: 8,
  },
  iconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatar: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    marginHorizontal: sp.lg,
    marginTop: sp.sm,
    marginBottom: sp.sm,
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    paddingHorizontal: sp.md,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
  },
  filterWrap: {
    backgroundColor: '#f8fafc',
    paddingBottom: sp.sm,
  },
  filterContent: {
    paddingHorizontal: sp.lg,
    gap: sp.xs,
  },
  filterChip: {
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs,
    borderRadius: radius.full,
    backgroundColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#dbeafe',
  },
  filterLabel: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 13,
  },
  filterLabelActive: {
    color: '#1d4ed8',
  },
  listContent: {
    paddingTop: 0,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: sp.lg,
    marginBottom: sp.md,
    borderRadius: 18,
    padding: sp.md,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.96,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: sp.sm,
    gap: sp.sm,
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  schoolName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  publishedTime: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: sp.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  badgeText: {
    fontSize: 11,
    color: '#2563eb',
    fontWeight: '700',
  },
  singleImage: {
    width: '100%',
    height: 180,
    borderRadius: radius.lg,
    marginBottom: sp.sm,
  },
  gridWrap: {
    flexDirection: 'row',
    gap: sp.xs,
    marginBottom: sp.sm,
  },
  gridItemWrap: {
    flex: 1,
    position: 'relative',
  },
  gridItem: {
    width: '100%',
    height: 120,
    borderRadius: radius.md,
  },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.md,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreOverlayText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 21,
    marginBottom: sp.sm,
  },
  hashTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp.xs,
    marginBottom: sp.sm,
  },
  hashTagChip: {
    backgroundColor: '#f1f5f9',
    borderRadius: radius.full,
    paddingHorizontal: sp.sm,
    paddingVertical: 6,
  },
  hashTagText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
    paddingTop: sp.xs,
  },
  actionButton: {
    width: 44,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredBlock: {
    marginTop: 80,
    alignItems: 'center',
    paddingHorizontal: sp.lg,
  },
  emptyText: {
    marginTop: sp.sm,
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: '#b91c1c',
    textAlign: 'center',
    fontSize: 14,
  },
  retryButton: {
    marginTop: sp.md,
    backgroundColor: '#1d4ed8',
    paddingHorizontal: sp.lg,
    paddingVertical: sp.xs,
    borderRadius: radius.full,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  detailScreen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  detailHeader: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sp.md,
    paddingTop: TOP_SAFE_PADDING,
    paddingBottom: sp.xs,
  },
  detailBackButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  detailHeaderSpacer: {
    width: 40,
  },
  detailContent: {
    padding: sp.lg,
    gap: sp.sm,
  },
  detailSchoolName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  detailPublishedTime: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: sp.xs,
  },
  detailImage: {
    width: 280,
    height: 220,
    borderRadius: radius.lg,
  },
  detailImagePressed: {
    opacity: 0.92,
  },
  detailImagesRow: {
    gap: sp.sm,
    paddingVertical: sp.xs,
  },
  detailDescription: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 23,
    marginTop: sp.xs,
  },
  imageViewerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    backgroundColor: 'rgba(2,6,23,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageViewerCloseBtn: {
    position: 'absolute',
    top: TOP_SAFE_PADDING,
    right: sp.lg,
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  imageViewerImageWrap: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageViewerPage: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: sp.lg,
  },
  imageViewerImage: {
    width: SCREEN_WIDTH - sp.lg * 2,
    height: '80%',
  },
  imageViewerFooter: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 42 : sp.xl,
    backgroundColor: 'rgba(15,23,42,0.55)',
    borderRadius: radius.full,
    paddingHorizontal: sp.md,
    paddingVertical: 6,
  },
  imageViewerIndex: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});
