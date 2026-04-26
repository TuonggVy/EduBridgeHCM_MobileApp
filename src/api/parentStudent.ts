import { apiRequest } from './client';
import type {
  CreateParentStudentPayload,
  UpdateParentStudentPayload,
  ParentMajorsResponse,
  ParentPersonalityTypesResponse,
  ParentStudentMutationResponse,
  ParentStudentProfile,
  ParentStudentsResponse,
  ParentStudentsApiResponse,
  ParentSubjectsResponse,
  ParentStudentProfileApi,
  TranscriptAutoFillPayload,
  TranscriptAutoFillResponse,
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
          subjectResults: (Array.isArray(m.subjectResults) ? m.subjectResults : [])
            .map((sr) => {
              const subjectName =
                typeof sr?.subjectName === 'string'
                  ? sr.subjectName
                  : typeof sr?.name === 'string'
                    ? sr.name
                    : '';
              const score = Number(sr?.score);
              if (!subjectName || Number.isNaN(score)) return null;
              return { subjectName, score };
            })
            .filter((sr): sr is { subjectName: string; score: number } => Boolean(sr)),
        })),
        transcriptImages: Array.isArray(item.transcriptImages) ? item.transcriptImages : [],
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

export async function updateParentStudent(
  payload: UpdateParentStudentPayload
): Promise<ParentStudentMutationResponse> {
  return apiRequest<ParentStudentMutationResponse>('/api/v1/parent/student', {
    method: 'PUT',
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

export async function autoFillTranscriptScores(
  payload: TranscriptAutoFillPayload
): Promise<TranscriptAutoFillResponse> {
  return apiRequest<TranscriptAutoFillResponse>('/api/v1/parent/transcript/auto/fill', {
    method: 'POST',
    body: payload,
  });
}
