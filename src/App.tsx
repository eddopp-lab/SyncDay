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

                            return (
                              <div
                                id={`calendar-day-${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`}
                                key={dIdx}
                                className={`min-h-[100px] border-r border-b border-slate-200 p-2 flex flex-col justify-between transition-colors relative group ${
                                  isCurrentMonth ? 'bg-white' : 'bg-slate-50/50 text-slate-400'
                                } ${isToday ? 'bg-slate-100/50 font-semibold' : ''}`}
                              >
                                <div className="flex justify-between items-center mb-1">
                                  <span
                                    className={`text-xs font-bold font-mono rounded-full w-5 h-5 flex items-center justify-center ${
                                      isToday
                                        ? 'bg-slate-900 text-white'
                                        : isCurrentMonth
                                        ? 'text-slate-700'
                                        : 'text-slate-450'
                                    }`}
                                  >
                                    {day.getDate()}
                                  </span>

                                  {/* Plus action that appears on hover */}
                                  <button
                                    id={`quick-add-${day.getDate()}`}
                                    onClick={() => {
                                      setActiveAppointment(null);
                                      setInitialDateForCreate(day);
                                      setIsModalOpen(true);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 text-slate-800 hover:text-slate-950 font-bold transition-opacity p-0.5 rounded cursor-pointer"
                                    title="Add appointment on this day"
                                  >
                                    <PlusCircle className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                {/* Appointment blocks column */}
                                <div className="space-y-1 overflow-y-auto max-h-[70px] mt-1">
                                  {dayApps.slice(0, 3).map((app) => {
                                    const job = jobs.find((j) => j.id === app.jobId);
                                    const palette = job ? getColorPalette(job.color) : getColorPalette('indigo');
                                    const nowMs = new Date().getTime();
                                    const appStartMs = new Date(app.startTime).getTime();
                                    const isUpcoming = appStartMs >= nowMs && appStartMs <= nowMs + 24 * 60 * 60 * 1000;
                                    
                                    return (
                                      <button
                                        id={`day-app-${app.id}`}
                                        key={app.id}
                                        onClick={() => {
                                          setActiveAppointment(app);
                                          setIsModalOpen(true);
                                        }}
                                        className={`w-full text-left text-[10px] p-1 rounded border leading-tight truncate block ${palette.bg} ${palette.text} ${
                                          isUpcoming ? 'border-amber-500 ring-1 ring-amber-400/30' : palette.border
                                        } hover:opacity-90 font-medium transition-all cursor-pointer`}
                                        title={`${app.title} (${job ? job.clientName : 'Contract'})${isUpcoming ? ' - Starts in next 24 Hours!' : ''}`}
                                      >
                                        <div className="font-semibold flex items-center justify-between gap-1">
                                          <span className="truncate flex items-center gap-0.5">
                                            {isUpcoming && <span className="text-amber-500 font-bold shrink-0">⚡</span>}
                                            {app.status === 'cancelled' ? (
                                              <span className="line-through text-slate-400">{app.title}</span>
                                            ) : (
                                              app.title
                                            )}
                                          </span>
                                          {app.reminder && <Bell className="w-2.5 h-2.5 shrink-0 text-amber-500 font-bold" />}
                                        </div>
                                        <div className="text-[8px] opacity-80 flex items-center justify-between mt-0.5">
                                          <span>
                                            {new Date(app.startTime).toLocaleTimeString('en-US', {
                                              hour: 'numeric',
                                              minute: '2-digit',
                                              hour12: false,
                                            })}
                                          </span>
                                          <div className="flex gap-0.5 items-center">
                                            {app.recurrenceGroupId && <span className="text-[8px] mr-1 text-slate-500 font-bold" title="Recurring appointment">↺</span>}
                                            {app.syncedGoogle && <span className="text-[7px]" title="Synced with Google Calendar">G</span>}
                                            {app.syncedOutlook && <span className="text-[7px]" title="Synced with Outlook">O</span>}
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                  {dayApps.length > 3 && (
                                    <button
                                      id={`more-apps-${day.getDate()}`}
                                      onClick={() => {
                                        setSelectedDate(day);
                                        setView('day');
                                      }}
                                      className="text-[9px] font-semibold text-slate-800 block text-center w-full bg-slate-50 border border-slate-200 rounded py-0.5 cursor-pointer"
                                    >
                                      +{dayApps.length - 3} more
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

                {/* 2. WEEK VIEW */}
                {view === 'week' && (
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                    {weekDates.map((day, dIdx) => {
                      const isToday = day.toDateString() === new Date().toDateString();
                      const dayApps = getDayAppointments(day);

                      return (
                        <div
                          id={`week-col-${day.getDate()}`}
                          key={dIdx}
                          className={`border rounded p-3 flex flex-col bg-white min-h-[250px] ${
                            isToday ? 'border-slate-800 bg-slate-100/30' : 'border-slate-200'
                          }`}
                        >
                          <div className="border-b border-slate-100 pb-2 mb-3 flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                {day.toLocaleDateString('en-US', { weekday: 'short' })}
                              </p>
                              <p className="text-xs font-bold text-slate-800 font-mono mt-0.5">
                                {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </p>
                            </div>
                            <button
                              id={`week-add-${day.getDate()}`}
                              onClick={() => {
                                setActiveAppointment(null);
                                setInitialDateForCreate(day);
                                setIsModalOpen(true);
                              }}
                              className="text-slate-400 hover:text-slate-900 p-1 rounded transition-colors cursor-pointer"
                              title="Add calendar slot"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="space-y-2 flex-1 overflow-y-auto">
                            {dayApps.length === 0 ? (
                              <span className="text-[10px] text-slate-400 block text-center py-6 italic">No visits.</span>
                            ) : (
                              dayApps.map((app) => {
                                const job = jobs.find((j) => j.id === app.jobId);
                                const palette = job ? getColorPalette(job.color) : getColorPalette('indigo');
                                const nowMs = new Date().getTime();
                                const appStartMs = new Date(app.startTime).getTime();
                                const isUpcoming = appStartMs >= nowMs && appStartMs <= nowMs + 24 * 60 * 60 * 1000;

                                return (
                                  <button
                                    id={`week-app-card-${app.id}`}
                                    key={app.id}
                                    onClick={() => {
                                      setActiveAppointment(app);
                                      setIsModalOpen(true);
                                    }}
                                    className={`w-full text-left p-2.5 rounded border text-xs flex flex-col justify-between leading-snug transition-all hover:scale-[1.01] cursor-pointer relative overflow-hidden ${palette.bg} ${palette.text} ${
                                      isUpcoming ? 'border-amber-500 ring-2 ring-amber-400/25 shadow-md shadow-amber-500/10' : palette.border
                                    }`}
                                  >
                                    <div className="w-full">
                                      <div className="flex items-start justify-between gap-1">
                                        <span className="font-semibold truncate leading-tight flex items-center gap-1">
                                          {isUpcoming && <span className="text-amber-500 font-bold" title="Starts in next 24h">⚡</span>}
                                          {app.title}
                                          {app.recurrenceGroupId && <span className="text-[10px] text-slate-500 font-bold" title="Recurring appointment">↺</span>}
                                        </span>
                                        {app.reminder && (
                                          <Bell className="w-3 h-3 text-amber-500 animate-bounce shrink-0" title="Reminder Active" />
                                        )}
                                      </div>
                                      {job && (
                                        <div className="flex items-center justify-between mt-0.5">
                                          <span className="text-[9px] opacity-90 block tracking-tight font-medium truncate">{job.clientName}</span>
                                          {isUpcoming && (
                                            <span className="text-[8px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 rounded px-1.5 py-0.5 border border-amber-200 shrink-0">
                                              Next 24h
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    <div className="mt-2 pt-1.5 border-t border-slate-200/40 text-[9px] opacity-85 flex justify-between items-center font-mono">
                                      <span className="flex items-center gap-0.5 text-slate-600">
                                        <Clock className="w-2.5 h-2.5 text-slate-450" />
                                        {new Date(app.startTime).toLocaleTimeString('en-US', {
                                          hour: 'numeric',
                                          minute: '2-digit',
                                          hour12: false,
                                        })}
                                      </span>
                                      <span className="font-medium text-[8px] bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-700">
                                        {formatDuration(app.startTime, app.endTime)}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 3. DAY VIEW */}
                {view === 'day' && (() => {
                  const dayAppointments = getDayAppointments(selectedDate).sort((a, b) => 
                    new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
                  );

                  // Define working bounds for the day view (8:00 AM to 8:00 PM by default)
                  const baseStart = new Date(selectedDate);
                  baseStart.setHours(8, 0, 0, 0);

                  const baseEnd = new Date(selectedDate);
                  baseEnd.setHours(20, 0, 0, 0);

                  let timelineStart = baseStart.getTime();
                  let timelineEnd = baseEnd.getTime();

                  // Adjust bounds if there are appointments outside 8am-8pm
                  dayAppointments.forEach(app => {
                    const appStart = new Date(app.startTime).getTime();
                    const appEnd = new Date(app.endTime).getTime();
                    if (appStart < timelineStart) {
                      timelineStart = appStart;
                    }
                    if (appEnd > timelineEnd) {
                      timelineEnd = appEnd;
                    }
                  });

                  interface TimelineItem {
                    type: 'appointment' | 'gap' | 'now';
                    startTime: Date;
                    endTime: Date;
                    appointment?: Appointment;
                  }

                  const timelineItems: TimelineItem[] = [];
                  let currentPointer = timelineStart;

                  dayAppointments.forEach(app => {
                    const appStart = new Date(app.startTime).getTime();
                    const appEnd = new Date(app.endTime).getTime();

                    // If there's a gap between currentPointer and appStart
                    if (appStart > currentPointer) {
                      if (appStart - currentPointer >= 5 * 60 * 1000) { // minimum 5 mins
                        timelineItems.push({
                          type: 'gap',
                          startTime: new Date(currentPointer),
                          endTime: new Date(appStart)
                        });
                      }
                    }

                    // Add the appointment block
                    timelineItems.push({
                      type: 'appointment',
                      startTime: new Date(appStart),
                      endTime: new Date(appEnd),
                      appointment: app
                    });

                    // Advance pointer
                    if (appEnd > currentPointer) {
                      currentPointer = appEnd;
                    }
                  });

                  // If there's a gap at the end
                  if (timelineEnd > currentPointer) {
                    if (timelineEnd - currentPointer >= 5 * 60 * 1000) {
                      timelineItems.push({
                        type: 'gap',
                        startTime: new Date(currentPointer),
                        endTime: new Date(timelineEnd)
                      });
                    }
                  }

                  // Insert a "now" marker at the correct chronological position,
                  // but only when looking at today's timeline.
                  const isViewingToday = selectedDate.toDateString() === new Date().toDateString();
                  if (isViewingToday) {
                    const nowMs = Date.now();
                    if (nowMs >= timelineStart && nowMs <= timelineEnd) {
                      let insertIndex = timelineItems.length;
                      for (let i = 0; i < timelineItems.length; i++) {
                        if (timelineItems[i].startTime.getTime() > nowMs) {
                          insertIndex = i;
                          break;
                        }
                      }
                      timelineItems.splice(insertIndex, 0, {
                        type: 'now',
                        startTime: new Date(nowMs),
                        endTime: new Date(nowMs),
                      });
                    }
                  }

                  return (
                    <div className="space-y-3 font-sans">
                      <div className="bg-slate-50 rounded p-3 border border-slate-205 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 font-medium">Focused view for chosen contracting calendar slot:</span>
                          {timelineItems.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-slate-200/85 text-slate-700 text-[10px] font-bold">
                              {timelineItems.filter(t => t.type === 'appointment').length} Booked
                            </span>
                          )}
                        </div>
                        <button
                          id="day-add-new-btn"
                          onClick={() => {
                            setActiveAppointment(null);
                            setInitialDateForCreate(selectedDate);
                            setIsModalOpen(true);
                          }}
                          className="text-slate-800 hover:text-slate-950 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Create Slot
                        </button>
                      </div>

                      {/* Timeline List */}
                      <div className="relative pl-0 md:pl-2 space-y-4">
                        {timelineItems.length === 0 ? (
                          <div className="border border-dashed border-slate-200 rounded py-12 text-center bg-slate-50/50">
                            <span className="text-slate-400 font-medium text-xs">
                              {searchTerm.trim() 
                                ? `No appointments matching "${searchTerm}" found on this date.`
                                : "No project appointments planned on this date."}
                            </span>
                            <p className="text-slate-450 text-[11px] mt-1.5">
                              {searchTerm.trim()
                                ? "Try clearing the search filter or typing a different query."
                                : "Click \"Create Slot\" above to log your meetings or work milestones instantly."}
                            </p>
                          </div>
                        ) : (
                          timelineItems.map((item, index) => {
                            if (item.type === 'appointment' && item.appointment) {
                              const app = item.appointment;
                              const job = jobs.find((j) => j.id === app.jobId);
                              const palette = job ? getColorPalette(job.color) : getColorPalette('indigo');

                              return (
                                <div key={index} className="flex gap-3 md:gap-5 items-stretch group/timeline">
                                  {/* Left Time axis column */}
                                  <div className="w-20 md:w-24 text-right shrink-0 flex flex-col justify-between py-1.5 text-slate-500 font-mono text-[10px] md:text-xs">
                                    <span className="font-bold text-slate-800">
                                      {item.startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-medium bg-slate-50 px-1 py-0.5 rounded border border-slate-100 self-end">
                                      {formatDuration(item.startTime.toISOString(), item.endTime.toISOString())}
                                    </span>
                                    <span className="text-slate-400 font-medium font-sans">
                                      {item.endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                    </span>
                                  </div>

                                  {/* Vertical continuous axis line */}
                                  <div className="flex flex-col items-center shrink-0">
                                    <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-800 bg-slate-800 flex items-center justify-center transition-all scale-105 shadow-xs shadow-slate-100 mt-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                    </div>
                                    <div className="w-[1.5px] bg-slate-200 grow my-2" />
                                  </div>

                                  {/* Right Content Block (Appointment Card) */}
                                  <div className="flex-1 pb-4">
                                    {(() => {
                                      const nowMs = new Date().getTime();
                                      const appStartMs = new Date(app.startTime).getTime();
                                      const isUpcoming = appStartMs >= nowMs && appStartMs <= nowMs + 24 * 60 * 60 * 1000;

                                      return (
                                        <div
                                          id={`day-row-${app.id}`}
                                          className={`border rounded p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-2xs ${
                                            isUpcoming ? 'border-amber-500 ring-2 ring-amber-400/25 shadow-md shadow-amber-500/10' : palette.border
                                          } ${palette.bg}`}
                                        >
                                          <div className="space-y-1.5 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${palette.badge}`}>
                                                {job ? job.clientName : 'Client Specified'}
                                              </span>
                                              {isUpcoming && (
                                                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-amber-500 border-amber-500 text-white flex items-center gap-1">
                                                  ⚡ NEXT 24H
                                                </span>
                                              )}
                                              <span className="text-xs font-mono font-bold text-slate-500 flex items-center gap-1">
                                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                {new Date(app.startTime).toLocaleTimeString('en-US', {
                                                  hour: 'numeric',
                                                  minute: '2-digit',
                                                  hour12: false,
                                                })}
                                                &mdash;
                                                {new Date(app.endTime).toLocaleTimeString('en-US', {
                                                  hour: 'numeric',
                                                  minute: '2-digit',
                                                  hour12: false,
                                                })}
                                              </span>
                                            </div>
                                            <h4 className="text-sm font-bold text-slate-800 leading-snug">{app.title}</h4>
                                            
                                            {app.location && (
                                              <p className="text-slate-605 text-xs flex items-center gap-1">
                                                <MapPin className="w-3 h-3 text-slate-400" /> {app.location}
                                              </p>
                                            )}

                                            {app.notes && (
                                              <p className="text-slate-500 text-xs pl-2 border-l border-slate-350 italic">
                                                {app.notes}
                                              </p>
                                            )}
                                          </div>

                                          {/* Actions on this item */}
                                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                                            <div className="flex gap-1 bg-white/70 rounded p-1 border border-slate-205">
                                              {app.reminder && (
                                                <span 
                                                  className="px-1.5 py-0.5 text-[9px] rounded font-bold uppercase bg-amber-100 text-amber-700 flex items-center gap-0.5"
                                                  title="Reminder Active"
                                                >
                                                  <Bell className="w-2.5 h-2.5 text-amber-600 animate-pulse" /> Reminder
                                                </span>
                                              )}
                                              {app.recurrenceGroupId && (
                                                <span 
                                                  className="px-1.5 py-0.5 text-[9px] rounded font-bold uppercase bg-slate-100 text-slate-700 flex items-center gap-0.5"
                                                  title="Recurring Series Item"
                                                >
                                                  🔄 Recurring
                                                </span>
                                              )}
                                              <span 
                                                className={`px-1.5 py-0.5 text-[9px] rounded font-bold uppercase ${
                                                  app.syncedGoogle ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'
                                                }`}
                                                title="Google Sync Tag"
                                              >
                                                Google
                                              </span>
                                              <span 
                                                className={`px-1.5 py-0.5 text-[9px] rounded font-bold uppercase ${
                                                  app.syncedOutlook ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-400'
                                                }`}
                                                title="Outlook Sync Tag"
                                              >
                                                Outlook
                                              </span>
                                            </div>

                                            <button
                                              id={`edit-app-day-${app.id}`}
                                              onClick={() => {
                                                setActiveAppointment(app);
                                                setIsModalOpen(true);
                                              }}
                                              className="bg-white hover:bg-slate-50 text-slate-750 px-3 py-1.5 rounded text-xs font-semibold border border-slate-200 transition-all cursor-pointer"
                                            >
                                              Modify / Edit
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              );
                            } else if (item.type === 'now') {
                              return (
                                <div key={index} className="flex gap-3 md:gap-5 items-center relative -my-2 z-10">
                                  {/* Left Time axis column */}
                                  <div className="w-20 md:w-24 text-right shrink-0 text-rose-600 font-mono text-[10px] md:text-xs font-bold">
                                    {item.startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                  </div>

                                  {/* Pulsing "now" dot on the axis */}
                                  <div className="flex flex-col items-center shrink-0">
                                    <div className="relative w-3.5 h-3.5 flex items-center justify-center">
                                      <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-ping" />
                                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600 border-2 border-white" />
                                    </div>
                                  </div>

                                  {/* Horizontal "now" line across the content area */}
                                  <div className="flex-1 flex items-center gap-2">
                                    <div className="h-[2px] bg-rose-500 flex-1 rounded-full" />
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-white bg-rose-600 px-2 py-0.5 rounded-full shrink-0">
                                      Now
                                    </span>
                                  </div>
                                </div>
                              );
                            } else {
                              // Type is gap
                              return (
                                <div key={index} className="flex gap-3 md:gap-5 items-stretch group/timeline">
                                  {/* Left Time axis column */}
                                  <div className="w-20 md:w-24 text-right shrink-0 flex flex-col justify-between py-1.5 text-slate-400 font-mono text-[10px] md:text-xs">
                                    <span className="font-semibold text-slate-500">
                                      {item.startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-medium bg-slate-100/50 px-1 py-0.5 rounded border border-slate-200/50 self-end">
                                      {formatDuration(item.startTime.toISOString(), item.endTime.toISOString())}
                                    </span>
                                    <span className="text-slate-400 font-sans">
                                      {item.endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                    </span>
                                  </div>

                                  {/* Vertical continuous axis line */}
                                  <div className="flex flex-col items-center shrink-0">
                                    <div className="w-3.5 h-3.5 rounded-full border border-slate-300 bg-white flex items-center justify-center transition-all mt-2 group-hover/timeline:border-slate-800">
                                      <div className="w-1.5 h-1.5 rounded-full bg-slate-200 group-hover/timeline:bg-slate-800" />
                                    </div>
                                    <div className="w-[1.5px] bg-slate-200 grow my-2" />
                                  </div>

                                  {/* Right Content Block (Gap block) */}
                                  <div className="flex-1 pb-4">
                                    <div className="border border-dashed border-slate-200 hover:border-slate-350 rounded p-4 bg-slate-50/20 hover:bg-slate-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all group/gap">
                                      <div>
                                        <div className="flex items-center gap-2 mb-1.5">
                                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200">
                                            Available Space
                                          </span>
                                          <span className="text-[11px] text-slate-450 font-medium font-sans">
                                            ({formatDuration(item.startTime.toISOString(), item.endTime.toISOString())} gap)
                                          </span>
                                        </div>
                                        <h4 className="text-[11px] text-slate-500 font-normal leading-relaxed">
                                          Continuous open calendar slot. Ready for booking client sessions or contracting milestones.
                                        </h4>
                                      </div>
                                      
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveAppointment(null);
                                          setInitialDateForCreate(item.startTime);
                                          setIsModalOpen(true);
                                        }}
                                        className="px-3 py-1.5 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 border border-slate-200 rounded text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-center"
                                      >
                                        <PlusCircle className="w-3.5 h-3.5 text-slate-500 group-hover/gap:text-slate-800" />
                                        Fill Gap
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                          })
                        )}
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            </AnimatePresence>
          </section>

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
