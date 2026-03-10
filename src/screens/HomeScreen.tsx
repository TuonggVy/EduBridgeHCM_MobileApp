import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  StatusBar,
  Modal,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
const Ionicons = require('@expo/vector-icons').Ionicons;
import { useAuth } from '../context/AuthContext';
import { SchoolCard } from '../components/SchoolCard';
import { SCHOOLS, FILTER_OPTIONS } from '../data/schools';
import SearchScreen from './SearchScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const sp = {
  xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 40,
} as const;
const radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, full: 9999 } as const;

const HEADER_TOP_PADDING =
  Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight ?? 24) + 8;

const GRADIENT_COLORS = ['#1976d2', '#42a5f5', '#64b5f6'] as const;
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };

type TabId = 'home' | 'schools' | 'news' | 'account';

const TABS: { id: TabId; label: string; icon: string; iconOutline: string }[] = [
  { id: 'home', label: 'Trang chủ', icon: 'home', iconOutline: 'home-outline' },
  { id: 'schools', label: 'Trường', icon: 'school', iconOutline: 'school-outline' },
  { id: 'news', label: 'Tin tức', icon: 'newspaper', iconOutline: 'newspaper-outline' },
  { id: 'account', label: 'Tài khoản', icon: 'person', iconOutline: 'person-outline' },
];

const MAX_RECENT_SEARCHES = 5;

const QUICK_ACTIONS = [
  { id: 'profile', label: 'Hồ sơ', icon: 'document-text-outline' },
  { id: 'consult', label: 'Tư vấn', icon: 'chatbubbles-outline' },
  { id: 'news', label: 'Tin tức', icon: 'newspaper-outline' },
  { id: 'contact', label: 'Liên hệ', icon: 'call-outline' },
];

const FEATURED_SCHOOLS = SCHOOLS.slice(0, 3);
const POPULAR_SCHOOLS = SCHOOLS;
const CARD_WIDTH = SCREEN_WIDTH * 0.72;

// Banner asset - path without special chars can be more reliable; keep exact name
const BANNER_IMAGE = require('../../assets/Banner.png');

