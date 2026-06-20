import { ContractJob, Appointment } from '../types';
import { calculateMonthEarnings, getColorPalette } from '../utils';
import { DollarSign, Clock, CheckCircle2, ArrowUpRight } from 'lucide-react';

interface AnalyticsPanelProps {
  jobs: ContractJob[];
  appointments: Appointment[];
  selectedDate: Date;
}

export default function AnalyticsPanel({
  jobs,
  appointments,
  selectedDate,
}: AnalyticsPanelProps) {
  const currentMonthName = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Compute stats for current selected month
  const targetYear = selectedDate.getFullYear();
  const targetMonth = selectedDate.getMonth();

  const monthAppointments = appointments.filter((app) => {
    const d = new Date(app.startTime);
    return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
  });

  const scheduledCount = monthAppointments.filter((a) => a.status === 'scheduled').length;
  const completedCount = monthAppointments.filter((a) => a.status === 'completed').length;
  const cancelledCount = monthAppointments.filter((a) => a.status === 'cancelled').length;

  // Hourly earnings computation
  const hourlyEstEarnings = calculateMonthEarnings(appointments, jobs, selectedDate);

  // Calculate hours booked this month
  let totalHours = 0;
  monthAppointments.forEach((app) => {
    if (app.status === 'cancelled') return;
    const start = new Date(app.startTime).getTime();
    const end = new Date(app.endTime).getTime();
    totalHours += Math.max(0, (end - start) / (1000 * 60 * 60));
  });

  // Calculate distribution of appointments per client/job
  const jobStatsMap = jobs.map((job) => {
    const matchingApps = monthAppointments.filter((app) => app.jobId === job.id && app.status !== 'cancelled');
    let hours = 0;
    matchingApps.forEach((app) => {
      const start = new Date(app.startTime).getTime();
      const end = new Date(app.endTime).getTime();
      hours += Math.max(0, (end - start) / (1000 * 60 * 60));
    });

    const earnings = job.rateType === 'hourly' ? hours * job.rateAmount : 'Flat project';

    return {
      ...job,
      hoursCount: hours,
      appointmentCount: matchingApps.length,
      earnings,
    };
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 font-sans">
      {/* Earnings Estimation Widget */}
      <div className="bg-white rounded border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block leading-none">
              Estimated Monthly Revenue
            </span>
            <span className="text-xl font-bold text-slate-900 tracking-tight mt-1.5 ml-0.5 block">
              ${hourlyEstEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-8 h-8 rounded bg-slate-50 text-slate-700 flex items-center justify-center font-bold border border-slate-200">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between text-xs">
          <span className="text-slate-400">Month of {currentMonthName}</span>
          <span className="text-slate-700 font-medium flex items-center gap-1">
            Hourly Contracts <ArrowUpRight className="w-3 h-3" />
          </span>
        </div>
      </div>

      {/* Booked Time Widget */}
      <div className="bg-white rounded border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block leading-none">
              Total Contracted Time
            </span>
            <span className="text-xl font-bold text-slate-900 tracking-tight mt-1.5 ml-0.5 block font-mono">
              {totalHours.toFixed(1)} <span className="text-xs font-normal text-slate-400 font-sans">hrs</span>
            </span>
          </div>
          <div className="w-8 h-8 rounded bg-slate-50 text-slate-700 flex items-center justify-center font-bold border border-slate-200">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between text-xs">
          <span className="text-slate-400">Active hours billed</span>
          <span className="text-slate-700 font-medium flex items-center gap-1">
            {monthAppointments.filter((a) => a.status !== 'cancelled').length} meetings logged
          </span>
        </div>
      </div>

      {/* Meeting Metrics Widget */}
      <div className="bg-white rounded border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block leading-none">
              Appointment Delivery Rate
            </span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-xl font-bold text-slate-900 tracking-tight">
                {monthAppointments.length > 0 ? Math.round((completedCount / (monthAppointments.length - cancelledCount || 1)) * 100) : 0}%
              </span>
              <span className="text-xs font-normal text-slate-400">completion</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded bg-slate-50 text-slate-700 flex items-center justify-center font-bold border border-slate-200">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        {/* Mini progress bar segments */}
        <div className="space-y-1 mt-4">
          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-slate-800 transition-all duration-300"
              style={{
                width: `${monthAppointments.length > 0 ? (completedCount / monthAppointments.length) * 100 : 0}%`,
              }}
              title="Completed Appointments"
            />
            <div
              className="h-full bg-slate-400 transition-all duration-300"
              style={{
                width: `${monthAppointments.length > 0 ? (scheduledCount / monthAppointments.length) * 100 : 0}%`,
              }}
              title="Scheduled/Upcoming Appointments"
            />
            <div
              className="h-full bg-slate-200 transition-all duration-300"
              style={{
                width: `${monthAppointments.length > 0 ? (cancelledCount / monthAppointments.length) * 100 : 0}%`,
              }}
              title="Cancelled Appointments"
            />
          </div>
          <div className="flex justify-between items-center text-[9px] text-slate-400">
            <span className="flex items-center gap-1 font-semibold">
              <span className="w-1 h-1 rounded-full bg-slate-800"></span>
              {completedCount} done
            </span>
            <span className="flex items-center gap-1 font-semibold">
              <span className="w-1 h-1 rounded-full bg-slate-400"></span>
              {scheduledCount} upcoming
            </span>
            {cancelledCount > 0 && (
              <span className="flex items-center gap-1 font-semibold">
                <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                {cancelledCount} cancelled
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Client breakdowns */}
      <div className="bg-white rounded border border-slate-200 p-5 shadow-2xs col-span-full">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Billing distribution by client ({currentMonthName})</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {jobStatsMap.map((job) => {
            const palette = getColorPalette(job.color);
            return (
              <div key={job.id} className={`p-3 rounded border ${palette.border} ${palette.bg} flex justify-between items-center`}>
                <div>
                  <h5 className="font-bold text-slate-800 text-xs">{job.clientName}</h5>
                  <p className="text-[10px] text-slate-500 font-medium">Billed: {job.hoursCount.toFixed(1)} hrs</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-700 font-mono">
                    {typeof job.earnings === 'number' ? `$${job.earnings.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : 'Flat project'}
                  </span>
                  <p className="text-[9px] text-slate-400 font-medium">{job.appointmentCount} active logs</p>
                </div>
              </div>
            );
          })}
          {jobs.length === 0 && (
            <span className="text-slate-400 text-xs italic col-span-full text-center py-2">
              No active clients/jobs designed yet to show dynamic distributions.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
