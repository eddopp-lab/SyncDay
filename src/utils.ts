import { ContractJob, Appointment } from './types';

// Helper to get color values for dynamic Tailwind styling
export interface ColorPalette {
  bg: string;
  text: string;
  border: string;
  badge: string;
  hover: string;
  bubble: string;
}

export function getColorPalette(colorName: string): ColorPalette {
  const palettes: Record<string, ColorPalette> = {
    emerald: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      hover: 'hover:bg-emerald-100',
      bubble: 'bg-emerald-500',
    },
    sky: {
      bg: 'bg-sky-50',
      text: 'text-sky-700',
      border: 'border-sky-200',
      badge: 'bg-sky-100 text-sky-800 border-sky-200',
      hover: 'hover:bg-sky-100',
      bubble: 'bg-sky-500',
    },
    rose: {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
      badge: 'bg-rose-100 text-rose-800 border-rose-200',
      hover: 'hover:bg-rose-100',
      bubble: 'bg-rose-500',
    },
    amber: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      hover: 'hover:bg-amber-100',
      bubble: 'bg-amber-500',
    },
    indigo: {
      bg: 'bg-indigo-50',
      text: 'text-indigo-700',
      border: 'border-indigo-200',
      badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      hover: 'hover:bg-indigo-100',
      bubble: 'bg-indigo-500',
    },
    violet: {
      bg: 'bg-violet-50',
      text: 'text-violet-700',
      border: 'border-violet-200',
      badge: 'bg-violet-100 text-violet-800 border-violet-200',
      hover: 'hover:bg-violet-100',
      bubble: 'bg-violet-500',
    },
  };

  return palettes[colorName] || palettes.indigo;
}

export const JOB_COLORS = [
  { name: 'emerald', hex: '#10b981', label: 'Emerald' },
  { name: 'sky', hex: '#0ea5e9', label: 'Sky Blue' },
  { name: 'rose', hex: '#f43f5e', label: 'Rose Pink' },
  { name: 'amber', hex: '#f59e0b', label: 'Amber' },
  { name: 'indigo', hex: '#6366f1', label: 'Indigo' },
  { name: 'violet', hex: '#8b5cf6', label: 'Violet' },
];

// Seed Data
export const SEED_JOBS: ContractJob[] = [
  {
    id: 'job-1',
    clientName: 'Stripe Inc.',
    jobTitle: 'Technical Consultant',
    color: 'indigo',
    rateType: 'hourly',
    rateAmount: 125,
    notes: 'Integration consulting & API architectural design.',
  },
  {
    id: 'job-2',
    clientName: 'Google Cloud Corp.',
    jobTitle: 'Developer Advocate (Contract)',
    color: 'sky',
    rateType: 'hourly',
    rateAmount: 150,
    notes: 'Workshops, docs reviewing, community feedback.',
  },
  {
    id: 'job-3',
    clientName: 'Acme Group',
    jobTitle: 'Frontend Redesign Specialist',
    color: 'emerald',
    rateType: 'flat',
    rateAmount: 5000,
    notes: 'Complete React/Vite/Tailwind migration project.',
  },
];

// Helper to generate seed appointments spanning current year and month
export function getSeedAppointments(): Appointment[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  // Format date helper
  const dateAt = (day: number, hour: number, minute: number = 0) => {
    const d = new Date(year, month, day, hour, minute);
    return d.toISOString();
  };

  return [
    {
      id: 'app-1',
      jobId: 'job-1',
      title: 'API Integration Workshop',
      startTime: dateAt(12, 10),
      endTime: dateAt(12, 12),
      location: 'Google Meet (Online)',
      notes: 'Deep dive into Stripe checkout multi-currency custom integration.',
      status: 'completed',
      syncedGoogle: true,
      syncedOutlook: false,
    },
    {
      id: 'app-2',
      jobId: 'job-2',
      title: 'DevRel Feedback Sync',
      startTime: dateAt(15, 14),
      endTime: dateAt(15, 15, 30),
      location: 'Google Meet',
      notes: 'Review draft blog posts for new API studio releases.',
      status: 'scheduled',
      syncedGoogle: false,
      syncedOutlook: false,
    },
    {
      id: 'app-3',
      jobId: 'job-3',
      title: 'Initial Redesign Review Meeting',
      startTime: dateAt(18, 9),
      endTime: dateAt(18, 11),
      location: 'Stripe Office, SF (Room 4B)',
      notes: 'Present Figma prototypes and components planning.',
      status: 'scheduled',
      syncedGoogle: true,
      syncedOutlook: true,
    },
    {
      id: 'app-4',
      jobId: 'job-1',
      title: 'Stripe Direct Slack Sync',
      startTime: dateAt(22, 11),
      endTime: dateAt(22, 12),
      location: 'Slack Call',
      notes: 'Quick status updates regarding direct payout integrations.',
      status: 'scheduled',
      syncedGoogle: false,
      syncedOutlook: false,
    },
    {
      id: 'app-5',
      jobId: 'job-2',
      title: 'Weekly Tech Writing Jam',
      startTime: dateAt(24, 15),
      endTime: dateAt(24, 17),
      location: 'Calm Spaces Shared Office',
      notes: 'Drafting new tutorials on offline-first architectures.',
      status: 'scheduled',
      syncedGoogle: false,
      syncedOutlook: false,
    },
  ];
}

