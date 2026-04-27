export type SchoolSummary = {
  foundingDate: string | null;
  websiteUrl: string | null;
  hotline: string | null;
  emailSupport: string | null;
  averageRating: number | null;
  name: string;
  description: string | null;
  id: number;
  isFavourite: boolean;
  representativeName: string | null;
  totalCampus: number;
  logoUrl: string | null;
};

export type SchoolCampus = {
  imageJson: string | null;
  address: string | null;
  city: string | null;
  ward: string | null;
  latitude: number | null;
  policyDetail: string | null;
  consultantEmails: string[];
  boardingType: string | null;
  phoneNumber: string | null;
  district: string | null;
  name: string;
  id: number;
  facility: {
    itemList?: Array<{
      name?: string | null;
      unit?: string | null;
      value?: number | null;
      isUsage?: boolean | null;
      category?: string | null;
      isCustom?: boolean | null;
      facilityCode?: string | null;
    }>;
    imageData?: {
      coverUrl?: string | null;
      imageList?: Array<{
        url?: string | null;
        name?: string | null;
        altName?: string | null;
        isUsage?: boolean | null;
      }>;
    };
  } | null;
  longitude: number | null;
  status: string | null;
};

export type SubjectJsonb = {
  name: string;
  description: string | null;
  isMandatory: boolean;
};

/** Phần tử trong `campusProgramOfferingList` — BE có thể mở rộng; client chỉ cần giữ nguyên cấu trúc khi cần. */
export type CurriculumProgramOffering = Record<string, unknown>;

export type CurriculumProgram = {
  baseTuitionFee: number | null;
  targetStudentDescription: string | null;
  name: string;
  campusProgramOfferingList: CurriculumProgramOffering[];
  graduationStandard: string | null;
  isActive: string | null;
};

export type Curriculum = {
  curriculumStatus: string;
  methodLearningList: string[];
  applicationYear: number;
  name: string;
  description: string | null;
  programList: CurriculumProgram[];
  subjectsJsonb: SubjectJsonb[];
  curriculumType: string;
  groupCode: string;
  /** @deprecated BE cũ — dùng `methodLearningList` */
  methodLearning?: string;
  /** @deprecated BE cũ — dùng `applicationYear` */
  enrollmentYear?: number;
};

export type SchoolDetail = SchoolSummary & {
  campusList: SchoolCampus[];
  /** @deprecated Field cũ bị typo, giữ lại để tương thích ngược tạm thời */
  campustList?: SchoolCampus[];
  curriculumList: Curriculum[];
};

export type SchoolListResponse = {
  message: string;
  body: SchoolSummary[];
};

export type SchoolDetailResponse = {
  message: string;
  body: SchoolDetail;
};

/** Một dòng trong GET /api/v1/school/campus/search/nearby — dùng để lấy `distance` theo vị trí người dùng. */
export type NearbyCampusSearchItem = {
  id: number;
  distance: number;
  latitude: number;
  longitude: number;
  name: string;
  address: string | null;
  city: string | null;
  district: string | null;
  ward: string | null;
  imageJson: string | null;
  policyDetail: string | null;
  consultantEmails: string[];
  boardingType: string | null;
  phoneNumber: string | null;
  facility: string | null;
  status: string | null;
};

export type NearbyCampusSearchResponse = {
  message: string;
  body: NearbyCampusSearchItem[];
};

export type AdmissionProcessStep = {
  stepName: string;
  stepOrder: number;
  description: string | null;
};

export type AdmissionDocumentRequirement = {
  code: string;
  name: string;
  required: boolean;
};

export type AdmissionMethodDetail = {
  endDate: number[];
  startDate: number[];
  methodCode: string;
  description: string | null;
  displayName: string;
  allowReservationSubmission: boolean;
  admissionProcessSteps: AdmissionProcessStep[];
  methodDocumentRequirements: AdmissionDocumentRequirement[];
};

export type AdmissionMethodTimeline = {
  endDate: number[];
  startDate: number[];
  methodCode: string;
  description: string | null;
  displayName: string;
  allowReservationSubmission: boolean;
};

export type SchoolCampaignTemplate = {
  id: number;
  schoolId: number;
  year: number;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  admissionMethodDetails: AdmissionMethodDetail[];
  admissionMethodTimelines: AdmissionMethodTimeline[];
  mandatoryAll: AdmissionDocumentRequirement[];
  campusProgramOfferings: Array<Record<string, unknown>>;
};

export type SchoolCampaignTemplateResponse = {
  message: string;
  body: SchoolCampaignTemplate[];
};

/** Một mục trong GET /api/v1/parent/favourite/school — `id` là id bản ghi yêu thích (dùng cho DELETE). */
export type FavouriteSchoolItem = {
  id: number;
  schoolId: number;
  foundingDate: string | null;
  websiteUrl: string | null;
  hotline: string | null;
  averageRating: number | null;
  name: string;
  description: string | null;
  representativeName: string | null;
  totalCampus: number;
  logoUrl: string | null;
};

export type FavouriteSchoolListPageBody = {
  items: FavouriteSchoolItem[];
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

export type FavouriteSchoolListResponse = {
  message: string;
  body: FavouriteSchoolListPageBody;
};

export type FavouriteSchoolMutationResponse = {
  message: string;
  body: null;
};
