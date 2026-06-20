import { supabase } from './supabase';
import { ContractJob, Appointment } from '../types';

// --- Contract Jobs ---

export async function fetchJobs(): Promise<ContractJob[]> {
  const { data, error } = await supabase
    .from('contract_jobs')
    .select('id, client_name, job_title, color, rate_type, rate_amount, notes')
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    clientName: row.client_name,
    jobTitle: row.job_title,
    color: row.color,
    rateType: row.rate_type,
    rateAmount: row.rate_amount,
    notes: row.notes ?? undefined,
  }));
}

export async function upsertJob(job: ContractJob, userId: string): Promise<void> {
  const { error } = await supabase.from('contract_jobs').upsert({
    id: job.id,
    user_id: userId,
    client_name: job.clientName,
    job_title: job.jobTitle,
    color: job.color,
    rate_type: job.rateType,
    rate_amount: job.rateAmount,
    notes: job.notes ?? null,
  });
  if (error) throw error;
}

export async function deleteJob(jobId: string): Promise<void> {
  const { error } = await supabase.from('contract_jobs').delete().eq('id', jobId);
  if (error) throw error;
}

// --- Appointments ---

export async function fetchAppointments(): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(
      'id, job_id, title, start_time, end_time, location, notes, status, synced_google, synced_outlook, recurrence, recurrence_count, recurrence_group_id, reminder'
    )
    .order('start_time', { ascending: true });

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    jobId: row.job_id,
    title: row.title,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location ?? undefined,
    notes: row.notes ?? undefined,
    status: row.status,
    syncedGoogle: row.synced_google ?? undefined,
    syncedOutlook: row.synced_outlook ?? undefined,
    recurrence: row.recurrence ?? undefined,
    recurrenceCount: row.recurrence_count ?? undefined,
    recurrenceGroupId: row.recurrence_group_id ?? undefined,
    reminder: row.reminder ?? undefined,
  }));
}

export async function upsertAppointment(appointment: Appointment, userId: string): Promise<void> {
  const { error } = await supabase.from('appointments').upsert({
    id: appointment.id,
    user_id: userId,
    job_id: appointment.jobId,
    title: appointment.title,
    start_time: appointment.startTime,
    end_time: appointment.endTime,
    location: appointment.location ?? null,
    notes: appointment.notes ?? null,
    status: appointment.status,
    synced_google: appointment.syncedGoogle ?? false,
    synced_outlook: appointment.syncedOutlook ?? false,
    recurrence: appointment.recurrence ?? null,
    recurrence_count: appointment.recurrenceCount ?? null,
    recurrence_group_id: appointment.recurrenceGroupId ?? null,
    reminder: appointment.reminder ?? false,
  });
  if (error) throw error;
}

export async function deleteAppointment(appointmentId: string): Promise<void> {
  const { error } = await supabase.from('appointments').delete().eq('id', appointmentId);
  if (error) throw error;
}
