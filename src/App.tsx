import { useState, useEffect } from 'react';
import { ContractJob, Appointment, CalendarViewType } from './types';
import { 
  SEED_JOBS, 
  getSeedAppointments, 
  getMonthWeeks, 
  getColorPalette, 
  generateAllICSContent, 
  triggerICSDownload,
  formatDuration
} from './utils';
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  RotateCcw, 
  Calendar as CalendarIcon, 
  Grid, 
  AlignJustify, 
  CheckCheck, 
  Clock, 
  MapPin, 
  BookOpen, 
  PlusCircle,
  HelpCircle,
  FileCheck,
  Search,
  X,
  Bell
} from 'lucide-react';
import ContractJobsManager from './components/ContractJobsManager';
import AppointmentModal from './components/AppointmentModal';
import AnalyticsPanel from './components/AnalyticsPanel';
import { motion, AnimatePresence } from 'motion/react';
import {
  fetchJobs,
  fetchAppointments,
  upsertJob as dbUpsertJob,
  deleteJob as dbDeleteJob,
  upsertAppointment as dbUpsertAppointment,
  deleteAppointment as dbDeleteAppointment,
} from './lib/data';

interface AppProps {
  userId: string;
  userEmail: string;
  onLogout: () => void;
}

export default function App({ userId, userEmail, onLogout }: AppProps) {
  // State: Core Data
  const [jobs, setJobs] = useState<ContractJob[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  // A lightweight ticking clock so the "Now" indicator in Day View
  // advances live without requiring a manual page refresh.
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setClockTick((t) => t + 1), 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Initial load from Supabase. If the user has no data yet, seed it
  // with the demo dataset so the app isn't empty on first login.
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const [remoteJobs, remoteAppointments] = await Promise.all([
          fetchJobs(),
          fetchAppointments(),
        ]);

        if (!isMounted) return;

        if (remoteJobs.length === 0 && remoteAppointments.length === 0) {
          const userSuffix = userId.slice(0, 8);
          const idMap: Record<string, string> = {};
          const seedJobs = SEED_JOBS.map((j) => {
            const newId = `${j.id}-${userSuffix}`;
            idMap[j.id] = newId;
            return { ...j, id: newId };
          });
          const seedAppointments = getSeedAppointments().map((a) => ({
            ...a,
            id: `${a.id}-${userSuffix}`,
            jobId: idMap[a.jobId] || a.jobId,
          }));
          setJobs(seedJobs);
          setAppointments(seedAppointments);
          // Push the seed data up so it persists from the very first login.
          await Promise.all(seedJobs.map((j) => dbUpsertJob(j, userId)));
          await Promise.all(seedAppointments.map((a) => dbUpsertAppointment(a, userId)));
        } else {
          setJobs(remoteJobs);
          setAppointments(remoteAppointments);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Failed to load data from Supabase', err);
        setSyncError('Could not load your data. Showing local copy if available.');
        const local = localStorage.getItem('contract_jobs');
        const localApps = localStorage.getItem('contract_appointments');
        if (local) setJobs(JSON.parse(local));
        if (localApps) setAppointments(JSON.parse(localApps));
      } finally {
        if (isMounted) setIsLoadingData(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  // State: navigation / current focus
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [view, setView] = useState<CalendarViewType>('month');

  // State: search query to filter appointments dynamically
  const [searchTerm, setSearchTerm] = useState('');

  // Modal control
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
  const [initialDateForCreate, setInitialDateForCreate] = useState<Date | null>(null);
  const [quickPreview, setQuickPreview] = useState<{ app: Appointment; x: number; y: number } | null>(null);

  // Sync back to localStorage
  useEffect(() => {
    localStorage.setItem('contract_jobs', JSON.stringify(jobs));
  }, [jobs]);

  useEffect(() => {
    localStorage.setItem('contract_appointments', JSON.stringify(appointments));
  }, [appointments]);

  // Handle previous / next date navigations
  const handlePrevDate = () => {
    if (view === 'month') {
      setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
    } else if (view === 'week') {
      const prevWeek = new Date(selectedDate);
      prevWeek.setDate(selectedDate.getDate() - 7);
      setSelectedDate(prevWeek);
    } else {
      const prevDay = new Date(selectedDate);
      prevDay.setDate(selectedDate.getDate() - 1);
      setSelectedDate(prevDay);
    }
  };

  const handleNextDate = () => {
    if (view === 'month') {
      setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
    } else if (view === 'week') {
      const nextWeek = new Date(selectedDate);
      nextWeek.setDate(selectedDate.getDate() + 7);
      setSelectedDate(nextWeek);
    } else {
      const nextDay = new Date(selectedDate);
      nextDay.setDate(selectedDate.getDate() + 1);
      setSelectedDate(nextDay);
    }
  };

  // Restores clean interactive demo dataset
  const handleResetDemoData = () => {
    if (confirm('Are you sure you want to restore original mock assets? Custom jobs/appointments will be overwritten.')) {
      const userSuffix = userId.slice(0, 8);
      const idMap: Record<string, string> = {};
      const seedJobs = SEED_JOBS.map((j) => {
        const newId = `${j.id}-${userSuffix}-${Date.now()}`;
        idMap[j.id] = newId;
        return { ...j, id: newId };
      });
      const seedAppointments = getSeedAppointments().map((a) => ({
        ...a,
        id: `${a.id}-${userSuffix}-${Date.now()}`,
        jobId: idMap[a.jobId] || a.jobId,
      }));
      // Remove everything currently stored, then re-seed.
      Promise.all(jobs.map((j) => dbDeleteJob(j.id)))
        .then(() => Promise.all(seedJobs.map((j) => dbUpsertJob(j, userId))))
        .then(() => Promise.all(seedAppointments.map((a) => dbUpsertAppointment(a, userId))))
        .catch((err) => console.error('Failed to reset demo data remotely', err));

      setJobs(seedJobs);
      setAppointments(seedAppointments);
      setSelectedDate(new Date());
    }
  };

  // Global ICS Backup / Export
  const handleExportAll = () => {
    const content = generateAllICSContent(appointments, jobs);
    triggerICSDownload('all_direct_contract_appointments.ics', content);
  };

  // Appointment operations
  const handleSaveAppointment = (
    data: Omit<Appointment, 'id'> & { id?: string },
    editScope?: 'only-this' | 'all-series'
  ) => {
    if (data.id) {
      // Edit Mode
      if (editScope === 'all-series' && data.recurrenceGroupId) {
        setAppointments(prev => {
          const originalTarget = prev.find(a => a.id === data.id);
          if (!originalTarget) return prev;

          const newStart = new Date(data.startTime);
          const newEnd = new Date(data.endTime);

          const updated = prev.map(a => {
            if (a.recurrenceGroupId === data.recurrenceGroupId) {
              const instStart = new Date(a.startTime);
              const instEnd = new Date(a.endTime);

              // Standardize times while keeping individual dates intact
              instStart.setHours(newStart.getHours());
              instStart.setMinutes(newStart.getMinutes());
              instStart.setSeconds(newStart.getSeconds());
              instStart.setMilliseconds(newStart.getMilliseconds());

              instEnd.setHours(newEnd.getHours());
              instEnd.setMinutes(newEnd.getMinutes());
              instEnd.setSeconds(newEnd.getSeconds());
              instEnd.setMilliseconds(newEnd.getMilliseconds());

              return {
                ...a,
                jobId: data.jobId,
                title: data.title,
                location: data.location,
                notes: data.notes,
                status: data.status,
                syncedGoogle: data.syncedGoogle,
                syncedOutlook: data.syncedOutlook,
                startTime: instStart.toISOString(),
                endTime: instEnd.toISOString(),
              };
            }
            return a;
          });

          const changed = updated.filter((a) => a.recurrenceGroupId === data.recurrenceGroupId);
          Promise.all(changed.map((a) => dbUpsertAppointment(a, userId))).catch((err) =>
            console.error('Failed to sync series update', err)
          );

          return updated;
        });
      } else {
        // Edit only this single instance
        setAppointments(prev => {
          const updated = prev.map(a => a.id === data.id ? { ...a, ...data } as Appointment : a);
          const changedApp = updated.find((a) => a.id === data.id);
          if (changedApp) {
            dbUpsertAppointment(changedApp, userId).catch((err) =>
              console.error('Failed to sync appointment update', err)
            );
          }
          return updated;
        });
      }
    } else {
      // Create Mode
      if (data.recurrence && data.recurrence !== 'none') {
        const count = data.recurrenceCount || 5;
        const group_id = `series-${Date.now()}`;
        const newApps: Appointment[] = [];

        const baseStart = new Date(data.startTime);
        const baseEnd = new Date(data.endTime);
        const duration = baseEnd.getTime() - baseStart.getTime();

        for (let i = 0; i < count; i++) {
          const instStart = new Date(baseStart);
          const instEnd = new Date(baseStart);

          if (data.recurrence === 'daily') {
            instStart.setDate(baseStart.getDate() + i);
          } else if (data.recurrence === 'weekly') {
            instStart.setDate(baseStart.getDate() + i * 7);
          } else if (data.recurrence === 'fortnightly') {
            instStart.setDate(baseStart.getDate() + i * 14);
          } else if (data.recurrence === 'monthly') {
            instStart.setMonth(baseStart.getMonth() + i);
          }

          instEnd.setTime(instStart.getTime() + duration);

          newApps.push({
            ...data,
            id: `app-${Date.now()}-${i}`,
            startTime: instStart.toISOString(),
            endTime: instEnd.toISOString(),
            recurrenceGroupId: group_id,
          });
        }
        setAppointments(prev => [...prev, ...newApps]);
        Promise.all(newApps.map((a) => dbUpsertAppointment(a, userId))).catch((err) =>
          console.error('Failed to sync new recurring appointments', err)
        );
      } else {
        // Create standard appointment
        const newApp: Appointment = {
          ...data,
          id: `app-${Date.now()}`,
        };
        setAppointments(prev => [...prev, newApp]);
        dbUpsertAppointment(newApp, userId).catch((err) =>
          console.error('Failed to sync new appointment', err)
        );
      }
    }
  };

  const handleDeleteAppointment = (id: string) => {
    setAppointments(prev => prev.filter(a => a.id !== id));
    dbDeleteAppointment(id).catch((err) => console.error('Failed to sync appointment deletion', err));
  };

  const handleDeleteSeries = (groupId: string) => {
    setAppointments(prev => {
      const toDelete = prev.filter((a) => a.recurrenceGroupId === groupId);
      Promise.all(toDelete.map((a) => dbDeleteAppointment(a.id))).catch((err) =>
        console.error('Failed to sync series deletion', err)
      );
      return prev.filter(a => a.recurrenceGroupId !== groupId);
    });
  };

  // Job operations
  const handleAddJob = (jobData: Omit<ContractJob, 'id'>) => {
    const newJob: ContractJob = {
      ...jobData,
      id: `job-${Date.now()}`,
    };
    setJobs(prev => [...prev, newJob]);
    dbUpsertJob(newJob, userId).catch((err) => console.error('Failed to sync new job', err));
  };

  const handleUpdateJob = (updatedJob: ContractJob) => {
    setJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j));
    dbUpsertJob(updatedJob, userId).catch((err) => console.error('Failed to sync job update', err));
  };

  const handleDeleteJob = (id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id));
    // Filter out appointments linked to deleted jobs
    setAppointments(prev => {
      const linked = prev.filter((a) => a.jobId === id);
      Promise.all(linked.map((a) => dbDeleteAppointment(a.id))).catch((err) =>
        console.error('Failed to sync cascade deletion of appointments', err)
      );
      return prev.filter(a => a.jobId !== id);
    });
    dbDeleteJob(id).catch((err) => console.error('Failed to sync job deletion', err));
  };

  // Format month title
  const currentMonthTitle = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Get days arranged in weeks for the month
  const weeks = getMonthWeeks(selectedDate.getFullYear(), selectedDate.getMonth());

  // Dynamic search filtering
  const filteredAppointments = appointments.filter((app) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const appTitle = (app.title || '').toLowerCase();
    const job = jobs.find((j) => j.id === app.jobId);
    const clientName = job ? (job.clientName || '').toLowerCase() : '';
    return appTitle.includes(term) || clientName.includes(term);
  });

  // Determine appointments for a given calendar block
  const getDayAppointments = (day: Date) => {
    return filteredAppointments
      .filter((app) => {
        const appDate = new Date(app.startTime);
        return (
          appDate.getFullYear() === day.getFullYear() &&
          appDate.getMonth() === day.getMonth() &&
          appDate.getDate() === day.getDate()
        );
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  };

  // Week helper variables
  const getWeekDates = (baseDate: Date): Date[] => {
    // Return all dates of the same week as baseDate (Sunday to Saturday)
    const dates: Date[] = [];
    const temp = new Date(baseDate);
    const dayOfWeek = temp.getDay();
    temp.setDate(temp.getDate() - dayOfWeek); // Start on Sunday
    for (let i = 0; i < 7; i++) {
      dates.push(new Date(temp));
      temp.setDate(temp.getDate() + 1);
    }
    return dates;
  };

  const weekDates = getWeekDates(selectedDate);

  if (isLoadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fcfcfc] text-slate-500 text-sm">
        Loading your calendar...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-slate-900 pb-16 font-sans">
      {/* Premium Header conforming to Clean Minimalism */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 md:px-8 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 flex-1 min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 underline underline-offset-8 decoration-slate-200 shrink-0">
              Job Appointment Calendar
            </h1>
            
            {/* Search Input */}
            <div className="relative w-full max-w-sm">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </span>
              <input
                id="global-search-input"
                type="text"
                placeholder="Search appointments by title or client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800 placeholder-slate-450 focus:outline-none focus:bg-white focus:border-slate-800 focus:ring-1 focus:ring-slate-800 transition-all font-sans"
              />
              {searchTerm && (
                <button
                  id="clear-search-btn"
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-650 cursor-pointer"
                  title="Clear search filter"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex space-x-2 mr-2 border-r border-slate-200 pr-4">
              <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-slate-50 border border-slate-200">
                <div className={`w-1.5 h-1.5 rounded-full ${syncError ? 'bg-rose-400' : 'bg-emerald-400'}`}></div>
                <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                  {syncError ? 'Sync Error' : 'Synced'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 mr-2 border-r border-slate-200 pr-4">
              <span className="text-[11px] text-slate-500 hidden sm:inline">{userEmail}</span>
              <button
                id="sign-out-btn"
                onClick={onLogout}
                className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-[11px] text-slate-700 rounded font-semibold transition-all cursor-pointer"
              >
                Sign Out
              </button>
            </div>

            <button
              id="export-all-ics-btn"
              onClick={handleExportAll}
              className="px-3.5 py-1.5 border border-slate-350 hover:bg-slate-50 text-[11px] text-slate-700 rounded font-semibold transition-all cursor-pointer"
              title="Download full schedule database as .ics configuration"
            >
              <Download className="w-3 h-3 inline-block mr-1.5 align-text-top" /> Export All (.ics)
            </button>

            <button
              id="reset-demo-data-btn"
              onClick={handleResetDemoData}
              className="px-3 py-1.5 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded text-[11px] font-medium transition-all cursor-pointer"
              title="Restore sample metrics"
            >
              <RotateCcw className="w-3 h-3 inline-block mr-1 align-text-top" /> Reset Sandbox
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-6 space-y-6">
        
        {/* Core Analytics Dashboard row */}
        <AnalyticsPanel
          jobs={jobs}
          appointments={appointments}
          selectedDate={selectedDate}
        />

        {/* Calendar Management Row */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Calendar Layout container (Main 3 Columns) */}
          <section className="lg:col-span-3 bg-white border border-slate-200 rounded p-4 sm:p-5 shadow-2xs flex flex-col space-y-4">
            
            {/* Calendar Controls header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <button
                  id="calendar-prev-btn"
                  onClick={handlePrevDate}
                  className="p-1.5 border border-slate-200 hover:border-slate-300 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                  title="Previous Period"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-650" />
                </button>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight min-w-[120px] text-center">
                  {view === 'month' && currentMonthTitle}
                  {view === 'week' && `Week of ${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  {view === 'day' && selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </h3>
                <button
                  id="calendar-next-btn"
                  onClick={handleNextDate}
                  className="p-1.5 border border-slate-200 hover:border-slate-300 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                  title="Next Period"
                >
                  <ChevronRight className="w-4 h-4 text-slate-650" />
                </button>

                <button
                  id="go-today-btn"
                  onClick={() => setSelectedDate(new Date())}
                  className="text-xs font-semibold text-slate-750 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded transition-colors cursor-pointer ml-1"
                >
                  Today
                </button>
              </div>

              {/* View selectors & Add direct appoint */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded border border-slate-200">
                  {(['month', 'week', 'day'] as CalendarViewType[]).map((v) => (
                    <button
                      id={`view-tab-${v}`}
                      key={v}
                      onClick={() => setView(v)}
                      className={`px-3 py-1 text-xs font-medium rounded capitalize transition-all cursor-pointer ${
                        view === v
                          ? 'bg-white text-slate-800 shadow-2xs'
                          : 'text-slate-550 hover:text-slate-800'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>

                <button
                  id="navbar-add-appointment-btn"
                  onClick={() => {
                    setActiveAppointment(null);
                    setInitialDateForCreate(null);
                    setIsModalOpen(true);
                  }}
                  className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded text-xs font-semibold tracking-tight transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Book Appointment
                </button>
              </div>
            </div>

            {/* Render selected view */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${view}-${selectedDate.toISOString()}`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                className="flex-1"
              >
                
                {/* 1. MONTH VIEW */}
                {view === 'month' && (
                  <div className="space-y-1">
                    {/* Day name labels header */}
                    <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-400 py-1 uppercase tracking-wider">
                      <span>Sun</span>
                      <span>Mon</span>
                      <span>Tue</span>
                      <span>Wed</span>
                      <span>Thu</span>
                      <span>Fri</span>
                      <span>Sat</span>
                    </div>

                    {/* Month grid days */}
                    <div className="grid grid-cols-7 border-t border-l border-slate-200 rounded overflow-hidden">
                      {weeks.map((week, wIdx) => (
                        <div key={wIdx} className="grid grid-cols-7 col-span-7">
                          {week.map((day, dIdx) => {
                            const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
                            const isToday = day.toDateString() === new Date().toDateString();
                            const dayApps = getDayAppointments(day);
                            const MAX_VISIBLE = 4;

                            return (
                              <div
                                id={`calendar-day-${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`}
                                key={dIdx}
                                className={`min-h-[120px] border-r border-b border-slate-200 p-1.5 flex flex-col transition-colors relative group ${
                                  isCurrentMonth ? 'bg-white' : 'bg-slate-50/50 text-slate-400'
                                } ${isToday ? 'bg-blue-50/40' : ''}`}
                              >
                                {/* Date number + add button */}
                                <div className="flex justify-between items-center mb-1.5">
                                  <span
                                    className={`text-xs font-bold font-mono rounded-full w-6 h-6 flex items-center justify-center ${
                                      isToday
                                        ? 'bg-indigo-600 text-white'
                                        : isCurrentMonth
                                        ? 'text-slate-700'
                                        : 'text-slate-400'
                                    }`}
                                  >
                                    {day.getDate()}
                                  </span>
                                  <button
                                    onClick={() => {
                                      setActiveAppointment(null);
                                      setInitialDateForCreate(day);
                                      setIsModalOpen(true);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-900 transition-opacity cursor-pointer"
                                  >
                                    <PlusCircle className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {/* Appointment chips */}
                                <div className="space-y-0.5 flex-1">
                                  {dayApps.slice(0, MAX_VISIBLE).map((app) => {
                                    const job = jobs.find((j) => j.id === app.jobId);
                                    const palette = job ? getColorPalette(job.color) : getColorPalette('indigo');
                                    const nowMs = Date.now();
                                    const appStartMs = new Date(app.startTime).getTime();
                                    const isUpcoming = appStartMs >= nowMs && appStartMs <= nowMs + 86400000;
                                    const timeStr = new Date(app.startTime).toLocaleTimeString('en-AU', {
                                      hour: 'numeric', minute: '2-digit', hour12: true,
                                    }).toLowerCase().replace(' ', '');

                                    return (
                                      <button
                                        key={app.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                          setQuickPreview({ app, x: rect.left, y: rect.bottom + 4 });
                                        }}
                                        className={`w-full text-left rounded px-1.5 py-0.5 flex items-center gap-1 leading-none ${palette.bg} ${palette.text} ${
                                          isUpcoming ? 'ring-1 ring-amber-400' : ''
                                        } ${app.status === 'cancelled' ? 'opacity-50' : ''} hover:opacity-90 cursor-pointer transition-opacity`}
                                      >
                                        {/* Coloured left stripe */}
                                        <span className={`shrink-0 w-1 h-3 rounded-full opacity-80 ${palette.border.replace('border-', 'bg-')}`} />
                                        {/* Time */}
                                        <span className="text-[9px] font-bold font-mono shrink-0 opacity-90">{timeStr}</span>
                                        {/* Title or client name */}
                                        <span className={`text-[9px] font-semibold truncate flex-1 ${app.status === 'cancelled' ? 'line-through' : ''}`}>
                                          {isUpcoming && <span className="text-amber-500 mr-0.5">⚡</span>}
                                          {job ? job.clientName : app.title}
                                        </span>
                                        {app.reminder && <Bell className="w-2 h-2 shrink-0 text-amber-500" />}
                                        {app.recurrenceGroupId && <span className="text-[8px] shrink-0 opacity-60">↺</span>}
                                      </button>
                                    );
                                  })}
                                  {dayApps.length > MAX_VISIBLE && (
                                    <button
                                      onClick={() => { setSelectedDate(day); setView('day'); }}
                                      className="w-full text-[9px] font-semibold text-indigo-600 hover:text-indigo-800 text-center py-0.5 rounded hover:bg-indigo-50 transition-colors cursor-pointer"
                                    >
                                      +{dayApps.length - MAX_VISIBLE} more
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. WEEK VIEW — Outlook-style 15-min time grid */}
                {view === 'week' && (() => {
                  const SLOT_HEIGHT = 16;
                  const HOUR_HEIGHT = SLOT_HEIGHT * 4;
                  const DAY_START_HOUR = 7;
                  const DAY_END_HOUR = 21;
                  const TOTAL_HOURS = DAY_END_HOUR - DAY_START_HOUR;
                  const GRID_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;
                  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => DAY_START_HOUR + i);
                  const nowMs = Date.now();
                  const todayStr = new Date().toDateString();

                  const msToTop = (ms: number, dayStart: number) => {
                    const clipped = Math.max(dayStart, Math.min(dayStart + TOTAL_HOURS * 3600000, ms));
                    return ((clipped - dayStart) / (1000 * 60 * 15)) * SLOT_HEIGHT;
                  };
                  const msToHeight = (startMs: number, endMs: number, dayStart: number) => {
                    const top = msToTop(startMs, dayStart);
                    const bot = msToTop(endMs, dayStart);
                    return Math.max(SLOT_HEIGHT, bot - top);
                  };

                  return (
                    <div className="bg-white border border-slate-200 rounded overflow-hidden">
                      {/* Day header row */}
                      <div className="flex border-b border-slate-200 bg-slate-50">
                        <div className="w-16 shrink-0 border-r border-slate-100" />
                        {weekDates.map((day, dIdx) => {
                          const isToday = day.toDateString() === todayStr;
                          return (
                            <div key={dIdx} className={`flex-1 text-center py-2 border-r border-slate-100 last:border-r-0 ${isToday ? 'bg-indigo-50' : ''}`}>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                {day.toLocaleDateString('en-AU', { weekday: 'short' })}
                              </p>
                              <p className={`text-sm font-bold font-mono mt-0.5 ${isToday ? 'text-indigo-600' : 'text-slate-800'}`}>
                                {day.getDate()}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Scrollable grid */}
                      <div className="flex overflow-y-auto" style={{ maxHeight: '560px' }}>
                        {/* Hour labels */}
                        <div className="w-16 shrink-0 relative border-r border-slate-100" style={{ height: `${GRID_HEIGHT}px` }}>
                          {hours.map((h) => (
                            <div key={h} className="absolute w-full flex justify-end pr-2"
                              style={{ top: `${(h - DAY_START_HOUR) * HOUR_HEIGHT - 8}px` }}>
                              <span className="text-[10px] font-mono text-slate-400">
                                {h < 10 ? `0${h}` : h}:00
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Day columns */}
                        {weekDates.map((day, dIdx) => {
                          const isToday = day.toDateString() === todayStr;
                          const dayStart = new Date(day); dayStart.setHours(DAY_START_HOUR, 0, 0, 0);
                          const dayStartMs = dayStart.getTime();
                          const dayApps = getDayAppointments(day);
                          const nowTop = isToday && nowMs >= dayStartMs && nowMs <= dayStartMs + TOTAL_HOURS * 3600000
                            ? msToTop(nowMs, dayStartMs) : null;

                          return (
                            <div key={dIdx} className={`flex-1 relative border-r border-slate-100 last:border-r-0 ${isToday ? 'bg-indigo-50/20' : ''}`}
                              style={{ height: `${GRID_HEIGHT}px` }}>

                              {/* Hour + slot lines */}
                              {hours.slice(0, TOTAL_HOURS).map((h) => (
                                <div key={h} className="absolute w-full" style={{ top: `${(h - DAY_START_HOUR) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}>
                                  <div className="absolute top-0 left-0 w-full border-t border-slate-200" />
                                  {[1, 2, 3].map((q) => (
                                    <div key={q} className="absolute left-0 w-full border-t border-slate-100"
                                      style={{ top: `${q * SLOT_HEIGHT}px` }} />
                                  ))}
                                  {/* Clickable 15-min slots */}
                                  {[0, 1, 2, 3].map((q) => (
                                    <div key={q}
                                      className="absolute left-0 w-full hover:bg-indigo-100/50 cursor-pointer transition-colors"
                                      style={{ top: `${q * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
                                      onClick={() => {
                                        const d = new Date(day);
                                        d.setHours(h, q * 15, 0, 0);
                                        setQuickPreview(null);
                                        setActiveAppointment(null);
                                        setInitialDateForCreate(d);
                                        setIsModalOpen(true);
                                      }} />
                                  ))}
                                </div>
                              ))}

                              {/* Now indicator */}
                              {nowTop !== null && (
                                <div className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                                  style={{ top: `${nowTop}px` }}>
                                  <div className="relative w-2.5 h-2.5 shrink-0 -ml-1.5 flex items-center justify-center">
                                    <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60 animate-ping" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600" />
                                  </div>
                                  <div className="flex-1 h-[2px] bg-rose-500 rounded-full" />
                                </div>
                              )}

                              {/* Appointment blocks */}
                              {dayApps.map((app) => {
                                const job = jobs.find((j) => j.id === app.jobId);
                                const palette = job ? getColorPalette(job.color) : getColorPalette('indigo');
                                const appStartMs = new Date(app.startTime).getTime();
                                const appEndMs = new Date(app.endTime).getTime();
                                const top = msToTop(appStartMs, dayStartMs);
                                const height = msToHeight(appStartMs, appEndMs, dayStartMs);
                                const isUpcoming = appStartMs >= nowMs && appStartMs <= nowMs + 86400000;
                                const isTall = height >= SLOT_HEIGHT * 2;

                                return (
                                  <button key={app.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                      setQuickPreview({ app, x: rect.left, y: rect.bottom + 6 });
                                    }}
                                    className={`absolute left-0.5 right-0.5 z-10 rounded border text-left overflow-hidden cursor-pointer transition-all hover:z-30 hover:shadow-md ${palette.bg} ${palette.text} ${isUpcoming ? 'border-amber-500 ring-1 ring-amber-400/40' : palette.border}`}
                                    style={{ top: `${top + 1}px`, height: `${height - 2}px` }}>
                                    <div className="px-1 py-0.5 h-full flex flex-col overflow-hidden">
                                      <span className="text-[9px] font-semibold truncate leading-tight">
                                        {isUpcoming && '⚡'}{app.title}
                                      </span>
                                      {isTall && job && (
                                        <span className="text-[8px] opacity-75 truncate">{job.clientName}</span>
                                      )}
                                      {isTall && (
                                        <span className="text-[8px] opacity-70 font-mono mt-auto">
                                          {new Date(app.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* 3. DAY VIEW — Outlook-style 15-min grid */}
                {view === 'day' && (() => {
                  const SLOT_HEIGHT = 16; // px per 15-min slot
                  const HOUR_HEIGHT = SLOT_HEIGHT * 4; // 64px per hour
                  const DAY_START_HOUR = 7; // 07:00
                  const DAY_END_HOUR = 21;  // 21:00
                  const TOTAL_HOURS = DAY_END_HOUR - DAY_START_HOUR;
                  const TOTAL_SLOTS = TOTAL_HOURS * 4;
                  const GRID_HEIGHT = TOTAL_SLOTS * SLOT_HEIGHT; // total px

                  const selectedMs = selectedDate.getTime();
                  const dayStart = new Date(selectedDate);
                  dayStart.setHours(DAY_START_HOUR, 0, 0, 0);
                  const dayEnd = new Date(selectedDate);
                  dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);

                  const dayAppointments = getDayAppointments(selectedDate);

                  // Position helpers
                  const msToTop = (ms: number) => {
                    const clipped = Math.max(dayStart.getTime(), Math.min(dayEnd.getTime(), ms));
                    return ((clipped - dayStart.getTime()) / (1000 * 60 * 15)) * SLOT_HEIGHT;
                  };
                  const msToHeight = (startMs: number, endMs: number) => {
                    const top = msToTop(startMs);
                    const bot = msToTop(endMs);
                    return Math.max(SLOT_HEIGHT, bot - top);
                  };

                  const isViewingToday = selectedDate.toDateString() === new Date().toDateString();
                  const nowMs = Date.now();
                  const nowTop = isViewingToday && nowMs >= dayStart.getTime() && nowMs <= dayEnd.getTime()
                    ? msToTop(nowMs)
                    : null;
                  const nowLabel = isViewingToday
                    ? new Date(nowMs).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })
                    : null;

                  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => DAY_START_HOUR + i);

                  return (
                    <div className="bg-white border border-slate-200 rounded overflow-hidden">
                      {/* Top toolbar */}
                      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50">
                        <span className="text-xs text-slate-500 font-medium">
                          {dayAppointments.length} appointment{dayAppointments.length !== 1 ? 's' : ''}
                        </span>
                        <button
                          id="day-grid-add-btn"
                          onClick={() => {
                            setActiveAppointment(null);
                            setInitialDateForCreate(selectedDate);
                            setIsModalOpen(true);
                          }}
                          className="text-slate-700 hover:text-slate-900 font-semibold flex items-center gap-1 text-xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Book Appointment
                        </button>
                      </div>

                      {/* Grid area */}
                      <div className="flex overflow-y-auto" style={{ maxHeight: '600px' }}>
                        {/* Hour labels column */}
                        <div className="w-16 shrink-0 relative select-none" style={{ height: `${GRID_HEIGHT}px` }}>
                          {hours.map((h) => (
                            <div
                              key={h}
                              className="absolute w-full flex items-start justify-end pr-2"
                              style={{ top: `${(h - DAY_START_HOUR) * HOUR_HEIGHT - 8}px`, height: `${HOUR_HEIGHT}px` }}
                            >
                              <span className="text-[10px] font-mono text-slate-400 leading-none pt-1">
                                {h < 10 ? `0${h}` : h}:00
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Main grid */}
                        <div className="flex-1 relative border-l border-slate-100" style={{ height: `${GRID_HEIGHT}px` }}>
                          {/* Hour lines + 15-min slot lines */}
                          {hours.slice(0, TOTAL_HOURS).map((h) => (
                            <div
                              key={h}
                              className="absolute w-full"
                              style={{ top: `${(h - DAY_START_HOUR) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                            >
                              {/* Bold hour line */}
                              <div className="absolute top-0 left-0 w-full border-t border-slate-200" />
                              {/* 15-min sub-lines */}
                              {[1, 2, 3].map((q) => (
                                <div
                                  key={q}
                                  className="absolute left-0 w-full border-t border-slate-100"
                                  style={{ top: `${q * SLOT_HEIGHT}px` }}
                                />
                              ))}
                              {/* Clickable slots */}
                              {[0, 1, 2, 3].map((q) => (
                                <div
                                  key={q}
                                  className="absolute left-0 w-full hover:bg-indigo-50/40 cursor-pointer transition-colors"
                                  style={{ top: `${q * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
                                  onClick={() => {
                                    const d = new Date(selectedDate);
                                    d.setHours(h, q * 15, 0, 0);
                                    setActiveAppointment(null);
                                    setInitialDateForCreate(d);
                                    setIsModalOpen(true);
                                  }}
                                />
                              ))}
                            </div>
                          ))}

                          {/* "Now" indicator */}
                          {nowTop !== null && (
                            <div
                              className="absolute left-0 right-0 z-20 flex items-center gap-1 pointer-events-none"
                              style={{ top: `${nowTop}px` }}
                            >
                              <div className="relative w-3 h-3 shrink-0 -ml-1.5 flex items-center justify-center">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60 animate-ping" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600" />
                              </div>
                              <div className="flex-1 h-[2px] bg-rose-500 rounded-full" />
                              <span className="text-[9px] font-bold text-white bg-rose-600 px-1.5 py-0.5 rounded-full mr-2 shrink-0">
                                {nowLabel}
                              </span>
                            </div>
                          )}

                          {/* Appointment blocks */}
                          {dayAppointments.map((app) => {
                            const job = jobs.find((j) => j.id === app.jobId);
                            const palette = job ? getColorPalette(job.color) : getColorPalette('indigo');
                            const appStartMs = new Date(app.startTime).getTime();
                            const appEndMs = new Date(app.endTime).getTime();
                            const top = msToTop(appStartMs);
                            const height = msToHeight(appStartMs, appEndMs);
                            const isUpcoming = appStartMs >= nowMs && appStartMs <= nowMs + 24 * 60 * 60 * 1000;
                            const isTall = height >= SLOT_HEIGHT * 3;

                            return (
                              <button
                                key={app.id}
                                id={`day-grid-app-${app.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  setQuickPreview({ app, x: rect.left, y: rect.bottom + 6 });
                                }}
                                className={`absolute left-1 right-1 z-10 rounded border text-left overflow-hidden cursor-pointer transition-all hover:z-30 hover:shadow-md ${palette.bg} ${palette.text} ${
                                  isUpcoming ? 'border-amber-500 ring-1 ring-amber-400/40' : palette.border
                                }`}
                                style={{ top: `${top + 1}px`, height: `${height - 2}px` }}
                              >
                                <div className="px-1.5 py-0.5 h-full flex flex-col justify-start overflow-hidden">
                                  <div className="flex items-center gap-1 leading-tight">
                                    {isUpcoming && <span className="text-amber-500 text-[10px]">⚡</span>}
                                    {app.reminder && <Bell className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
                                    {app.recurrenceGroupId && <span className="text-[9px] opacity-60">↺</span>}
                                    <span className="text-[10px] font-semibold truncate leading-tight">{app.title}</span>
                                  </div>
                                  {isTall && job && (
                                    <span className="text-[9px] opacity-80 truncate">{job.clientName}</span>
                                  )}
                                  {isTall && (
                                    <span className="text-[9px] opacity-70 font-mono mt-auto">
                                      {new Date(app.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                      {' – '}
                                      {new Date(app.endTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            </AnimatePresence>
          </section>

          {/* Quick Preview Popup */}
          {quickPreview && (() => {
            const { app, x, y } = quickPreview;
            const job = jobs.find((j) => j.id === app.jobId);
            const palette = job ? getColorPalette(job.color) : getColorPalette('indigo');
            return (
              <>
                {/* Click-away backdrop */}
                <div className="fixed inset-0 z-40" onClick={() => setQuickPreview(null)} />
                <div
                  className="fixed z-50 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-4 space-y-3"
                  style={{ left: Math.min(x, window.innerWidth - 300), top: Math.min(y, window.innerHeight - 220) }}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${palette.badge} inline-block mb-1`}>
                        {job?.clientName ?? 'No client'}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">{app.title}</h3>
                    </div>
                    <button onClick={() => setQuickPreview(null)} className="text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Time */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {new Date(app.startTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    {' – '}
                    {new Date(app.endTime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    <span className="ml-1 text-[10px] text-slate-400">({formatDuration(app.startTime, app.endTime)})</span>
                  </div>
                  {/* Location */}
                  {app.location && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {app.location}
                    </div>
                  )}
                  {/* Notes */}
                  {app.notes && (
                    <p className="text-xs text-slate-500 italic border-l-2 border-slate-200 pl-2">{app.notes}</p>
                  )}
                  {/* Status + flags */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                      app.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      app.status === 'cancelled' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>{app.status}</span>
                    {app.recurrenceGroupId && <span className="text-[9px] text-slate-500 font-bold">↺ Recurring</span>}
                    {app.reminder && <span className="text-[9px] text-amber-600 font-bold flex items-center gap-0.5"><Bell className="w-3 h-3" /> Reminder</span>}
                  </div>
                  {/* Actions */}
                  <div className="flex gap-2 pt-1 border-t border-slate-100">
                    <button
                      onClick={() => { setQuickPreview(null); setActiveAppointment(app); setIsModalOpen(true); }}
                      className="flex-1 text-xs font-semibold bg-slate-900 text-white rounded-lg py-1.5 hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => { setQuickPreview(null); handleDeleteAppointment(app.id); }}
                      className="px-3 text-xs font-semibold border border-rose-200 text-rose-600 rounded-lg py-1.5 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </>
            );
          })()}

          {/* Contracting Job Manager widget (Right Sidebar Column) */}
          <aside className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded border border-slate-200 p-5 shadow-2xs space-y-3 font-sans">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 pb-2 border-b border-slate-50">
                <FileCheck className="w-4 h-4 text-emerald-600" /> Synchronization Info
              </h4>
              <p className="text-xs text-slate-650 leading-relaxed">
                Sync with <strong>Google Calendar</strong> and <strong>Microsoft Outlook</strong> manually anytime using:
              </p>
              <div className="bg-slate-50 rounded p-3 border border-slate-200 space-y-2">
                <div className="flex items-start gap-1.5 text-[11px] text-slate-550">
                  <span className="font-semibold text-slate-800 shrink-0">1.</span>
                  <span>Inside any appointment, select <strong>&quot;Save &amp; Export ICS&quot;</strong>.</span>
                </div>
                <div className="flex items-start gap-1.5 text-[11px] text-slate-550">
                  <span className="font-semibold text-slate-800 shrink-0">2.</span>
                  <span>Drag-and-drop or import the <code>.ics</code> document directly inside your Outlook or Google Calendar.</span>
                </div>
                <div className="flex items-start gap-1.5 text-[11px] text-slate-550">
                  <span className="font-semibold text-slate-800 shrink-0">3.</span>
                  <span>Toggle synchronization states to stay on top of your bookings!</span>
                </div>
              </div>
            </div>

            {/* Quick help banner */}
            <div className="bg-slate-900 rounded p-5 text-white flex flex-col justify-between h-44 relative overflow-hidden shadow-sm">
              <div className="z-10">
                <h4 className="font-semibold text-sm tracking-tight leading-snug">Contractor Calendar</h4>
                <p className="text-slate-300 text-xs mt-1.5 leading-relaxed">
                  Easily view schedules across different billing categories to avoid overbooking.
                </p>
              </div>
              <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1 z-10">
                <BookOpen className="w-3.5 h-3.5" /> 100% Offline-Safe Storage
              </div>
              <div className="absolute right-[-15px] bottom-[-20px] w-28 h-28 bg-slate-850 rounded-full blur-lg opacity-40"></div>
            </div>
          </aside>
        </div>

        {/* Full contracting client specifications list */}
        <div className="w-full">
          <ContractJobsManager
            jobs={jobs}
            onAddJob={handleAddJob}
            onUpdateJob={handleUpdateJob}
            onDeleteJob={handleDeleteJob}
          />
        </div>
      </main>

      {/* Appointment Creation and Editing Dialog */}
      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setActiveAppointment(null);
          setInitialDateForCreate(null);
        }}
        jobs={jobs}
        appointments={appointments}
        appointment={activeAppointment}
        initialDate={initialDateForCreate}
        onSave={handleSaveAppointment}
        onDelete={handleDeleteAppointment}
        onDeleteSeries={handleDeleteSeries}
      />
    </div>
  );
}
