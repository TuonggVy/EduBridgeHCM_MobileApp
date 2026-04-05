import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { ProfileGetBody } from '../../types/auth';
import type { ParentStudentProfile } from '../../types/studentProfile';
import { formatGradeLevel } from '../../utils/gradeLevel';
import { MaterialIcons, sp, radius } from './tabConstants';

const PROFILE_MENU_ACTIVITIES: { id: string; label: string; icon: string }[] = [
  { id: 'consultation', label: 'Lịch sử tư vấn', icon: 'forum' },
  { id: 'saved', label: 'Trường đã lưu', icon: 'bookmark-border' },
  { id: 'application', label: 'Trạng thái hồ sơ', icon: 'description' },
];

const PROFILE_MENU_QUICK: { id: string; label: string; icon: string }[] = [
  { id: 'favourites', label: 'Trường yêu thích', icon: 'favorite' },
  { id: 'compare', label: 'So sánh trường', icon: 'compare-arrows' },
  { id: 'plans', label: 'Kế hoạch tuyển sinh', icon: 'calendar-today' },
  { id: 'notifications', label: 'Thông báo', icon: 'notifications-none' },
  { id: 'support', label: 'Hỗ trợ', icon: 'help-outline' },
];

const PROFILE_MENU_SETTINGS: { id: string; label: string; icon: string }[] = [
  { id: 'account', label: 'Tài khoản', icon: 'person-outline' },
  { id: 'privacy', label: 'Quyền riêng tư', icon: 'security' },
  { id: 'language', label: 'Ngôn ngữ', icon: 'language' },
  { id: 'help', label: 'Trung tâm trợ giúp', icon: 'info' },
];

export type AccountTabScreenProps = {
  profileData: ProfileGetBody | null;
  onEditProfile: () => void;
  students: ParentStudentProfile[];
  studentsLoading: boolean;
  onAddChild: () => void;
  onOpenChild: (s: ParentStudentProfile) => void;
  onOpenFavourites: () => void;
};

export function AccountTabScreen({
  profileData,
  onEditProfile,
  students,
  studentsLoading,
  onAddChild,
  onOpenChild,
  onOpenFavourites,
}: AccountTabScreenProps) {
  const { user, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const displayName =
    profileData?.parent?.name?.trim() ||
    user?.email?.split('@')[0] ||
    'Phụ huynh';

  const avatarUrl = profileData?.parent?.avatar?.trim() || '';

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
            <MaterialIcons name={item.icon as any} size={22} color="#64748b" />
            <Text style={styles.profileMenuItemLabel}>{item.label}</Text>
            <MaterialIcons name="chevron-right" size={20} color="#cbd5e1" />
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.profileScreen}>
      <View style={styles.profileHeaderCard}>
        <View style={styles.profileHeaderRow}>
          <View style={styles.profileAvatarLarge}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.profileAvatarImage}
                resizeMode="cover"
              />
            ) : (
              <MaterialIcons name="account-circle" size={40} color="#64748b" />
            )}
          </View>
          <View style={styles.profileHeaderInfo}>
            <Text style={styles.profileUserName}>{displayName}</Text>
            <Text style={styles.profileUserEmail} numberOfLines={1}>
              {user?.email ?? ''}
            </Text>
            <Pressable
              onPress={onEditProfile}
              style={({ pressed }) => [
                styles.profileEditButton,
                pressed && styles.profileEditButtonPressed,
              ]}
            >
              <MaterialIcons name="edit" size={16} color="#1976d2" />
              <Text style={styles.profileEditButtonText}>Chỉnh sửa</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.profileSectionCard}>
        <View style={styles.profileSectionRow}>
          <Text style={styles.profileSectionTitle}>Con của tôi</Text>
          <Pressable onPress={onAddChild} style={styles.profileAddButton}>
            <MaterialIcons name="add-circle-outline" size={22} color="#1976d2" />
            <Text style={styles.profileAddButtonText}>Thêm con</Text>
          </Pressable>
        </View>
        {studentsLoading ? (
          <View style={styles.profileChildrenSkeleton}>
            <Text style={styles.profileSkeletonText}>Đang tải hồ sơ con…</Text>
          </View>
        ) : students.length === 0 ? (
          <View style={styles.profileEmptyChildren}>
            <View style={styles.profileEmptyIconWrap}>
              <MaterialIcons name="people-outline" size={48} color="#c7d2fe" />
            </View>
            <Text style={styles.profileEmptyTitle}>Chưa có hồ sơ con</Text>
            <Text style={styles.profileEmptySub}>
              Thêm hồ sơ để lưu MBTI, điểm số và định hướng nghề nghiệp cho con.
            </Text>
            <Pressable onPress={onAddChild} style={({ pressed }) => [styles.profileEmptyCta, pressed && { opacity: 0.9 }]}>
              <MaterialIcons name="add" size={22} color="#fff" />
              <Text style={styles.profileEmptyCtaText}>Thêm con</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.profileChildrenList}>
            {students.map((child, index) => {
              const key = child.id != null ? String(child.id) : `student-${index}`;
              const grade = formatGradeLevel(child.academicInfos?.[0]?.gradeLevel);
              const meta = [child.gender === 'MALE' ? 'Nam' : child.gender === 'FEMALE' ? 'Nữ' : child.gender, grade]
                .filter(Boolean)
                .join(' · ');
              return (
                <Pressable
                  key={key}
                  onPress={() => onOpenChild(child)}
                  style={({ pressed }) => [styles.profileChildItem, pressed && { opacity: 0.85 }]}
                >
                  <View style={styles.profileChildAvatar}>
                    <MaterialIcons name="sentiment-satisfied" size={24} color="#1976d2" />
                  </View>
                  <View style={styles.profileChildInfo}>
                    <Text style={styles.profileChildName}>{child.studentName}</Text>
                    <Text style={styles.profileChildMeta} numberOfLines={1}>
                      {meta || 'Xem hồ sơ chi tiết'}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#cbd5e1" />
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <MenuCard
        title="Hoạt động của tôi"
        items={PROFILE_MENU_ACTIVITIES}
        onItemPress={() => {}}
      />

      <MenuCard
        title="Truy cập nhanh"
        items={PROFILE_MENU_QUICK}
        onItemPress={(id) => {
          if (id === 'favourites') onOpenFavourites();
        }}
      />

      <MenuCard
        title="Cài đặt"
        items={PROFILE_MENU_SETTINGS}
        onItemPress={() => {}}
      />

      <Pressable
        style={({ pressed }) => [styles.profileLogoutButton, pressed && styles.profileLogoutButtonPressed]}
        onPress={() => setShowLogoutConfirm(true)}
      >
        <MaterialIcons name="logout" size={22} color="#dc2626" />
        <Text style={styles.profileLogoutButtonText}>Đăng xuất</Text>
      </Pressable>

      <ConfirmDialog
        visible={showLogoutConfirm}
        title="Đăng xuất"
        message="Bạn có chắc chắn muốn đăng xuất?"
        cancelLabel="Hủy"
        confirmLabel="Đăng xuất"
        confirmRole="destructive"
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          logout();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
    overflow: 'hidden',
  },
  profileAvatarImage: {
    width: 72,
    height: 72,
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
  profileChildrenSkeleton: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  profileSkeletonText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  profileEmptyChildren: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 8,
  },
  profileEmptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  profileEmptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  profileEmptySub: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  profileEmptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  profileEmptyCtaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
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
