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
import { fetchSchoolPublicDetail, fetchSchoolPublicList } from '../api/school';
import type { SchoolDetail, SchoolSummary } from '../types/school';
import { SchoolDetailModal } from '../components/SchoolDetailModal';

const HEADER_TOP_PADDING =
  Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight ?? 24) + 8;

const GRADIENT_COLORS = ['#1976d2', '#42a5f5', '#64b5f6'] as const;
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };

type TabId = 'home' | 'schools' | 'news' | 'account';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'home', label: 'Trang chủ', icon: 'home' },
  { id: 'schools', label: 'Trường', icon: 'school' },
  { id: 'news', label: 'Tin tức', icon: 'article' },
  { id: 'account', label: 'Tài khoản', icon: 'person' },
];

const MAX_RECENT_SEARCHES = 5;

// ─── Main (shell: header, bottom tabs, modals) ───────────────────────────────
export default function HomeScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [searchVisible, setSearchVisible] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [profileData, setProfileData] = useState<ProfileGetBody | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [chatView, setChatView] = useState<'app' | 'conversations' | 'chat'>('app');
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
  const [schoolsRefreshing, setSchoolsRefreshing] = useState(false);

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
      setSchools(Array.isArray(res.body) ? res.body : []);
    } catch (error) {
      setSchools([]);
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

  const toggleSchoolFavourite = useCallback((schoolId: number) => {
    setSchools((prev) =>
      prev.map((item) =>
        item.id === schoolId ? { ...item, isFavourite: !item.isFavourite } : item
      )
    );
    setSelectedSchoolDetail((prev) =>
      prev && prev.id === schoolId ? { ...prev, isFavourite: !prev.isFavourite } : prev
    );
  }, []);

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

  if (chatView === 'conversations') {
    return (
      <ConversationsScreen
        parentEmail={user?.email ?? ''}
        onBack={() => setChatView('app')}
        onOpenChat={(conversation) => {
          setSelectedConversation(conversation);
          setChatView('chat');
        }}
      />
    );
  }

  if (chatView === 'chat' && selectedConversation) {
    const { parentEmail: resolvedParent, counsellorEmail: resolvedCounsellor } = resolveParentChatEmails(
      selectedConversation,
      user?.email ?? ''
    );
    return (
      <ChatScreen
        conversationId={selectedConversation.conversationId}
        studentProfileId={selectedConversation.studentProfileId!}
        parentEmail={resolvedParent}
        counsellorEmail={resolvedCounsellor}
        counsellorName={selectedConversation.counsellorName ?? undefined}
        initialLastMessageContent={selectedConversation.lastMessageContent ?? undefined}
        initialLastMessageAt={selectedConversation.lastMessageAt ?? undefined}
        onBack={() => setChatView('conversations')}
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
            {activeTab === 'news'
              ? 'Tin tức'
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
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'home' && (
              <HomeTabScreen
                schools={schools}
                onOpenSearch={() => setSearchVisible(true)}
                onOpenSchool={openSchoolDetail}
                onToggleFavourite={toggleSchoolFavourite}
                onOpenConsult={() => setChatView('conversations')}
                onOpenNews={() => setActiveTab('news')}
              />
            )}
            {activeTab === 'news' && <NewsTabScreen />}
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

      <SchoolDetailModal
        visible={schoolDetailVisible}
        loading={schoolDetailLoading}
        school={selectedSchoolDetail}
        isFavourite={
          selectedSchoolId != null
            ? schools.find((item) => item.id === selectedSchoolId)?.isFavourite ?? false
            : false
        }
        onToggleFavourite={() => {
          if (selectedSchoolId != null) toggleSchoolFavourite(selectedSchoolId);
        }}
        onClose={() => {
          setSchoolDetailVisible(false);
          setSelectedSchoolId(null);
          setSelectedSchoolDetail(null);
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
});
