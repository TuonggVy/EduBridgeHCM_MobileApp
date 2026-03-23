import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
const Ionicons = require('@expo/vector-icons').Ionicons;
import { updateProfile } from '../api/profile';
import type { ParentInfo, ParentDataInput } from '../types/auth';
import { useToast } from '../components/AppToast';

const radius = { sm: 8, md: 12, lg: 16, xl: 20 } as const;

type ParentProfileFormScreenProps = {
  visible: boolean;
  initialData?: ParentInfo | null;
  onSaved: () => void;
  onClose: () => void;
};

const GENDER_OPTIONS = [
  { value: 'MALE', label: 'Nam' },
  { value: 'FEMALE', label: 'Nữ' },
  { value: 'OTHER', label: 'Khác' },
];

/** BE chỉ chấp nhận các giá trị cố định; không gửi text tự do. */
const RELATIONSHIP_OPTIONS = [
  { value: 'FATHER', label: 'Bố' },
  { value: 'MOTHER', label: 'Mẹ' },
  { value: 'GRANDFATHER', label: 'Ông' },
  { value: 'GRANDMOTHER', label: 'Bà' },
  { value: 'GUARDIAN', label: 'Người giám hộ' },
  { value: 'OTHER', label: 'Khác' },
];

export default function ParentProfileFormScreen({
  visible,
  initialData,
  onSaved,
  onClose,
}: ParentProfileFormScreenProps) {
  const { showWarning, showError, showSuccess } = useToast();
  const [name, setName] = useState(initialData?.name ?? '');
  const [phone, setPhone] = useState(initialData?.phone ?? '');
  const [idCardNumber, setIdCardNumber] = useState(initialData?.idCardNumber ?? '');
  const [showIdCardPreview, setShowIdCardPreview] = useState(false);
  const [gender, setGender] = useState(initialData?.gender ?? '');
  const [relationship, setRelationship] = useState(initialData?.relationship ?? '');
  const [workplace, setWorkplace] = useState(initialData?.workplace ?? '');
  const [occupation, setOccupation] = useState(initialData?.occupation ?? '');
  const [currentAddress, setCurrentAddress] = useState(initialData?.currentAddress ?? '');
  const [saving, setSaving] = useState(false);

  /** Đã lưu CCCD rồi thì không cho sửa, chỉ xem (3 số đầu khi bấm View). */
  const idCardLocked = !!(initialData?.idCardNumber?.trim());

  useEffect(() => {
    if (visible && initialData) {
      setName(initialData.name ?? '');
      setPhone(initialData.phone ?? '');
      setIdCardNumber(initialData.idCardNumber ?? '');
      setShowIdCardPreview(false);
      setGender(initialData.gender ?? '');
      setRelationship(initialData.relationship ?? '');
      setWorkplace(initialData.workplace ?? '');
      setOccupation(initialData.occupation ?? '');
      setCurrentAddress(initialData.currentAddress ?? '');
    }
  }, [visible, initialData]);

  const handleIdCardChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 12);
    setIdCardNumber(digits);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName || !trimmedPhone) {
      showWarning('Vui lòng nhập Họ tên và Số điện thoại.', 'Warning');
      return;
    }

    const trimmedIdCard = idCardNumber.trim();
    if (trimmedIdCard) {
      if (trimmedIdCard.length !== 12) {
        showWarning('Số CCCD/CMND phải đúng 12 chữ số.', 'Warning');
        return;
      }
      if (/\D/.test(trimmedIdCard)) {
        showWarning('Số CCCD/CMND chỉ được nhập 12 chữ số.', 'Warning');
        return;
      }
    }

    setSaving(true);
    try {
      const parentData: ParentDataInput = {
        name: trimmedName,
        phone: trimmedPhone,
        idCardNumber: trimmedIdCard || undefined,
        gender: gender || undefined,
        relationship: relationship || undefined,
        workplace: workplace || undefined,
        occupation: occupation || undefined,
        currentAddress: currentAddress || undefined,
      };
      await updateProfile({ parentData });
      showSuccess('Profile updated', 'Success');
      onSaved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không lưu được hồ sơ';
      showError(msg, 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeButton} hitSlop={12}>
            <Ionicons name="close" size={26} color="#64748b" />
          </Pressable>
          <Text style={styles.headerTitle}>Hoàn thiện hồ sơ</Text>
          <View style={styles.closeButton} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.field}>
            <Text style={styles.label}>Họ và tên <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Nhập họ tên"
              placeholderTextColor="#94a3b8"
              autoCapitalize="words"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Số điện thoại <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Nhập số điện thoại"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Số CCCD/CMND</Text>
            {idCardLocked ? (
              <View style={styles.idCardRow}>
                <Text style={styles.idCardMasked}>
                  {showIdCardPreview
                    ? idCardNumber.slice(0, 3) + '*********'
                    : '••••••••••••'}
                </Text>
                <Pressable
                  onPress={() => setShowIdCardPreview((v) => !v)}
                  style={({ pressed }) => [styles.viewIdCardButton, pressed && styles.viewIdCardButtonPressed]}
                >
                  <Ionicons name={showIdCardPreview ? 'eye-off-outline' : 'eye-outline'} size={20} color="#1976d2" />
                  <Text style={styles.viewIdCardText}>{showIdCardPreview ? 'Ẩn' : 'Xem'}</Text>
                </Pressable>
              </View>
            ) : (
              <TextInput
                style={styles.input}
                value={idCardNumber}
                onChangeText={handleIdCardChange}
                placeholder="Nhập đúng 12 chữ số CCCD"
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
                maxLength={12}
              />
            )}
            {!idCardLocked && (
              <Text style={styles.idCardHint}>Chỉ được nhập 1 lần, đúng 12 chữ số.</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Giới tính</Text>
            <View style={styles.chipRow}>
              {GENDER_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setGender(opt.value)}
                  style={[
                    styles.chip,
                    gender === opt.value && styles.chipActive,
                  ]}
                >
                  <Text style={[styles.chipText, gender === opt.value && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mối quan hệ với học sinh</Text>
            <View style={styles.chipRow}>
              {RELATIONSHIP_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setRelationship(opt.value)}
                  style={[
                    styles.chip,
                    relationship === opt.value && styles.chipActive,
                  ]}
                >
                  <Text style={[styles.chipText, relationship === opt.value && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Nơi công tác</Text>
            <TextInput
              style={styles.input}
              value={workplace}
              onChangeText={setWorkplace}
              placeholder="Nhập nơi công tác"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Nghề nghiệp</Text>
            <TextInput
              style={styles.input}
              value={occupation}
              onChangeText={setOccupation}
              placeholder="Nhập nghề nghiệp"
              placeholderTextColor="#94a3b8"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Địa chỉ hiện tại</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={currentAddress}
              onChangeText={setCurrentAddress}
              placeholder="Nhập địa chỉ"
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
            />
          </View>

          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.submitButton,
              (pressed || saving) && styles.submitButtonPressed,
            ]}
          >
            <LinearGradient
              colors={['#1976d2', '#42a5f5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitGradient}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Lưu hồ sơ</Text>
              )}
            </LinearGradient>
          </Pressable>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: Platform.OS === 'ios' ? 54 : 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  closeButton: {
    width: 40,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  required: {
    color: '#dc2626',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0f172a',
  },
  idCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  idCardMasked: {
    fontSize: 16,
    color: '#0f172a',
    letterSpacing: 2,
  },
  viewIdCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  viewIdCardButtonPressed: {
    opacity: 0.7,
  },
  viewIdCardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
  },
  idCardHint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.lg,
    backgroundColor: '#f1f5f9',
  },
  chipActive: {
    backgroundColor: '#dbeafe',
  },
  chipText: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#1976d2',
  },
  submitButton: {
    marginTop: 12,
    borderRadius: radius.lg,
    overflow: 'hidden',
    minHeight: 52,
    justifyContent: 'center',
  },
  submitButtonPressed: {
    opacity: 0.9,
  },
  submitGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  bottomSpacer: {
    height: 40,
  },
});