// ICS formatting utility
// Formats to: YYYYMMDDTHHMMSSZ (e.g. 20260619T130146Z)
function toICSDate(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

// Generate an ICS content string for a single appointment
export function generateICSContent(appointment: Appointment, job?: ContractJob): string {
  const dtStamp = toICSDate(new Date().toISOString());
  const dtStart = toICSDate(appointment.startTime);
  const dtEnd = toICSDate(appointment.endTime);

  const clientInfo = job ? `Client: ${job.clientName}` : 'No Client Assigned';
  const roleInfo = job ? `Role: ${job.jobTitle}` : 'Contract Job';
  const rateInfo = job ? `Rate: $${job.rateAmount} ${job.rateType === 'hourly' ? '/ hr' : '(Flat)'}` : '';

  const summary = `${appointment.title} [${job ? job.clientName : 'Contract Job'}]`;
  const description = [
    appointment.notes || 'No description provided.',
    '',
    '--- CONTRACT DETAILS ---',
    clientInfo,
    roleInfo,
    rateInfo,
    `Status: ${appointment.status.toUpperCase()}`,
  ].join('\n').replace(/\n/g, '\\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Job Appointment Calendar//EN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:job-cal-${appointment.id}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${appointment.location || 'Not Specified'}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

// Generate an ICS content string for all appointments loaded
export function generateAllICSContent(appointments: Appointment[], jobs: ContractJob[]): string {
  const dtStamp = toICSDate(new Date().toISOString());
  const events = appointments.map((appointment) => {
    const job = jobs.find((j) => j.id === appointment.jobId);
    const dtStart = toICSDate(appointment.startTime);
    const dtEnd = toICSDate(appointment.endTime);

    const clientInfo = job ? `Client: ${job.clientName}` : 'No Client Assigned';
    const roleInfo = job ? `Role: ${job.jobTitle}` : 'Contract Job';
    const rateInfo = job ? `Rate: $${job.rateAmount} ${job.rateType === 'hourly' ? '/ hr' : '(Flat)'}` : '';

    const summary = `${appointment.title} [${job ? job.clientName : 'Contract Job'}]`;
    const description = [
      appointment.notes || 'No description provided.',
      '',
      '--- CONTRACT DETAILS ---',
      clientInfo,
      roleInfo,
      rateInfo,
      `Status: ${appointment.status.toUpperCase()}`,
    ].join('\n').replace(/\n/g, '\\n');

    return [
      'BEGIN:VEVENT',
      `UID:job-cal-${appointment.id}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${appointment.location || 'Not Specified'}`,
      'STATUS:CONFIRMED',
      'SEQUENCE:0',
      'END:VEVENT',
    ].join('\r\n');
  });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Job Appointment Calendar//EN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

// Standard browser downloader for ICS content
export function triggerICSDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Calendar Date Math Helpers
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getMonthWeeks(year: number, month: number): Date[][] {
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday, 6 is Saturday
  const totalDays = getDaysInMonth(year, month);
  
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];

  // Previous month buffer days
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonthDays = getDaysInMonth(prevYear, prevMonth);

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    currentWeek.push(new Date(prevYear, prevMonth, prevMonthDays - i));
  }

  // Current month days
  for (let day = 1; day <= totalDays; day++) {
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(new Date(year, month, day));
  }

  // Next month buffer days to complete final week
  if (currentWeek.length > 0) {
    let nextMonthDay = 1;
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    while (currentWeek.length < 7) {
      currentWeek.push(new Date(nextYear, nextMonth, nextMonthDay++));
    }
    weeks.push(currentWeek);
  }

  return weeks;
}

// Calculate total earnings calculated from appointments in a given timeframe (monthly)
export function calculateMonthEarnings(appointments: Appointment[], jobs: ContractJob[], date: Date): number {
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth();

  let totalNum = 0;

  appointments.forEach((app) => {
    const appDate = new Date(app.startTime);
    if (appDate.getFullYear() !== targetYear || appDate.getMonth() !== targetMonth) return;
    if (app.status === 'cancelled') return;

    const job = jobs.find((j) => j.id === app.jobId);
    if (!job) return;

    if (job.rateType === 'flat') {
      // Find how many total meetings for this job in total.
      // A typical contractor flat-rate project pays the flat sum split among tasks or as a milestone,
      // but to give the user a realistic feeling, we can say flat rates are project-based or we can estimate
      // a proportional distribution; let's count a percentage of flat rate or just add flat rate earnings!
      // Better yet: we show total flat rate pipeline + total hourly earnings!
      // Let's compute hourly earnings directly:
      // Hours * Rate
    } else {
      const start = new Date(app.startTime).getTime();
      const end = new Date(app.endTime).getTime();
      const hours = Math.max(0, (end - start) / (1000 * 60 * 60));
      totalNum += hours * job.rateAmount;
    }
  });

  return totalNum;
}

// Format duration
export function formatDuration(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end.getTime() - start.getTime();
  const totalMins = Math.floor(diffMs / (1000 * 60));
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins > 0 ? `${mins}m` : ''}`;
  }
  return `${mins}m`;
}