// ─── Home tab: banner, quick actions, featured, popular ─────────────────────
function HomeTabContent({ onOpenSearch }: { onOpenSearch: () => void }) {
  return (
    <>
      {/* Promotional banner - above Quick actions */}
      <Pressable style={({ pressed }) => [styles.bannerCard, pressed && styles.bannerPressed]}>
        <Image
          source={BANNER_IMAGE}
          style={styles.bannerImage}
          resizeMode="cover"
        />
      </Pressable>

      {/* Quick actions */}
      <View style={styles.quickActions}>
        {QUICK_ACTIONS.map((action) => (
          <Pressable
            key={action.id}
            style={({ pressed }) => [
              styles.quickActionItem,
              pressed && styles.quickActionPressed,
            ]}
          >
            <View style={styles.quickActionIconWrap}>
              <Ionicons name={action.icon as any} size={24} color="#1976d2" />
            </View>
            <Text style={styles.quickActionLabel}>{action.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Featured schools - horizontal */}
      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Trường nổi bật</Text>
          <Pressable hitSlop={sp.sm} onPress={onOpenSearch}>
            <Text style={styles.sectionLink}>Xem tất cả</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.featuredScroll}
          style={styles.featuredScrollView}
        >
          {FEATURED_SCHOOLS.map((school) => (
            <View key={school.id} style={[styles.featuredCardWrap, { width: CARD_WIDTH }]}>
              <SchoolCard
                name={school.name}
                address={school.address}
                imageUrl={school.imageUrl}
                onPress={() => {}}
              />
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Popular schools list */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trường phổ biến</Text>
        <View style={styles.schoolList}>
          {POPULAR_SCHOOLS.map((school) => (
            <SchoolCard
              key={school.id}
              name={school.name}
              address={school.address}
              imageUrl={school.imageUrl}
              onPress={() => {}}
            />
          ))}
        </View>
      </View>
    </>
  );
}

// ─── Schools tab: filter + full list ───────────────────────────────────────
function SchoolsTabContent() {
  const [activeFilter, setActiveFilter] = useState(FILTER_OPTIONS[0]);
  return (
    <>
      <Text style={styles.sectionTitle}>Tất cả trường</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
        style={styles.filterScrollView}
      >
        {FILTER_OPTIONS.map((option) => (
          <Pressable
            key={option}
            onPress={() => setActiveFilter(option)}
            style={[
              styles.filterChip,
              activeFilter === option && styles.filterChipActive,
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === option && styles.filterChipTextActive,
              ]}
            >
              {option}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.schoolList}>
        {SCHOOLS.map((school) => (
          <SchoolCard
            key={school.id}
            name={school.name}
            address={school.address}
            imageUrl={school.imageUrl}
            onPress={() => {}}
          />
        ))}
      </View>
    </>
  );
}

// ─── Mock data for profile ──────────────────────────────────────────────────
const MOCK_CHILDREN = [
  { id: '1', name: 'Nguyễn Văn A', age: 15, grade: 'Lớp 9' },
  { id: '2', name: 'Nguyễn Thị B', age: 12, grade: 'Lớp 6' },
];

const PROFILE_MENU_ACTIVITIES = [
  { id: 'consultation', label: 'Lịch sử tư vấn', icon: 'chatbubble-ellipses-outline' },
  { id: 'saved', label: 'Trường đã lưu', icon: 'bookmark-outline' },
  { id: 'application', label: 'Trạng thái hồ sơ', icon: 'document-text-outline' },
];

const PROFILE_MENU_QUICK = [
  { id: 'compare', label: 'So sánh trường', icon: 'git-compare-outline' },
  { id: 'plans', label: 'Kế hoạch tuyển sinh', icon: 'calendar-outline' },
  { id: 'notifications', label: 'Thông báo', icon: 'notifications-outline' },
  { id: 'support', label: 'Hỗ trợ', icon: 'help-circle-outline' },
];

const PROFILE_MENU_SETTINGS = [
  { id: 'account', label: 'Tài khoản', icon: 'person-outline' },
  { id: 'privacy', label: 'Quyền riêng tư', icon: 'shield-checkmark-outline' },
  { id: 'language', label: 'Ngôn ngữ', icon: 'language-outline' },
  { id: 'help', label: 'Trung tâm trợ giúp', icon: 'information-circle-outline' },
];

// ─── Profile tab: full profile screen ───────────────────────────────────────
function ProfileTabContent() {
  const { user, logout } = useAuth();
  const displayName = user?.email?.split('@')[0] ?? 'Phụ huynh';

  const MenuCard = ({
    title,
    items,
    onItemPress,
  }: {
    title: string;
    items: { id: string; label: string; icon: string }[];
    onItemPress: (id: string) => void;
  }) => (
    <View style={styles.profileSectionCard}>
      <Text style={styles.profileSectionTitle}>{title}</Text>
      <View style={styles.profileMenuList}>
        {items.map((item, index) => (
          <Pressable
            key={item.id}
            style={({ pressed }) => [
              styles.profileMenuItem,
              index < items.length - 1 && styles.profileMenuItemBorder,
              pressed && styles.profileMenuItemPressed,
            ]}
            onPress={() => onItemPress(item.id)}
          >
            <Ionicons name={item.icon as any} size={22} color="#64748b" />
            <Text style={styles.profileMenuItemLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.profileScreen}>
      {/* 1. Profile header */}
      <View style={styles.profileHeaderCard}>
        <View style={styles.profileHeaderRow}>
          <View style={styles.profileAvatarLarge}>
            <Ionicons name="person" size={40} color="#64748b" />
          </View>
          <View style={styles.profileHeaderInfo}>
            <Text style={styles.profileUserName}>{displayName}</Text>
            <Text style={styles.profileUserEmail} numberOfLines={1}>
              {user?.email ?? ''}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.profileEditButton,
                pressed && styles.profileEditButtonPressed,
              ]}
            >
              <Ionicons name="pencil" size={16} color="#1976d2" />
              <Text style={styles.profileEditButtonText}>Chỉnh sửa</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* 2. My children */}
      <View style={styles.profileSectionCard}>
        <View style={styles.profileSectionRow}>
          <Text style={styles.profileSectionTitle}>Con của tôi</Text>
          <Pressable style={styles.profileAddButton}>
            <Ionicons name="add-circle-outline" size={22} color="#1976d2" />
            <Text style={styles.profileAddButtonText}>Thêm con</Text>
          </Pressable>
        </View>
        <View style={styles.profileChildrenList}>
          {MOCK_CHILDREN.map((child) => (
            <View key={child.id} style={styles.profileChildItem}>
              <View style={styles.profileChildAvatar}>
                <Ionicons name="person-outline" size={24} color="#64748b" />
              </View>
              <View style={styles.profileChildInfo}>
                <Text style={styles.profileChildName}>{child.name}</Text>
                <Text style={styles.profileChildMeta}>
                  {child.age} tuổi · {child.grade}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </View>
          ))}
        </View>
      </View>

      {/* 3. My activities */}
      <MenuCard
        title="Hoạt động của tôi"
        items={PROFILE_MENU_ACTIVITIES}
        onItemPress={() => {}}
      />

      {/* 4. Quick access */}
      <MenuCard
        title="Truy cập nhanh"
        items={PROFILE_MENU_QUICK}
        onItemPress={() => {}}
      />

      {/* 5. Settings */}
      <MenuCard
        title="Cài đặt"
        items={PROFILE_MENU_SETTINGS}
        onItemPress={() => {}}
      />

      {/* 6. Logout */}
      <Pressable
        style={({ pressed }) => [styles.profileLogoutButton, pressed && styles.profileLogoutButtonPressed]}
        onPress={logout}
      >
        <Ionicons name="log-out-outline" size={22} color="#dc2626" />
        <Text style={styles.profileLogoutButtonText}>Đăng xuất</Text>
      </Pressable>
    </View>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [searchVisible, setSearchVisible] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const showSearchInHeader = activeTab === 'home' || activeTab === 'schools';

  const addRecent = (term: string) => {
    setRecentSearches((prev) => {
      const next = [term, ...prev.filter((t) => t !== term)].slice(0, MAX_RECENT_SEARCHES);
      return next;
    });
  };

  return (
    <View style={styles.screen}>
      {/* Header: search + notification (home/schools only) */}
      {showSearchInHeader ? (
        <LinearGradient
          colors={[...GRADIENT_COLORS]}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={styles.header}
        >
          <View style={[styles.headerInner, { paddingTop: HEADER_TOP_PADDING }]}>
            <View style={styles.headerRow}>
              <Pressable
                style={styles.searchBarPlaceholder}
                onPress={() => setSearchVisible(true)}
              >
                <Ionicons name="search" size={20} color="rgba(255,255,255,0.9)" />
                <Text style={styles.searchPlaceholderText}>
                  Tìm trường, địa điểm...
                </Text>
              </Pressable>
              <Pressable style={styles.notifButton}>
                <Ionicons name="notifications-outline" size={24} color="#fff" />
              </Pressable>
            </View>
          </View>
        </LinearGradient>
      ) : (
        <View style={[styles.headerPlain, { paddingTop: HEADER_TOP_PADDING }]}>
          <Text style={styles.headerPlainTitle}>
            {activeTab === 'news' ? 'Tin tức' : 'Tài khoản'}
          </Text>
        </View>
      )}

      {/* Tab content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'home' && <HomeTabContent onOpenSearch={() => setSearchVisible(true)} />}
        {activeTab === 'schools' && <SchoolsTabContent />}
        {activeTab === 'news' && (
          <View style={styles.placeholder}>
            <Ionicons name="newspaper-outline" size={48} color="#cbd5e1" />
            <Text style={styles.placeholderText}>Tin tức tuyển sinh</Text>
            <Text style={styles.placeholderSub}>Sắp ra mắt</Text>
          </View>
        )}
        {activeTab === 'account' && <ProfileTabContent />}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={styles.tabButton}
          >
            <Ionicons
              name={activeTab === tab.id ? tab.icon : tab.iconOutline}
              size={24}
              color={activeTab === tab.id ? '#1976d2' : '#94a3b8'}
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab.id && styles.tabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Modal
        visible={searchVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setSearchVisible(false)}
      >
        <SearchScreen
          onClose={() => setSearchVisible(false)}
          recentSearches={recentSearches}
          onClearRecent={() => setRecentSearches([])}
          onAddRecent={addRecent}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingBottom: sp.lg,
  },
  headerPlain: {
    backgroundColor: '#fff',
    paddingHorizontal: sp.lg,
    paddingBottom: sp.md,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerPlainTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerInner: {
    paddingHorizontal: sp.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
  },
  searchBarPlaceholder: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: radius.xl,
    paddingHorizontal: sp.md,
    height: 48,
  },
  searchPlaceholderText: {
    marginLeft: sp.sm,
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  notifButton: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: sp.lg,
    paddingTop: sp.lg,
    paddingBottom: sp.xxl,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: sp.xl,
  },
  quickActionItem: {
    alignItems: 'center',
    flex: 1,
  },
  quickActionPressed: {
    opacity: 0.7,
  },
  quickActionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.xxl,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sp.xs,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  section: {
    marginBottom: sp.xl,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sp.md,
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
  featuredScrollView: {
    marginHorizontal: -sp.lg,
  },
  featuredScroll: {
    paddingHorizontal: sp.lg,
    gap: sp.md,
    paddingBottom: sp.sm,
  },
  featuredCardWrap: {
    marginRight: sp.md,
  },
  bannerCard: {
    width: '100%',
    minHeight: 160,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: sp.xl,
    backgroundColor: '#e0f2fe',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  bannerPressed: {
    opacity: 0.98,
  },
  bannerImage: {
    width: '100%',
    height: 160,
    borderRadius: radius.xl,
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
  placeholderSub: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: sp.xs,
  },
  bottomSpacer: {
    height: 100,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: sp.sm,
    paddingTop: sp.sm,
    paddingBottom: Platform.OS === 'ios' ? 28 : sp.md,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sp.xs,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94a3b8',
    marginTop: sp.xxs,
  },
  tabLabelActive: {
    color: '#1976d2',
  },
  // ─── Profile screen ───────────────────────────────────────────────────────
  profileScreen: {
    gap: sp.lg,
  },
  profileHeaderCard: {
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    padding: sp.xl,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: sp.lg,
  },
  profileHeaderInfo: {
    flex: 1,
  },
  profileUserName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: sp.xxs,
  },
  profileUserEmail: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: sp.sm,
  },
  profileEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: sp.xxs,
    paddingVertical: sp.xs,
    paddingHorizontal: sp.sm,
    borderRadius: radius.md,
    backgroundColor: '#eff6ff',
  },
  profileEditButtonPressed: {
    backgroundColor: '#dbeafe',
  },
  profileEditButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
  },
  profileSectionCard: {
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    padding: sp.lg,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  profileSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sp.md,
  },
  profileSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: sp.sm,
  },
  profileAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xxs,
  },
  profileAddButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
  },
  profileChildrenList: {
    gap: sp.xs,
  },
  profileChildItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sp.sm,
    paddingHorizontal: sp.sm,
    borderRadius: radius.md,
    backgroundColor: '#f8fafc',
  },
  profileChildAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: sp.md,
  },
  profileChildInfo: {
    flex: 1,
  },
  profileChildName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  profileChildMeta: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  profileMenuList: {
    marginTop: sp.xxs,
  },
  profileMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sp.md,
    gap: sp.sm,
  },
  profileMenuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  profileMenuItemPressed: {
    opacity: 0.7,
  },
  profileMenuItemLabel: {
    flex: 1,
    fontSize: 16,
    color: '#334155',
  },
  profileLogoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.sm,
    paddingVertical: sp.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  profileLogoutButtonPressed: {
    opacity: 0.9,
  },
  profileLogoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },
});
