export type SchoolSummary = {
  foundingDate: string | null;
  websiteUrl: string | null;
  hotline: string | null;
  averageRating: number | null;
  name: string;
  description: string | null;
  id: number;
  isFavourite: boolean;
  representativeName: string | null;
  totalCampus: number;
  logoUrl: string | null;
};

export type SubjectJsonb = {
  name: string;
  description: string | null;
  isMandatory: boolean;
};

export type Curriculum = {
  curriculumStatus: string;
  methodLearning: string;
  enrollmentYear: number;
  name: string;
  description: string | null;
  programList: unknown[];
  subjectsJsonb: SubjectJsonb[];
  curriculumType: string;
  groupCode: string;
};

export type SchoolDetail = SchoolSummary & {
  campustList: unknown[];
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
