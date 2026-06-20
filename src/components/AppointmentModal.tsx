import { useState, useEffect, FormEvent } from 'react';
import { Appointment, ContractJob, AppointmentStatus, RecurrenceType } from '../types';
import { getColorPalette, generateICSContent, triggerICSDownload } from '../utils';
import { X, Calendar, MapPin, AlignLeft, Check, Download, AlertTriangle, CloudRain, Clock, Repeat, Bell } from 'lucide-react';
import { motion } from 'motion/react';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: ContractJob[];
  appointments: Appointment[];
  appointment?: Appointment | null; // If passed, we are in Edit mode
  initialDate?: Date | null; // If passed, default start time on that date
  onSave: (
    appointment: Omit<Appointment, 'id'> & { id?: string },
    editScope?: 'only-this' | 'all-series'
  ) => void;
  onDelete?: (id: string) => void;
  onDeleteSeries?: (groupId: string) => void;
}

export default function AppointmentModal({
  isOpen,
  onClose,
  jobs,
  appointments,
  appointment,
  initialDate,
  onSave,
  onDelete,
  onDeleteSeries,
}: AppointmentModalProps) {
  // Form States
  const [jobId, setJobId] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTimeStr, setStartTimeStr] = useState('09:00');
  const [endTimeStr, setEndTimeStr] = useState('10:00');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<AppointmentStatus>('scheduled');
  const [syncedGoogle, setSyncedGoogle] = useState(false);
  const [syncedOutlook, setSyncedOutlook] = useState(false);
  const [reminder, setReminder] = useState(false);

  // Recurrence states
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  const [recurrenceCount, setRecurrenceCount] = useState<number>(5);
  const [editScope, setEditScope] = useState<'only-this' | 'all-series'>('only-this');

  // Initialize fields
  useEffect(() => {
    if (appointment) {
      // Edit Mode
      setJobId(appointment.jobId);
      setTitle(appointment.title);
      
      const startD = new Date(appointment.startTime);
      const endD = new Date(appointment.endTime);

      // YYYY-MM-DD
      const yyyy = startD.getFullYear();
      const mm = String(startD.getMonth() + 1).padStart(2, '0');
      const dd = String(startD.getDate()).padStart(2, '0');
      setDate(`${yyyy}-${mm}-${dd}`);

      // HH:MM
      setStartTimeStr(`${String(startD.getHours()).padStart(2, '0')}:${String(startD.getMinutes()).padStart(2, '0')}`);
      setEndTimeStr(`${String(endD.getHours()).padStart(2, '0')}:${String(endD.getMinutes()).padStart(2, '0')}`);

      setLocation(appointment.location || '');
      setNotes(appointment.notes || '');
      setStatus(appointment.status);
      setSyncedGoogle(!!appointment.syncedGoogle);
      setSyncedOutlook(!!appointment.syncedOutlook);
      setReminder(!!appointment.reminder);
      setRecurrence(appointment.recurrence || 'none');
      setRecurrenceCount(appointment.recurrenceCount || 5);
      setEditScope('only-this');
    } else {
      // Create Mode
      setTitle('');
      setLocation('');
      setNotes('');
      setStatus('scheduled');
      setSyncedGoogle(false);
      setSyncedOutlook(false);
      setReminder(false);
      setRecurrence('none');
      setRecurrenceCount(5);
      setEditScope('only-this');

      if (jobs.length > 0) {
        setJobId(jobs[0].id);
      } else {
        setJobId('');
      }

      // Default Date setting
      const targetDate = initialDate || new Date();
      const yyyy = targetDate.getFullYear();
      const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
      const dd = String(targetDate.getDate()).padStart(2, '0');
      setDate(`${yyyy}-${mm}-${dd}`);

      if (initialDate && (initialDate.getHours() !== 0 || initialDate.getMinutes() !== 0)) {
        const hh = String(initialDate.getHours()).padStart(2, '0');
        const min = String(initialDate.getMinutes()).padStart(2, '0');
        setStartTimeStr(`${hh}:${min}`);
        
        const endD = new Date(initialDate.getTime() + 60 * 60 * 1000); // 1 hour
        const ehh = String(endD.getHours()).padStart(2, '0');
        const emin = String(endD.getMinutes()).padStart(2, '0');
        setEndTimeStr(`${ehh}:${emin}`);
      } else {
        setStartTimeStr('09:00');
        setEndTimeStr('10:00');
      }
    }
  }, [appointment, initialDate, isOpen, jobs]);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!jobId || !title.trim() || !date) return;

    // Convert local input fields back to ISO
    const startISO = new Date(`${date}T${startTimeStr}`).toISOString();
    const endISO = new Date(`${date}T${endTimeStr}`).toISOString();

    onSave({
      id: appointment?.id,
      jobId,
      title: title.trim(),
      startTime: startISO,
      endTime: endISO,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
      status,
      syncedGoogle,
      syncedOutlook,
      recurrence,
      recurrenceCount,
      recurrenceGroupId: appointment?.recurrenceGroupId,
      reminder,
    }, editScope);

    onClose();
  };

  // Direct manual .ics triggers
  const handleExportSingle = () => {
    if (!title.trim() || !date) return;
    const startISO = new Date(`${date}T${startTimeStr}`).toISOString();
    const endISO = new Date(`${date}T${endTimeStr}`).toISOString();
    const selectedJob = jobs.find((j) => j.id === jobId);

    const tempApp: Appointment = {
      id: appointment?.id || 'temp',
      jobId,
      title: title.trim(),
      startTime: startISO,
      endTime: endISO,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
      status,
    };

    const icsContent = generateICSContent(tempApp, selectedJob);
    const cleanedTitle = title.trim().replace(/[^a-z0-9]/gi, '_').toLowerCase();
    triggerICSDownload(`appointment_${cleanedTitle}.ics`, icsContent);
  };

  const selectedJob = jobs.find((j) => j.id === jobId);
  const palette = selectedJob ? getColorPalette(selectedJob.color) : getColorPalette('indigo');

  // Conflict / Overlap detection
  let conflictAppointment: Appointment | null = null;
  if (date && startTimeStr && endTimeStr && jobId && appointments) {
    try {
      const currentStart = new Date(`${date}T${startTimeStr}`).getTime();
      const currentEnd = new Date(`${date}T${endTimeStr}`).getTime();

      if (!isNaN(currentStart) && !isNaN(currentEnd) && currentStart < currentEnd) {
        conflictAppointment = appointments.find((app) => {
          // Exclude the current editing appointment
          if (appointment && app.id === appointment.id) {
            return false;
          }
          // Only same job overlap
          if (app.jobId !== jobId) {
            return false;
          }
          const appStart = new Date(app.startTime).getTime();
          const appEnd = new Date(app.endTime).getTime();

          const maxStart = Math.max(currentStart, appStart);
          const minEnd = Math.min(currentEnd, appEnd);

          return maxStart < minEnd;
        }) || null;
      }
    } catch {
      // ignore parsing errors
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="bg-white rounded w-full max-w-lg border border-slate-200 shadow-lg overflow-hidden font-sans text-sm flex flex-col max-h-[90vh]"
      >
        {/* Header decoration */}
        <div className={`p-4 border-b border-slate-200 flex items-center justify-between ${palette.bg}`}>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${palette.bubble}`}></span>
            <span className="font-bold text-slate-800 tracking-tight">
              {appointment ? 'Modify Logged Appointment' : 'Plan New Appointment'}
            </span>
          </div>
          <button
            id="close-modal-upper-btn"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100/50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 flex flex-col items-center">
            <AlertTriangle className="w-12 h-12 text-slate-350 mb-3" />
            <h4 className="font-semibold text-slate-700">No active contracts found</h4>
            <p className="text-xs text-slate-450 mt-1 max-w-xs">
              Please design and activate a contracting job in the Contracting Jobs panel before listing calendar appointments.
            </p>
            <button
              id="close-modal-fallback-btn"
              onClick={onClose}
              className="mt-4 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-4 py-1.5 rounded cursor-pointer transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <form id="appointment-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Associated Contract */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Client / Hiring Contract
              </label>
              <select
                id="modal-job-select"
                required
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-850 transition-colors"
              >
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.clientName} &mdash; {job.jobTitle} ({job.rateType === 'hourly' ? `$${job.rateAmount}/hr` : `$${job.rateAmount.toLocaleString()}`})
                  </option>
                ))}
              </select>
            </div>

            {/* Appointment Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Appointment Summary / Title
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                <input
                  id="modal-title-input"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Code Review & QA Session"
                  className="w-full bg-slate-50 border border-slate-200 rounded pl-9 pr-3 py-2 text-slate-800 focus:outline-none focus:border-slate-850 transition-colors"
                />
              </div>
            </div>

            {/* Date & Time settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Date</label>
                <input
                  id="modal-date-input"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-850 font-mono text-xs focus:outline-none focus:border-slate-850 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Start Time
                </label>
                <div className="relative">
                  <Clock className="absolute left-2.5 top-2 text-slate-400 w-3.5 h-3.5" />
                  <input
                    id="modal-start-time-input"
                    type="time"
                    required
                    value={startTimeStr}
                    onChange={(e) => setStartTimeStr(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded pl-8 pr-2 py-1.5 text-slate-850 font-mono text-xs focus:outline-none focus:border-slate-850 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  End Time
                </label>
                <div className="relative">
                  <Clock className="absolute left-2.5 top-2 text-slate-400 w-3.5 h-3.5" />
                  <input
                    id="modal-end-time-input"
                    type="time"
                    required
                    value={endTimeStr}
                    onChange={(e) => setEndTimeStr(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded pl-8 pr-2 py-1.5 text-slate-850 font-mono text-xs focus:outline-none focus:border-slate-850 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Overlap / Scheduling Conflict Warning */}
            {conflictAppointment && (
              <div 
                id="modal-conflict-warning" 
                className="bg-amber-50 border border-amber-200/80 rounded p-3 text-xs flex gap-2.5 text-amber-900 animate-fadeIn"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-950">Scheduling Conflict Detected</p>
                  <p className="leading-relaxed text-[11px] text-amber-900/90">
                    This selection overlaps with another logged appointment for this contract: <span className="font-bold">"{conflictAppointment.title}"</span>.
                  </p>
                  <p className="text-[10px] font-mono font-bold text-amber-800">
                    Time: {new Date(conflictAppointment.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} &mdash; {new Date(conflictAppointment.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </p>
                </div>
              </div>
            )}

            {/* Physical Location or Link */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Meeting Location / Link
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                <input
                  id="modal-location-input"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Google Meet, Slack, or Office room"
                  className="w-full bg-slate-50 border border-slate-200 rounded pl-9 pr-3 py-2 text-slate-800 focus:outline-none focus:border-slate-850 transition-colors"
                />
              </div>
            </div>

            {/* Recurrence Settings & Options */}
            {!appointment ? (
              <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-2.5">
                <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Recurrence Rules
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Pattern</label>
                    <select
                      id="modal-recurrence-pattern"
                      value={recurrence}
                      onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                      className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-slate-850"
                    >
                      <option value="none">Once (No Repeat)</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="fortnightly">Fortnightly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>

                  {recurrence !== 'none' && (
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Occurrences</label>
                      <input
                        id="modal-recurrence-count"
                        type="number"
                        min={1}
                        max={30}
                        value={recurrenceCount}
                        onChange={(e) => setRecurrenceCount(Math.min(30, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:border-slate-850"
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              appointment.recurrenceGroupId && (
                <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <Repeat className="w-3.5 h-3.5 text-slate-400" /> Recurring Series Options
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    This appointment is linked to other slots. How would you like to save your edits?
                  </p>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="editScope"
                        checked={editScope === 'only-this'}
                        onChange={() => setEditScope('only-this')}
                        className="accent-slate-900"
                      />
                      Only this occurrence
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="editScope"
                        checked={editScope === 'all-series'}
                        onChange={() => setEditScope('all-series')}
                        className="accent-slate-900"
                      />
                      All occurrences in series
                    </label>
                  </div>
                </div>
              )
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Notes</label>
              <div className="relative">
                <AlignLeft className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                <textarea
                  id="modal-notes-input"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Key items to prepare, link URLs, agenda specifications..."
                  className="w-full bg-slate-50 border border-slate-200 rounded pl-9 pr-3 py-2 text-slate-800 focus:outline-none focus:border-slate-850 transition-colors text-xs"
                />
              </div>
            </div>

            {/* Status Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Status
                </label>
                <div className="flex gap-2">
                  {(['scheduled', 'completed', 'cancelled'] as AppointmentStatus[]).map((st) => (
                    <button
                      id={`modal-status-btn-${st}`}
                      key={st}
                      type="button"
                      onClick={() => setStatus(st)}
                      className={`flex-1 py-1 px-2 text-center text-xs font-medium rounded border capitalize transition-all cursor-pointer ${
                        status === st
                          ? 'bg-slate-900 border-slate-900 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-305'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action: Export ICS on the fly */}
              <div className="flex flex-col justify-end">
                <button
                  id="modal-single-ics-btn"
                  type="button"
                  onClick={handleExportSingle}
                  className="flex items-center justify-center gap-1.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 py-1.5 px-3 rounded text-xs font-medium transition-all cursor-pointer"
                  title="Generate dynamic standard iCalendar download file"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" /> Save &amp; Export ICS
                </button>
              </div>
            </div>

            {/* Reminders & Sync Services */}
            <div className="bg-slate-50 rounded p-3 border border-slate-200 space-y-2">
              <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Reminders &amp; Sync Reference
              </span>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* 1. Reminder Toggle */}
                <button
                  id="modal-reminder-toggle"
                  type="button"
                  onClick={() => setReminder(!reminder)}
                  className={`flex items-center gap-2 p-2 rounded border text-left cursor-pointer transition-all ${
                    reminder
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-305'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                    reminder ? 'bg-amber-500 border-amber-500' : 'border-slate-300'
                  }`}>
                    {reminder && <Check className="w-2.5 h-2.5 text-white stroke-[3px]" />}
                  </div>
                  <div className="flex items-center gap-1 min-w-0">
                    <Bell className={`w-3.5 h-3.5 shrink-0 ${reminder ? 'text-amber-500 animate-bounce' : 'text-slate-400'}`} />
                    <div className="flex flex-col leading-none min-w-0">
                      <span className="text-[11px] font-semibold truncate">Reminder</span>
                      <span className="text-[9px] text-slate-400">
                        {reminder ? 'Active Alert' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </button>

                {/* 2. Google Sync */}
                <button
                  id="modal-sync-google-toggle"
                  type="button"
                  onClick={() => setSyncedGoogle(!syncedGoogle)}
                  className={`flex items-center gap-2 p-2 rounded border text-left cursor-pointer transition-all ${
                    syncedGoogle
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-305'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                    syncedGoogle ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                  }`}>
                    {syncedGoogle && <Check className="w-2.5 h-2.5 text-white stroke-[3px]" />}
                  </div>
                  <div className="flex flex-col leading-none">
                    <span className="text-[11px] font-semibold">Google Sync</span>
                    <span className="text-[9px] text-slate-400">
                      {syncedGoogle ? 'Synced' : 'Offline'}
                    </span>
                  </div>
                </button>

                {/* 3. Outlook Sync */}
                <button
                  id="modal-sync-outlook-toggle"
                  type="button"
                  onClick={() => setSyncedOutlook(!syncedOutlook)}
                  className={`flex items-center gap-2 p-2 rounded border text-left cursor-pointer transition-all ${
                    syncedOutlook
                      ? 'bg-sky-50 border-sky-200 text-sky-700'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-305'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                    syncedOutlook ? 'bg-sky-600 border-sky-600' : 'border-slate-300'
                  }`}>
                    {syncedOutlook && <Check className="w-2.5 h-2.5 text-white stroke-[3px]" />}
                  </div>
                  <div className="flex flex-col leading-none">
                    <span className="text-[11px] font-semibold">Outlook Sync</span>
                    <span className="text-[9px] text-slate-400">
                      {syncedOutlook ? 'Synced' : 'Offline'}
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Save Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              {appointment && onDelete ? (
                <div className="flex gap-2">
                  <button
                    id="modal-delete-this-btn"
                    type="button"
                    onClick={() => {
                      if (confirm('Delete ONLY this appointment instance?')) {
                        onDelete(appointment.id);
                        onClose();
                      }
                    }}
                    className="px-3 py-1.5 text-xs text-rose-500 hover:text-rose-750 hover:bg-rose-50 rounded font-semibold transition-all cursor-pointer"
                  >
                    Delete Instance
                  </button>
                  {appointment.recurrenceGroupId && onDeleteSeries && (
                    <button
                      id="modal-delete-series-btn"
                      type="button"
                      onClick={() => {
                        if (confirm('Delete the ENTIRE recurring series? This will delete all connected slot occurrences.')) {
                          onDeleteSeries(appointment.recurrenceGroupId!);
                          onClose();
                        }
                      }}
                      className="px-3 py-1.5 text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 rounded font-bold transition-all cursor-pointer border border-rose-100"
                    >
                      Delete Series
                    </button>
                  )}
                </div>
              ) : (
                <div></div>
              )}

              <div className="flex gap-2">
                <button
                  id="modal-close-btn"
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="modal-save-btn"
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs px-4 py-2 rounded cursor-pointer transition-all shadow-2xs"
                >
                  Save Appointment
                </button>
              </div>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}
