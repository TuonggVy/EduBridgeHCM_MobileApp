import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  StatusBar,
  Modal,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
const MaterialIcons = require('@expo/vector-icons').MaterialIcons;
import { useAuth } from '../context/AuthContext';
import SearchScreen from './SearchScreen';
import {
  HomeTabScreen,
  SchoolsTabScreen,
  NewsTabScreen,
  AccountTabScreen,
  sp,
  radius,
} from './tabs';
import { CompleteProfileBottomSheet } from '../components/CompleteProfileBottomSheet';
import ParentProfileFormScreen from './ParentProfileFormScreen';
import StudentProfileScreen from './StudentProfileScreen';
import StudentProfileFormScreen from './StudentProfileFormScreen';
import ConversationsScreen from './ConversationsScreen';
import ChatScreen from './ChatScreen';
import { getProfile, isProfileComplete } from '../api/profile';
import { fetchParentPersonalityTypes, fetchParentStudents } from '../api/parentStudent';
import type { ProfileGetBody } from '../types/auth';
import type { ParentStudentProfile, PersonalityTypesGrouped } from '../types/studentProfile';
import type { ParentConversationsItem } from '../types/chat';
import { resolveParentChatEmails } from '../utils/resolveParentChatEmails';
import {
  addFavouriteSchool,
  fetchFavouriteSchoolIdMap,
  removeFavouriteSchool,
} from '../api/favouriteSchool';
import {
  createParentConversation,
  fetchParentConversations,
  fetchParentMessagesHistory,
} from '../api/parentChat';
import { ApiError } from '../api/client';
import { fetchSchoolPublicDetail, fetchSchoolPublicList } from '../api/school';
import type { SchoolDetail, SchoolSummary } from '../types/school';
import { SchoolDetailModal } from '../components/SchoolDetailModal';
import { useToast } from '../components/AppToast';
import FavouriteSchoolsScreen from './FavouriteSchoolsScreen';
import PostFeedScreen from './PostFeedScreen';
import AiAssistantChatScreen from './AiAssistantChatScreen';

const HEADER_TOP_PADDING =
  Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight ?? 24) + 8;

const GRADIENT_COLORS = ['#1976d2', '#42a5f5', '#64b5f6'] as const;
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };

type TabId = 'home' | 'schools' | 'consult' | 'account';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'home', label: 'Trang chủ', icon: 'home' },
  { id: 'schools', label: 'Trường', icon: 'school' },
  { id: 'consult', label: 'Tư vấn', icon: 'chat-bubble-outline' },
  { id: 'account', label: 'Tài khoản', icon: 'person' },
];

const MAX_RECENT_SEARCHES = 5;

function asString(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return null;
}

function sanitizeCounsellorEmail(v: unknown): string | null {
  const raw = asString(v)?.trim() ?? '';
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  if (normalized === 'n/a' || normalized === 'na' || normalized === 'none' || normalized === 'null') {
    return null;
  }
  return normalized.includes('@') ? raw : null;
}

