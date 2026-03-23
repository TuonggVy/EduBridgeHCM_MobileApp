/** GET/POST /api/v1/parent/student — phần tử body (backend có thể thêm id) */
export type SubjectResult = {
  subjectName: string;
  score: number;
};

export type AcademicInfo = {
  subjectResults: SubjectResult[];
  gradeLevel: string;
};

export type AcademicProfileMetadata = {
  gradeLevel: string;
  subjectResults: SubjectResult[];
};

export type ParentStudentProfileApi = {
  id?: number | string;
  studentName: string;
  gender: string;
  personalityTypeCode: string;
  favouriteJob: string;
  academicProfileMetadata?: AcademicProfileMetadata[];
};

export type ParentStudentProfile = {
  id?: number | string;
  studentName: string;
  gender: string;
  personalityTypeCode: string;
  favouriteJob: string;
  academicInfos: AcademicInfo[];
};

export type CreateParentStudentPayload = {
  studentName: string;
  gender: string;
  personalityTypeCode: string;
  favouriteJob: string;
  academicInfos: AcademicInfo[];
};

export type ParentStudentsResponse = {
  message: string;
  body: ParentStudentProfile[];
};

export type ParentStudentsApiResponse = {
  message: string;
  body: ParentStudentProfileApi[];
};

export type ParentStudentMutationResponse = {
  message: string;
  body?: unknown;
};

/** GET /api/v1/parent/subject */
export type SubjectItem = {
  id: number;
  name: string;
};

export type SubjectGroup = {
  subjects: SubjectItem[];
  label: string;
  type: string;
};

export type ParentSubjectsResponse = {
  message: string;
  body: SubjectGroup[];
};

/** GET /api/v1/parent/personality/type */
export type PersonalityTrait = {
  name: string;
  description: string;
};

export type PersonalityRecommendedCareer = {
  name: string;
  explainText: string;
};

export type PersonalityQuote = {
  author: string;
  content: string;
};

export type PersonalitySource = {
  url: string;
  title: string;
};

export type PersonalityTypeDetail = {
  id: number;
  code: string;
  name: string;
  image: string;
  personalityTypeGroup: string;
  traits: PersonalityTrait[];
  description: string;
  strengths: string[];
  weaknesses: string[];
  quote: PersonalityQuote;
  recommendedCareers: PersonalityRecommendedCareer[];
  sources: PersonalitySource[];
  createdAt?: string;
  updatedAt?: string;
};

export type PersonalityTypesGrouped = Record<string, PersonalityTypeDetail[]>;

export type ParentPersonalityTypesResponse = {
  message: string;
  body: PersonalityTypesGrouped;
};

/** GET /api/v1/parent/major */
export type MajorItem = {
  code: number;
  name: string;
};

export type MajorGroup = {
  majors: MajorItem[];
  group: string;
};

export type ParentMajorsResponse = {
  message: string;
  body: MajorGroup[];
};
