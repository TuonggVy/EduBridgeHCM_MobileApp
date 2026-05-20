import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
const MaterialIcons = require('@expo/vector-icons').MaterialIcons;
import {
  fetchAdmissionReservationForms,
  type ReservationMandatoryDocument,
  type ReservationMethodDocument,
} from '../api/admissionReservation';
import { ImageViewerModal } from './ImageViewerModal';

type Props = {
  visible: boolean;
  admissionFormId: number;
  schoolName?: string | null;
  studentName?: string | null;
  onClose: () => void;
};

function DocumentRow({
  name,
  required,
  templateUrl,
  onViewTemplate,
}: {
  name: string;
  required: boolean;
  templateUrl?: string | null;
  onViewTemplate: (url: string) => void;
}) {
  const trimmedTemplate = templateUrl?.trim() ?? '';
  const hasTemplate = Boolean(trimmedTemplate);
  return (
    <View style={styles.docRow}>
      <View style={styles.docIconWrap}>
        <MaterialIcons name="description" size={20} color="#1976d2" />
      </View>
      <View style={styles.docBody}>
        <Text style={styles.docName}>{name}</Text>
        {required ? (
          <View style={styles.requiredBadge}>
            <Text style={styles.requiredBadgeText}>Bắt buộc</Text>
          </View>
        ) : (
          <Text style={styles.optionalText}>Không bắt buộc</Text>
        )}
      </View>
      {hasTemplate ? (
        <Pressable
          onPress={() => onViewTemplate(trimmedTemplate)}
          style={({ pressed }) => [styles.templateBtn, pressed && { opacity: 0.88 }]}
          accessibilityLabel="Xem mẫu hồ sơ"
        >
          <MaterialIcons name="image" size={18} color="#1976d2" />
        </Pressable>
      ) : null}
    </View>
  );
}

function Section({
  title,
  subtitle,
  emptyHint,
  children,
}: {
  title: string;
  subtitle: string;
  emptyHint: string;
  children: React.ReactNode;
}) {
  const isEmpty = React.Children.count(children) === 0;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSub}>{subtitle}</Text>
      {isEmpty ? (
        <View style={styles.emptySection}>
          <MaterialIcons name="info-outline" size={18} color="#94a3b8" />
          <Text style={styles.emptySectionText}>{emptyHint}</Text>
        </View>
      ) : (
        <View style={styles.docList}>{children}</View>
      )}
    </View>
  );
}

export function RequiredSubmissionDocumentsModal({
  visible,
  admissionFormId,
  schoolName,
  studentName,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mandatoryDocuments, setMandatoryDocuments] = useState<ReservationMandatoryDocument[]>([]);
  const [methodDocuments, setMethodDocuments] = useState<ReservationMethodDocument[]>([]);
  const [templatePreviewUri, setTemplatePreviewUri] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdmissionReservationForms('RESERVATION_CONFIRMED');
      const item = res.body.find((f) => f.id === admissionFormId);
      if (!item) {
        setMandatoryDocuments([]);
        setMethodDocuments([]);
        setError('Không tìm thấy thông tin hồ sơ cần nộp cho đơn này.');
        return;
      }
      setMandatoryDocuments(item.mandatoryDocuments ?? []);
      setMethodDocuments(item.methodDocuments ?? []);
    } catch (e: unknown) {
      setMandatoryDocuments([]);
      setMethodDocuments([]);
      setError(e instanceof Error ? e.message : 'Không tải được danh sách hồ sơ.');
    } finally {
      setLoading(false);
    }
  }, [admissionFormId]);

  useEffect(() => {
    if (!visible) return;
    void loadDocuments();
  }, [visible, loadDocuments]);

  useEffect(() => {
    if (!visible) setTemplatePreviewUri(null);
  }, [visible]);

  if (!visible) return null;

  const schoolLabel = schoolName?.trim() || 'Đơn giữ chỗ';
  const studentLabel = studentName?.trim();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <LinearGradient colors={['#f8fafc', '#f1f5f9']} style={styles.screen}>
        <StatusBar barStyle="dark-content" />
        <View style={[styles.headerShell, { paddingTop: insets.top + 8 }]}>
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.backBtn}>
              <MaterialIcons name="arrow-back-ios-new" size={18} color="#0f172a" />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Hồ sơ cần nộp</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {schoolLabel}
                {studentLabel ? ` · ${studentLabel}` : ''}
              </Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color="#1976d2" />
            <Text style={styles.loadingText}>Đang tải danh sách hồ sơ…</Text>
          </View>
        ) : error ? (
          <View style={styles.centerWrap}>
            <MaterialIcons name="error-outline" size={40} color="#dc2626" />
            <Text style={styles.errorTitle}>Không tải được</Text>
            <Text style={styles.errorSub}>{error}</Text>
            <Pressable onPress={() => void loadDocuments()} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hintCard}>
              <MaterialIcons name="info" size={20} color="#1976d2" />
              <Text style={styles.hintText}>
                Danh sách tài liệu cần nộp sau khi xác nhận nhập học. Nhấn biểu tượng ảnh để xem mẫu (nếu có).
              </Text>
            </View>

            <Section
              title="Hồ sơ bắt buộc"
              subtitle="Áp dụng cho mọi hình thức xét tuyển"
              emptyHint="Trường chưa công bố hồ sơ bắt buộc."
            >
              {mandatoryDocuments.map((doc, index) => (
                <DocumentRow
                  key={`mandatory-${index}-${doc.name}`}
                  name={doc.name}
                  required={doc.required}
                  templateUrl={doc.templateFileUrl}
                  onViewTemplate={setTemplatePreviewUri}
                />
              ))}
            </Section>

            <Section
              title="Hồ sơ theo phương thức"
              subtitle="Theo hình thức xét tuyển đã chọn"
              emptyHint="Trường chưa công bố hồ sơ theo phương thức."
            >
              {methodDocuments.map((doc, index) => (
                <DocumentRow
                  key={`method-${index}-${doc.name}`}
                  name={doc.name}
                  required={doc.required}
                  templateUrl={doc.templateUrl}
                  onViewTemplate={setTemplatePreviewUri}
                />
              ))}
            </Section>
          </ScrollView>
        )}
      </LinearGradient>

      <ImageViewerModal
        visible={templatePreviewUri != null}
        uri={templatePreviewUri}
        onClose={() => setTemplatePreviewUri(null)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerShell: { paddingHorizontal: 14, paddingBottom: 8 },
  header: {
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  subtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 16 },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  loadingText: { fontSize: 13, color: '#64748b' },
  errorTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  errorSub: { fontSize: 13, color: '#64748b', textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    backgroundColor: '#1976d2',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  hintText: { flex: 1, fontSize: 13, color: '#1e40af', lineHeight: 19 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    gap: 10,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  sectionSub: { fontSize: 12, color: '#64748b', marginTop: -4 },
  docList: { gap: 10, marginTop: 4 },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  docIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docBody: { flex: 1, gap: 4 },
  docName: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  requiredBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef2f2',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  requiredBadgeText: { fontSize: 11, fontWeight: '700', color: '#b91c1c' },
  optionalText: { fontSize: 11, color: '#64748b' },
  templateBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  emptySectionText: { flex: 1, fontSize: 13, color: '#94a3b8' },
});