// ─── Main (shell: header, bottom tabs, modals) ───────────────────────────────
export default function HomeScreen() {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [searchVisible, setSearchVisible] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [profileData, setProfileData] = useState<ProfileGetBody | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [chatView, setChatView] = useState<'app' | 'chat'>('app');
  const [newsModalVisible, setNewsModalVisible] = useState(false);
  const [postFeedVisible, setPostFeedVisible] = useState(false);
  const [aiAssistantVisible, setAiAssistantVisible] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<ParentConversationsItem | null>(null);

  const [students, setStudents] = useState<ParentStudentProfile[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [personalityGrouped, setPersonalityGrouped] = useState<PersonalityTypesGrouped | null>(null);
  const [showStudentProfile, setShowStudentProfile] = useState(false);
  const [profileStudent, setProfileStudent] = useState<ParentStudentProfile | null>(null);
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [studentFormInitial, setStudentFormInitial] = useState<ParentStudentProfile | null>(null);
  const [schools, setSchools] = useState<SchoolSummary[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [schoolsError, setSchoolsError] = useState<string | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | null>(null);
  const [selectedSchoolDetail, setSelectedSchoolDetail] = useState<SchoolDetail | null>(null);
  const [schoolDetailLoading, setSchoolDetailLoading] = useState(false);
  const [schoolDetailVisible, setSchoolDetailVisible] = useState(false);
  const [consultLoading, setConsultLoading] = useState(false);
  const [studentPickerVisible, setStudentPickerVisible] = useState(false);
  const [studentPickerCampusId, setStudentPickerCampusId] = useState<number | null>(null);
  const [studentPickerOptions, setStudentPickerOptions] = useState<ParentStudentProfile[]>([]);
  const [schoolsRefreshing, setSchoolsRefreshing] = useState(false);
  const [favouriteModalVisible, setFavouriteModalVisible] = useState(false);
  const [favouriteIdBySchoolId, setFavouriteIdBySchoolId] = useState<Record<number, number>>({});

  const refreshStudents = useCallback(async () => {
    try {
      const res = await fetchParentStudents();
      setStudents(Array.isArray(res.body) ? res.body : []);
    } catch {
      setStudents([]);
    }
  }, []);

  const refreshSchools = useCallback(async (mode: 'initial' | 'pull' = 'initial') => {
    if (mode === 'initial') {
      setSchoolsLoading(true);
    } else {
      setSchoolsRefreshing(true);
    }
    setSchoolsError(null);
    try {
      const res = await fetchSchoolPublicList();
      const list = Array.isArray(res.body) ? res.body : [];
      let favMap: Record<number, number> = {};
      try {
        favMap = await fetchFavouriteSchoolIdMap();
      } catch {
        favMap = {};
      }
      setFavouriteIdBySchoolId(favMap);
      setSchools(
        list.map((s) => ({
          ...s,
          isFavourite:
            Object.prototype.hasOwnProperty.call(favMap, s.id) || Boolean(s.isFavourite),
        }))
      );
    } catch (error) {
      setSchools([]);
      setFavouriteIdBySchoolId({});
      setSchoolsError(error instanceof Error ? error.message : 'Không thể tải danh sách trường');
    } finally {
      setSchoolsLoading(false);
      setSchoolsRefreshing(false);
    }
  }, []);

  const openSchoolDetail = useCallback(async (schoolId: number) => {
    setSchoolDetailVisible(true);
    setSelectedSchoolId(schoolId);
    setSchoolDetailLoading(true);
    try {
      const res = await fetchSchoolPublicDetail(schoolId);
      setSelectedSchoolDetail(res.body ?? null);
    } catch {
      setSelectedSchoolDetail(null);
    } finally {
      setSchoolDetailLoading(false);
    }
  }, []);

  const toggleSchoolFavourite = useCallback(
    async (schoolId: number): Promise<boolean> => {
      const school = schools.find((s) => s.id === schoolId);
      if (!school) return false;
      const willFavourite = !school.isFavourite;
      try {
        if (willFavourite) {
          await addFavouriteSchool(schoolId);
          const map = await fetchFavouriteSchoolIdMap();
          setFavouriteIdBySchoolId(map);
          setSchools((prev) =>
            prev.map((s) => (s.id === schoolId ? { ...s, isFavourite: true } : s))
          );
          setSelectedSchoolDetail((prev) =>
            prev && prev.id === schoolId ? { ...prev, isFavourite: true } : prev
          );
          showSuccess('Đã thêm vào yêu thích');
          return true;
        }
        let fid = favouriteIdBySchoolId[schoolId];
        if (fid == null) {
          const map = await fetchFavouriteSchoolIdMap();
          setFavouriteIdBySchoolId(map);
          fid = map[schoolId];
        }
        if (fid == null) {
          showError('Không tìm thấy mục yêu thích để gỡ');
          return false;
        }
        await removeFavouriteSchool(fid);
        setFavouriteIdBySchoolId((prev) => {
          const next = { ...prev };
          delete next[schoolId];
          return next;
        });
        setSchools((prev) =>
          prev.map((s) => (s.id === schoolId ? { ...s, isFavourite: false } : s))
        );
        setSelectedSchoolDetail((prev) =>
          prev && prev.id === schoolId ? { ...prev, isFavourite: false } : prev
        );
        showSuccess('Đã gỡ khỏi yêu thích');
        return true;
      } catch (e) {
        showError(e instanceof Error ? e.message : 'Thao tác yêu thích thất bại');
        return false;
      }
    },
    [schools, favouriteIdBySchoolId, showSuccess, showError]
  );

  const handleUnfavouritedFromList = useCallback((schoolId: number) => {
    setSchools((prev) =>
      prev.map((s) => (s.id === schoolId ? { ...s, isFavourite: false } : s))
    );
    setSelectedSchoolDetail((prev) =>
      prev && prev.id === schoolId ? { ...prev, isFavourite: false } : prev
    );
    setFavouriteIdBySchoolId((prev) => {
      const next = { ...prev };
      delete next[schoolId];
      return next;
    });
  }, []);

  const closeStudentPicker = useCallback(() => {
    setStudentPickerVisible(false);
    setStudentPickerCampusId(null);
    setStudentPickerOptions([]);
  }, []);

  const createConsultConversation = useCallback(
    async (campusId: number, studentProfileId: number) => {
      if (!user?.email?.trim()) {
        showError('Không tìm thấy email phụ huynh để tạo cuộc trò chuyện');
        return;
      }
      if (!selectedSchoolDetail) {
        showError('Không có dữ liệu trường để liên hệ tư vấn');
        return;
      }

      const campus = selectedSchoolDetail.campusList.find((it) => Number(it.id) === Number(campusId));
      const counsellorEmail = campus?.consultantEmails.find((email) => email?.trim())?.trim();
      if (!campus || !counsellorEmail) {
        showError('Cơ sở đã chọn chưa có thông tin tư vấn viên');
        return;
      }

      const openChatByConversationId = async (conversationId: string) => {
        // Lấy lại metadata conversation từ BE để tránh lệch campus/student khi BE trả về conversation cũ.
        let resolvedCampusId: number | string = campus.id;
        let resolvedStudentProfileId: number | string = studentProfileId;
        let resolvedCounsellorEmail = counsellorEmail;
        let resolvedCounsellorName = selectedSchoolDetail.name;
        let resolvedSchoolLogoUrl = selectedSchoolDetail.logoUrl ?? null;
        try {
          const listRes = await fetchParentConversations();
          const items: any[] = Array.isArray(listRes.body?.items) ? (listRes.body.items as any[]) : [];
          const matched: any = items.find((it) => String(it?.conversationId ?? it?.id ?? '') === conversationId);
          if (matched) {
            const matchedCampus = asString(matched?.campusId);
            const matchedStudent = asString(matched?.studentId ?? matched?.studentProfileId);
            const matchedCounsellor =
              sanitizeCounsellorEmail(matched?.otherUser) ??
              sanitizeCounsellorEmail(matched?.counsellorEmail);
            const matchedCounsellorName =
              asString(matched?.counsellorName) ??
              asString(matched?.schoolName) ??
              asString(matched?.name);
            const matchedSchoolLogoUrl = asString(matched?.schoolLogoUrl);
            if (matchedCampus != null && matchedCampus.trim() !== '') resolvedCampusId = matchedCampus;
            if (matchedStudent != null && matchedStudent.trim() !== '') resolvedStudentProfileId = matchedStudent;
            if (matchedCounsellor != null && matchedCounsellor.trim() !== '') {
              resolvedCounsellorEmail = matchedCounsellor;
            }
            if (matchedCounsellorName != null && matchedCounsellorName.trim() !== '') {
              resolvedCounsellorName = matchedCounsellorName;
            }
            if (matchedSchoolLogoUrl != null && matchedSchoolLogoUrl.trim() !== '') {
              resolvedSchoolLogoUrl = matchedSchoolLogoUrl;
            }
          }
        } catch {
          // Best-effort: fallback dữ liệu local vẫn mở chat được.
        }

        setSelectedConversation({
          conversationId,
          campusId: resolvedCampusId,
          studentProfileId: resolvedStudentProfileId,
          counsellorEmail: resolvedCounsellorEmail,
          counsellorName: resolvedCounsellorName,
          schoolId: selectedSchoolDetail.id,
          schoolName: selectedSchoolDetail.name,
          schoolLogoUrl: resolvedSchoolLogoUrl,
        });
        setSchoolDetailVisible(false);
        setSelectedSchoolId(null);
        setSelectedSchoolDetail(null);
        closeStudentPicker();
        setChatView('chat');
      };

      setConsultLoading(true);
      try {
        const res = await createParentConversation({
          parentEmail: user.email.trim(),
          campusId: campus.id,
          studentProfileId,
        });
        const conversationId = String(res.body ?? '').trim();
        if (!conversationId) {
          throw new Error('Không nhận được conversationId từ máy chủ');
        }
        await openChatByConversationId(conversationId);
      } catch (e) {
        if (e instanceof ApiError && e.status === 400) {
          try {
            const historyRes = await fetchParentMessagesHistory(
              user.email.trim(),
              campus.id,
              studentProfileId
            );
            const existingConversationId = String(historyRes.body?.conversationId ?? '').trim();
            if (!existingConversationId) {
              throw new Error('Không tìm thấy conversation hiện có để tiếp tục tư vấn');
            }
            await openChatByConversationId(existingConversationId);
          } catch (fallbackError) {
            showError(
              fallbackError instanceof Error
                ? fallbackError.message
                : 'Không thể mở lại cuộc trò chuyện tư vấn hiện có'
            );
          }
        } else {
          showError(e instanceof Error ? e.message : 'Không thể tạo cuộc trò chuyện tư vấn');
        }
      } finally {
        setConsultLoading(false);
      }
    },
    [closeStudentPicker, selectedSchoolDetail, showError, user?.email]
  );

  const handleContactConsult = useCallback(async (campusId: number) => {
    if (!user?.email?.trim()) {
      showError('Không tìm thấy email phụ huynh để tạo cuộc trò chuyện');
      return;
    }
    if (!selectedSchoolDetail) {
      showError('Không có dữ liệu trường để liên hệ tư vấn');
      return;
    }

    const campus = selectedSchoolDetail.campusList.find((it) => Number(it.id) === Number(campusId));
    if (!campus) {
      showError('Cơ sở đã chọn chưa có thông tin tư vấn viên');
      return;
    }

    setConsultLoading(true);
    let studentPool: ParentStudentProfile[] = [];
    try {
      const res = await fetchParentStudents();
      studentPool = Array.isArray(res.body) ? res.body : [];
      setStudents(studentPool);
    } catch {
      studentPool = [];
    }

    const validStudents = studentPool.filter((s) => Number.isFinite(Number(s.id)));
    if (validStudents.length === 0) {
      setConsultLoading(false);
      Alert.alert(
        'Thiếu hồ sơ học sinh',
        'Hãy thêm hồ sơ học sinh trước khi nhắn tin với trường',
        [
          {
            text: 'Đồng ý',
            onPress: () => {
              setSchoolDetailVisible(false);
              setSelectedSchoolId(null);
              setSelectedSchoolDetail(null);
              closeStudentPicker();
              setActiveTab('account');
              setStudentFormInitial(null);
              setShowStudentForm(true);
            },
          },
        ]
      );
      return;
    }

    if (validStudents.length > 1) {
      setStudentPickerCampusId(campus.id);
      setStudentPickerOptions(validStudents);
      setStudentPickerVisible(true);
      setConsultLoading(false);
      return;
    }

    const firstStudentId = Number(validStudents[0].id);
    void createConsultConversation(campus.id, firstStudentId);
  }, [closeStudentPicker, createConsultConversation, selectedSchoolDetail, showError, user?.email]);

  useEffect(() => {
    refreshSchools();
  }, [refreshSchools]);

  useEffect(() => {
    if (activeTab !== 'account' || !user) return;
    let cancelled = false;
    setStudentsLoading(true);
    (async () => {
      try {
        const [stuRes, perRes] = await Promise.all([
          fetchParentStudents(),
          fetchParentPersonalityTypes(),
        ]);
        if (cancelled) return;
        setStudents(Array.isArray(stuRes.body) ? stuRes.body : []);
        setPersonalityGrouped(
          perRes.body && typeof perRes.body === 'object' ? perRes.body : null
        );
      } catch {
        if (!cancelled) {
          setStudents([]);
          setPersonalityGrouped(null);
        }
      } finally {
        if (!cancelled) setStudentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, user?.email]);

  useEffect(() => {
    if (!user) {
      setProfileData(null);
      setProfileChecked(false);
      setShowProfileSheet(false);
      return;
    }
    let cancelled = false;
    getProfile()
      .then((res) => {
        if (cancelled) return;
        setProfileData(res.body);
        setProfileChecked(true);
        if (res.body.firstLogin || !isProfileComplete(res.body)) {
          setShowProfileSheet(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setProfileChecked(true);
        if (user.firstLogin) setShowProfileSheet(true);
      });
    return () => { cancelled = true; };
  }, [user?.email]);

  const handleProfileSaved = () => {
    setShowProfileForm(false);
    getProfile().then((res) => setProfileData(res.body));
  };

  /** Chỉ tab Trang chủ dùng gradient + ô tìm + thông báo; tab Trường có header chữ trong `headerPlain`. */
  const showSearchInHeader = activeTab === 'home';

  const addRecent = (term: string) => {
    setRecentSearches((prev) => {
      const next = [term, ...prev.filter((t) => t !== term)].slice(0, MAX_RECENT_SEARCHES);
      return next;
    });
  };

  if (chatView === 'chat' && selectedConversation) {
    const { parentEmail: resolvedParent, counsellorEmail: resolvedCounsellor } = resolveParentChatEmails(
      selectedConversation,
      user?.email ?? ''
    );
    return (
      <ChatScreen
        conversationId={selectedConversation.conversationId}
        campusId={selectedConversation.campusId!}
        studentProfileId={selectedConversation.studentProfileId!}
        parentEmail={resolvedParent}
        counsellorEmail={resolvedCounsellor}
        counsellorName={selectedConversation.counsellorName ?? undefined}
        counsellorAvatarUrl={selectedConversation.schoolLogoUrl ?? undefined}
        initialLastMessageContent={selectedConversation.lastMessageContent ?? undefined}
        initialLastMessageAt={selectedConversation.lastMessageAt ?? undefined}
        onBack={() => setChatView('app')}
      />
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header: gradient + search + notification (Trang chủ); các tab khác: tiêu đề */}
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
                <MaterialIcons name="search" size={20} color="rgba(255,255,255,0.9)" />
                <Text style={styles.searchPlaceholderText}>
                  Tìm trường, địa điểm...
                </Text>
              </Pressable>
              <Pressable style={styles.notifButton}>
                <MaterialIcons name="notifications-none" size={24} color="#fff" />
              </Pressable>
            </View>
          </View>
        </LinearGradient>
      ) : (
        <View style={[styles.headerPlain, { paddingTop: HEADER_TOP_PADDING }]}>
          <Text style={styles.headerPlainTitle}>
            {activeTab === 'consult'
              ? 'Tư vấn'
              : activeTab === 'schools'
                ? 'Trường'
                : 'Tài khoản'}
          </Text>
        </View>
      )}

      {/* Tab content: tab Trường dùng FlatList + refresh + lazy load */}
      <View style={styles.tabBody}>
        {activeTab === 'schools' ? (
          <SchoolsTabScreen
            schools={schools}
            loading={schoolsLoading}
            refreshing={schoolsRefreshing}
            errorMessage={schoolsError}
            onRefresh={() => refreshSchools('pull')}
            onRetry={() => refreshSchools('initial')}
            onOpenSchool={openSchoolDetail}
            onToggleFavourite={toggleSchoolFavourite}
          />
        ) : activeTab === 'consult' ? (
          <ConversationsScreen
            parentEmail={user?.email ?? ''}
            onBack={() => {}}
            showNavigationHeader={false}
            onOpenChat={(conversation) => {
              setSelectedConversation(conversation);
              setChatView('chat');
            }}
          />
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {activeTab === 'home' && (
              <HomeTabScreen
                schools={schools}
                onOpenSchool={openSchoolDetail}
                onToggleFavourite={toggleSchoolFavourite}
                onViewAllFeaturedSchools={() => setActiveTab('schools')}
                onOpenConsult={() => setActiveTab('consult')}
                onOpenNews={() => setNewsModalVisible(true)}
                onOpenPosts={() => setPostFeedVisible(true)}
                onOpenAiAssistant={() => setAiAssistantVisible(true)}
              />
            )}
            {activeTab === 'account' && (
              <AccountTabScreen
                profileData={profileData}
                onEditProfile={() => setShowProfileForm(true)}
                students={students}
                studentsLoading={studentsLoading}
                onAddChild={() => {
                  setStudentFormInitial(null);
                  setShowStudentForm(true);
                }}
                onOpenChild={(s) => {
                  setProfileStudent(s);
                  setShowStudentProfile(true);
                }}
                onOpenFavourites={() => setFavouriteModalVisible(true)}
              />
            )}
            <View style={styles.bottomSpacer} />
          </ScrollView>
        )}
      </View>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={styles.tabButton}
          >
            <MaterialIcons name={tab.icon as any} size={24} color={activeTab === tab.id ? '#1976d2' : '#94a3b8'} />
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
        visible={postFeedVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setPostFeedVisible(false)}
      >
        <PostFeedScreen onClose={() => setPostFeedVisible(false)} />
      </Modal>

      <Modal
        visible={aiAssistantVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setAiAssistantVisible(false)}
      >
        <AiAssistantChatScreen
          sessionId={user?.email ?? ''}
          onBack={() => setAiAssistantVisible(false)}
        />
      </Modal>

      <Modal
        visible={newsModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setNewsModalVisible(false)}
      >
        <View style={styles.newsModalScreen}>
          <View style={[styles.newsModalHeader, { paddingTop: HEADER_TOP_PADDING }]}>
            <Pressable onPress={() => setNewsModalVisible(false)} hitSlop={12} style={styles.newsModalBack}>
              <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
            </Pressable>
            <Text style={styles.newsModalTitle}>Tin tức</Text>
            <View style={styles.newsModalHeaderSpacer} />
          </View>
          <View style={styles.newsModalBody}>
            <NewsTabScreen />
          </View>
        </View>
      </Modal>

      <Modal
        visible={searchVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setSearchVisible(false)}
      >
        <SearchScreen
          onClose={() => setSearchVisible(false)}
          schools={schools}
          recentSearches={recentSearches}
          onSelectSchool={(schoolId) => {
            setSearchVisible(false);
            openSchoolDetail(schoolId);
          }}
          onToggleFavourite={toggleSchoolFavourite}
          onClearRecent={() => setRecentSearches([])}
          onAddRecent={addRecent}
        />
      </Modal>

      <Modal
        visible={favouriteModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setFavouriteModalVisible(false)}
      >
        <FavouriteSchoolsScreen
          visible={favouriteModalVisible}
          onClose={() => setFavouriteModalVisible(false)}
          onUnfavourited={handleUnfavouritedFromList}
          onToggleSchoolFavourite={toggleSchoolFavourite}
          getIsSchoolFavourite={(id) =>
            schools.find((s) => s.id === id)?.isFavourite ?? false
          }
          onExploreSchools={() => {
            setFavouriteModalVisible(false);
            setActiveTab('schools');
          }}
        />
      </Modal>

      <SchoolDetailModal
        visible={schoolDetailVisible}
        loading={schoolDetailLoading}
        consultLoading={consultLoading}
        school={selectedSchoolDetail}
        studentPickerVisible={studentPickerVisible}
        studentPickerOptions={studentPickerOptions}
        studentPickerCampusName={
          studentPickerCampusId == null
            ? null
            : selectedSchoolDetail?.campusList.find((campus) => campus.id === studentPickerCampusId)?.name ?? null
        }
        onCloseStudentPicker={closeStudentPicker}
        onSelectStudent={(studentId) => {
          if (studentPickerCampusId == null) return;
          void createConsultConversation(studentPickerCampusId, studentId);
        }}
        isFavourite={
          selectedSchoolId != null
            ? schools.find((item) => item.id === selectedSchoolId)?.isFavourite ?? false
            : false
        }
        onContactConsult={handleContactConsult}
        onToggleFavourite={() => {
          if (selectedSchoolId != null) toggleSchoolFavourite(selectedSchoolId);
        }}
        onClose={() => {
          setSchoolDetailVisible(false);
          setSelectedSchoolId(null);
          setSelectedSchoolDetail(null);
          closeStudentPicker();
        }}
      />

      <CompleteProfileBottomSheet
        visible={showProfileSheet}
        onComplete={() => {
          setShowProfileSheet(false);
          setShowProfileForm(true);
        }}
        onDismiss={() => setShowProfileSheet(false)}
      />

      <ParentProfileFormScreen
        visible={showProfileForm}
        initialData={profileData?.parent ?? null}
        onSaved={handleProfileSaved}
        onClose={() => setShowProfileForm(false)}
      />

      <StudentProfileScreen
        visible={showStudentProfile}
        student={profileStudent}
        personalityGrouped={personalityGrouped}
        onClose={() => {
          setShowStudentProfile(false);
          setProfileStudent(null);
        }}
        onEdit={(s) => {
          setShowStudentProfile(false);
          setStudentFormInitial(s);
          setShowStudentForm(true);
        }}
      />

      <StudentProfileFormScreen
        visible={showStudentForm}
        initialStudent={studentFormInitial}
        onClose={() => {
          setShowStudentForm(false);
          setStudentFormInitial(null);
        }}
        onSaved={() => {
          refreshStudents();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  tabBody: {
    flex: 1,
  },
  header: {
    paddingBottom: sp.lg,
  },
  headerPlain: {
    backgroundColor: '#fff',
    paddingHorizontal: sp.lg,
    paddingBottom: sp.lg,
  },
  headerPlainTitle: {
    fontSize: 25,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: sp.lg,
  },
  headerInner: {
    paddingHorizontal: sp.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    marginTop: sp.xs,
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
  newsModalScreen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  newsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sp.lg,
    paddingBottom: sp.md,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  newsModalBack: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newsModalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  newsModalHeaderSpacer: {
    width: 40,
  },
  newsModalBody: {
    flex: 1,
  },
});
