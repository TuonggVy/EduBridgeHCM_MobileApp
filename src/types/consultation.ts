export type ParentConsultationSlotStatus = 'PAST' | 'UPCOMING' | string;

export type ParentConsultationSlot = {
  date: string;
  dayOfWeek: string;
  campusScheduleTemplateId: number;
  startTime: string;
  endTime: string;
  statusLabel: string;
  status: ParentConsultationSlotStatus;
};

export type ParentConsultationSlotsResponse = {
  message: string;
  body: ParentConsultationSlot[];
};

export type BookOfflineConsultationRequest = {
  phone: string;
  question: string;
  appointmentTime: string;
  appointmentDate: string;
};

export type BookOfflineConsultationResponse = {
  message: string;
  body: unknown;
};
