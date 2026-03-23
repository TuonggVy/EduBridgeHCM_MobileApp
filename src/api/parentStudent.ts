import { apiRequest } from './client';
import type {
  CreateParentStudentPayload,
  ParentMajorsResponse,
  ParentPersonalityTypesResponse,
  ParentStudentMutationResponse,
  ParentStudentProfile,
  ParentStudentsResponse,
  ParentStudentsApiResponse,
  ParentSubjectsResponse,
  ParentStudentProfileApi,
} from '../types/studentProfile';

export async function fetchParentStudents(): Promise<ParentStudentsResponse> {
  const apiRes = await apiRequest<ParentStudentsApiResponse>(
    '/api/v1/parent/student',
    { method: 'GET' }
  );

  const mapped = (Array.isArray(apiRes.body) ? apiRes.body : []).map(
    (item: ParentStudentProfileApi) => {
      const academicProfileMetadata = Array.isArray(item.academicProfileMetadata)
        ? item.academicProfileMetadata
        : [];
      return {
        id: item.id,
        studentName: item.studentName,
        gender: item.gender,
        personalityTypeCode: item.personalityTypeCode,
        favouriteJob: item.favouriteJob,
        academicInfos: academicProfileMetadata.map((m) => ({
          gradeLevel: m.gradeLevel,
          subjectResults: m.subjectResults,
        })),
      };
    }
  );

  return {
    message: apiRes.message,
    body: mapped,
  };
}

export async function createParentStudent(
  payload: CreateParentStudentPayload
): Promise<ParentStudentMutationResponse> {
  return apiRequest<ParentStudentMutationResponse>('/api/v1/parent/student', {
    method: 'POST',
    body: payload,
  });
}

export async function fetchParentSubjects(): Promise<ParentSubjectsResponse> {
  return apiRequest<ParentSubjectsResponse>('/api/v1/parent/subject', { method: 'GET' });
}

export async function fetchParentPersonalityTypes(): Promise<ParentPersonalityTypesResponse> {
  return apiRequest<ParentPersonalityTypesResponse>('/api/v1/parent/personality/type', {
    method: 'GET',
  });
}

export async function fetchParentMajors(): Promise<ParentMajorsResponse> {
  return apiRequest<ParentMajorsResponse>('/api/v1/parent/major', { method: 'GET' });
}
