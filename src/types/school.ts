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
