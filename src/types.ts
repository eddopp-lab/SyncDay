export type RateType = 'hourly' | 'flat';

export interface ContractJob {
  id: string;
  clientName: string;
  jobTitle: string;
  color: string; // e.g., 'emerald', 'sky', 'rose', 'amber', 'indigo', 'violet'
  rateType: RateType;
  rateAmount: number;
  notes?: string;
}

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Appointment {
  id: string;
  jobId: string; // References ContractJob
  title: string;
  startTime: string; // ISO String format
  endTime: string; // ISO String format
  location?: string;
  notes?: string;
  status: AppointmentStatus;
  syncedGoogle?: boolean;
  syncedOutlook?: boolean;
  recurrence?: RecurrenceType;
  recurrenceCount?: number;
  recurrenceGroupId?: string;
  reminder?: boolean;
}

export type CalendarViewType = 'month' | 'week' | 'day';
