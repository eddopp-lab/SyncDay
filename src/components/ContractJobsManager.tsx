import { useState, FormEvent } from 'react';
import { ContractJob, RateType } from '../types';
import { JOB_COLORS, getColorPalette } from '../utils';
import { Briefcase, CreditCard, Plus, Check, X, Trash2, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ContractJobsManagerProps {
  jobs: ContractJob[];
  onAddJob: (job: Omit<ContractJob, 'id'>) => void;
  onUpdateJob: (job: ContractJob) => void;
  onDeleteJob: (id: string) => void;
}

export default function ContractJobsManager({
  jobs,
  onAddJob,
  onUpdateJob,
  onDeleteJob,
}: ContractJobsManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);

  // Form State
  const [clientName, setClientName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [color, setColor] = useState('indigo');
  const [rateType, setRateType] = useState<RateType>('hourly');
  const [rateAmount, setRateAmount] = useState(100);
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setClientName('');
    setJobTitle('');
    setColor('indigo');
    setRateType('hourly');
    setRateAmount(100);
    setNotes('');
  };

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !jobTitle.trim()) return;

    onAddJob({
      clientName: clientName.trim(),
      jobTitle: jobTitle.trim(),
      color,
      rateType,
      rateAmount,
      notes: notes.trim() || undefined,
    });
    setIsAdding(false);
    resetForm();
  };

  const handleStartEdit = (job: ContractJob) => {
    setEditingJobId(job.id);
    setClientName(job.clientName);
    setJobTitle(job.jobTitle);
    setColor(job.color);
    setRateType(job.rateType);
    setRateAmount(job.rateAmount);
    setNotes(job.notes || '');
  };

  const handleSaveEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!editingJobId || !clientName.trim() || !jobTitle.trim()) return;

    onUpdateJob({
      id: editingJobId,
      clientName: clientName.trim(),
      jobTitle: jobTitle.trim(),
      color,
      rateType,
      rateAmount,
      notes: notes.trim() || undefined,
    });
    setEditingJobId(null);
    resetForm();
  };

  return (
    <div className="bg-white rounded border border-slate-200 p-6 shadow-2xs">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-slate-800" />
            Contracting Jobs
          </h2>
          <p className="text-slate-500 text-xs mt-0.5 font-sans">
            Define your clients, billing terms, and custom theme badges.
          </p>
        </div>
        {!isAdding && !editingJobId && (
          <button
            id="add-job-toggle-btn"
            onClick={() => {
              resetForm();
              setIsAdding(true);
            }}
            className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded text-xs font-medium tracking-tight transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Direct Contract
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {(isAdding || editingJobId) ? (
          <motion.form
            id="job-form"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            onSubmit={editingJobId ? handleSaveEdit : handleCreate}
            className="bg-slate-50 rounded p-4 border border-slate-200 mb-5 space-y-4 font-sans text-sm"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="font-semibold text-slate-800">
                {editingJobId ? 'Edit Contract Specifications' : 'New Contract Project'}
              </span>
              <button
                id="cancel-job-btn"
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setEditingJobId(null);
                  resetForm();
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Client / Company Name</label>
                <input
                  id="client-name-input"
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Stripe Inc."
                  className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Contract / Job Title</label>
                <input
                  id="job-title-input"
                  type="text"
                  required
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Senior Frontend Architect"
                  className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800 transition-colors"
                />
              </div>
            </div>

            {/* Rate & Payment type */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Billing Mechanism</label>
                <div className="grid grid-cols-2 gap-1 bg-slate-200/60 rounded p-0.5">
                  <button
                    id="rate-hourly-btn"
                    type="button"
                    onClick={() => setRateType('hourly')}
                    className={`py-1.5 text-center text-xs font-medium rounded transition-all cursor-pointer ${
                      rateType === 'hourly'
                        ? 'bg-white text-slate-800 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Hourly Rate
                  </button>
                  <button
                    id="rate-flat-btn"
                    type="button"
                    onClick={() => setRateType('flat')}
                    className={`py-1.5 text-center text-xs font-medium rounded transition-all cursor-pointer ${
                      rateType === 'flat'
                        ? 'bg-white text-slate-800 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Flat Rate
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Rate Amount {rateType === 'hourly' ? '($/hr)' : '($)'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-xs">$</span>
                  <input
                    id="rate-amount-input"
                    type="number"
                    min="1"
                    required
                    value={rateAmount || ''}
                    onChange={(e) => setRateAmount(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded pl-7 pr-3 py-1.5 text-slate-800 font-mono text-sm focus:outline-none focus:border-slate-800 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Color Badge Assignment</label>
                <div className="flex gap-2 justify-between">
                  {JOB_COLORS.map((c) => (
                    <button
                      id={`color-select-${c.name}`}
                      key={c.name}
                      type="button"
                      onClick={() => setColor(c.name)}
                      className="w-6 h-6 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center"
                      style={{
                        backgroundColor: c.hex,
                        borderColor: color === c.name ? '#1e293b' : 'transparent',
                      }}
                      title={c.label}
                    >
                      {color === c.name && <Check className="w-3.5 h-3.5 text-white stroke-[3px]" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Notes / Project Objectives</label>
              <textarea
                id="job-notes-input"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Key billing instructions, contact person, or contract deliverables..."
                className="w-full bg-white border border-slate-200 rounded px-3 py-2 text-slate-800 focus:outline-none focus:border-slate-800 transition-colors text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                id="cancel-job-bottom-btn"
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setEditingJobId(null);
                  resetForm();
                }}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 rounded font-medium transition-colors cursor-pointer"
              >
                Discard
              </button>
              <button
                id="submit-job-btn"
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-1.5 rounded text-xs font-medium tracking-tight transition-colors cursor-pointer shadow-sm"
              >
                {editingJobId ? 'Save Modifications' : 'Activate Contract'}
              </button>
            </div>
          </motion.form>
        ) : null}
      </AnimatePresence>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {jobs.length === 0 ? (
          <div className="col-span-full border border-dashed border-slate-200 rounded py-8 text-center bg-slate-50/50">
            <span className="block text-slate-400 font-medium text-xs">No contracting jobs set up yet.</span>
            <p className="text-slate-450 text-[11px] mt-1 px-4">
              Click &quot;Direct Contract&quot; to define your hourly and flat-rate jobs now.
            </p>
          </div>
        ) : (
          jobs.map((job) => {
            const palette = getColorPalette(job.color);
            return (
              <motion.div
                id={`job-card-${job.id}`}
                layout
                key={job.id}
                className={`flex flex-col justify-between border ${palette.border} ${palette.bg} rounded p-4 transition-all hover:shadow-2xs relative group h-full`}
              >
                <div className="mb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm leading-tight group-hover:text-slate-900">
                        {job.clientName}
                      </h3>
                      <p className="text-[11px] font-medium text-slate-600 mt-0.5 flex items-center gap-1">
                        <Briefcase className="w-3 h-3 text-slate-440 shrink-0" />
                        {job.jobTitle}
                      </p>
                    </div>
                    {/* Action buttons */}
                    <div className="flex gap-1">
                      <button
                        id={`edit-job-btn-${job.id}`}
                        onClick={() => handleStartEdit(job)}
                        className="p-1 bg-white/80 hover:bg-white rounded text-slate-500 hover:text-slate-850 transition-colors shadow-3xs border border-slate-150"
                        title="Edit specifications"
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                      </button>
                      <button
                        id={`delete-job-btn-${job.id}`}
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete "${job.clientName}"? Any appointments linked to this contract will be orphaned.`)) {
                            onDeleteJob(job.id);
                          }
                        }}
                        className="p-1 bg-white/80 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-colors shadow-3xs border border-slate-150"
                        title="Archive / Remove"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>

                  {job.notes && (
                    <p className="text-[11px] text-slate-500 italic mt-2 line-clamp-2 border-l border-slate-300 pl-1.5">
                      {job.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 mt-2 bg-white/60 rounded p-2 border border-slate-100/60">
                  <CreditCard className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider leading-none">
                      Contract Term
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-700 mt-0.5">
                      {job.rateType === 'hourly' ? `$${job.rateAmount}/hr` : `$${job.rateAmount.toLocaleString()} flat`}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
