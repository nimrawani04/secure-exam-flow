import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { HodPageShell } from '@/components/layout/HodPageShell';
import { useHODPapers } from '@/hooks/useHODPapers';
import { FileText, Loader2, Lock, RotateCcw } from 'lucide-react';

import { EXAM_TYPE_LABELS } from '@/types';


const statusStyles: Record<string, { label: string; badge: string; tile: string; icon: typeof Lock }> = {
  locked: {
    label: 'Locked',
    icon: Lock,
    badge:
      'bg-[#ecfdf5] text-[#065f46] border-[#10b981]/25 dark:bg-[rgba(52,211,153,0.10)] dark:text-[#34d399] dark:border-[#34d399]/20',
    tile:
      'bg-[#ecfdf5] text-[#10b981] dark:bg-[rgba(52,211,153,0.12)] dark:text-[#34d399]',
  },
  resubmission_requested: {
    label: 'Resubmission',
    icon: RotateCcw,
    badge:
      'bg-[#fef8ee] text-[#92400e] border-[#f59e0b]/30 dark:bg-[rgba(251,191,36,0.10)] dark:text-[#fbbf24] dark:border-[#fbbf24]/20',
    tile:
      'bg-[#fef8ee] text-[#f59e0b] dark:bg-[rgba(251,191,36,0.12)] dark:text-[#fbbf24]',
  },
};

export default function ApprovedPapers() {
  const { papers, isLoading, error, refetch } = useHODPapers();

  const approvedPapers = papers.filter((paper) => (paper.status === 'locked' || paper.status === 'resubmission_requested') && paper.isSelected);
  const lockedCount = approvedPapers.filter((p) => p.status === 'locked').length;
  const resubCount = approvedPapers.filter((p) => p.status === 'resubmission_requested').length;

  return (
    <DashboardLayout>
      <HodPageShell
        eyebrow="HOD · Approved"
        title={<>Approved <em className="not-italic text-[#0d7a6b] dark:text-[#2dd4bf]">Papers</em></>}
        description="Selected and locked papers ready for the exam."
        actions={
          <button
            type="button"
            onClick={refetch}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-[#e8e2da] dark:border-[#1c2d3d] bg-white dark:bg-[#101820] px-4 text-[12.5px] font-medium transition-colors hover:bg-[#ede9e2] dark:hover:bg-[#131c27]"
          >
            Refresh
          </button>
        }
      >
      <div className="space-y-4">

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-[14px] border border-[#e8e2da] bg-white py-12 dark:border-[#1c2d3d] dark:bg-[#101820]">
            <Loader2 className="h-5 w-5 animate-spin text-[#0d7a6b] dark:text-[#2dd4bf]" />
            <span className="text-[13px] text-[#64748b] dark:text-[#6b8299]">Loading approved papers…</span>
          </div>
        ) : error ? (
          <div className="rounded-[14px] border border-red-200 bg-[#fef2f2] p-4 dark:border-red-900/40 dark:bg-[rgba(244,63,94,0.08)]">
            <p className="text-[13px] font-semibold text-red-700 dark:text-red-300">Failed to load approved papers</p>
            <p className="mt-1 text-[12.5px] text-red-600/80 dark:text-red-300/70">{error}</p>
          </div>
        ) : approvedPapers.length === 0 ? (
          <div className="rounded-[14px] border border-[#e8e2da] bg-white p-10 text-center dark:border-[#1c2d3d] dark:bg-[#101820]">
            <FileText className="mx-auto mb-3 h-8 w-8 text-[#a0aec0] dark:text-[#3d5166]" />
            <p className="text-[14px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">No approved papers yet</p>
            <p className="mt-1 text-[12.5px] text-[#a0aec0] dark:text-[#3d5166]">
              Papers will appear here after they are selected and locked.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-[#e8e2da] bg-white px-4 py-3 dark:border-[#1c2d3d] dark:bg-[#101820]">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a0aec0] dark:text-[#3d5166]">
                Summary
              </span>
              <span className="rounded-full border border-[#e8e2da] px-2.5 py-0.5 font-mono text-[11px] text-[#64748b] dark:border-[#1c2d3d] dark:text-[#6b8299]">
                {approvedPapers.length} total
              </span>
              <span className="rounded-full border border-[#10b981]/25 bg-[#ecfdf5] px-2.5 py-0.5 font-mono text-[11px] text-[#065f46] dark:border-[#34d399]/20 dark:bg-[rgba(52,211,153,0.10)] dark:text-[#34d399]">
                {lockedCount} locked
              </span>
              <span className="rounded-full border border-[#f59e0b]/30 bg-[#fef8ee] px-2.5 py-0.5 font-mono text-[11px] text-[#92400e] dark:border-[#fbbf24]/20 dark:bg-[rgba(251,191,36,0.10)] dark:text-[#fbbf24]">
                {resubCount} resubmission
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {approvedPapers.map((paper) => {
                const st = statusStyles[paper.status] ?? statusStyles.locked;
                const Icon = st.icon;
                return (
                  <div
                    key={paper.id}
                    className="rounded-[14px] border border-[#e8e2da] bg-white p-4 transition-all hover:border-[#0d7a6b]/40 hover:shadow-sm dark:border-[#1c2d3d] dark:bg-[#101820] dark:hover:border-[#2dd4bf]/40"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${st.tile}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[15px] font-semibold text-[#18202e] dark:text-[#e2eaf4]">
                          {paper.subjectName}
                        </h3>
                        <p className="mt-0.5 truncate font-mono text-[12px] text-[#a0aec0] dark:text-[#3d5166]">
                          {paper.subjectCode}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide ${st.badge}`}
                      >
                        {st.label}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                      <span className="rounded-full bg-[#eaf6f4] px-2.5 py-0.5 font-mono text-[11px] text-[#0d7a6b] dark:bg-[rgba(45,212,191,0.08)] dark:text-[#2dd4bf]">
                        {EXAM_TYPE_LABELS[paper.examType]}
                      </span>
                      <span className="text-[12px] text-[#64748b] dark:text-[#6b8299]">Set {paper.setName}</span>
                      <span className="font-mono text-[11px] text-[#a0aec0] dark:text-[#3d5166]">v{paper.version}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      </HodPageShell>
    </DashboardLayout>
  );
}
