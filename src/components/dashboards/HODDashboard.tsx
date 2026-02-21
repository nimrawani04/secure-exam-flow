import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useHODPapers } from '@/hooks/useHODPapers';
import {
  FileCheck,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Lock,
  AlertTriangle,
} from 'lucide-react';

export function HODDashboard() {
  const { profile } = useAuth();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const { papers, isLoading: isLoadingPapers, error } = useHODPapers();
  const [departmentName, setDepartmentName] = useState<string>('your department');
  const [sortBy, setSortBy] = useState<'deadline' | 'subject' | 'status'>('deadline');
  const [filterBy, setFilterBy] = useState<'all' | 'pending' | 'selected'>('all');

  useEffect(() => {
    const fetchDepartment = async () => {
      if (profile?.department_id) {
        const { data } = await supabase
          .from('departments')
          .select('name')
          .eq('id', profile.department_id)
          .single();
        
        if (data) {
          setDepartmentName(data.name);
        }
      }
    };
    fetchDepartment();
  }, [profile?.department_id]);

  const papersForReview = useMemo(
    () => papers.filter((paper) => paper.status === 'pending_review'),
    [papers]
  );

  const subjectsNeedingReview = useMemo(() => {
    const subjectMap = new Map<string, { id: string; name: string; papersCount: number; deadline: Date }>();
    papersForReview.forEach((paper) => {
      const existing = subjectMap.get(paper.subjectId);
      if (!existing) {
        subjectMap.set(paper.subjectId, {
          id: paper.subjectId,
          name: paper.subjectName,
          papersCount: 1,
          deadline: paper.deadline,
        });
      } else {
        existing.papersCount += 1;
        if (paper.deadline.getTime() < existing.deadline.getTime()) {
          existing.deadline = paper.deadline;
        }
      }
    });
    return Array.from(subjectMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [papersForReview]);

  useEffect(() => {
    if (selectedSubject) return;
    if (subjectsNeedingReview.length > 0) {
      setSelectedSubject(subjectsNeedingReview[0].id);
    }
  }, [selectedSubject, subjectsNeedingReview]);

  const handleSelectPaper = (paperId: string) => {
    setSelectedPaperId(selectedPaperId === paperId ? null : paperId);
  };

  const isNearDeadline = (date: Date) => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays <= 3;
  };

  const formatDueDate = (date: Date) =>
    date.toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const getPaperStatus = (paper: (typeof papersForReview)[number]) => {
    const now = Date.now();
    const deadline = paper.deadline.getTime();
    if (paper.status === 'approved') {
      return { label: 'Reviewed', className: 'bg-emerald-100 text-emerald-700' };
    }
    if (paper.status === 'rejected') {
      return { label: 'Submitted', className: 'bg-sky-100 text-sky-700' };
    }
    if (deadline < now) {
      return { label: 'Overdue', className: 'bg-rose-100 text-rose-700' };
    }
    return { label: 'Upcoming', className: 'bg-amber-100 text-amber-700' };
  };

  const visiblePapers = papersForReview
    .filter((paper) => (selectedSubject ? paper.subjectId === selectedSubject : true))
    .filter((paper) => {
      if (filterBy === 'pending') return paper.status === 'pending_review';
      if (filterBy === 'selected') return paper.id === selectedPaperId;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'subject') return a.subjectName.localeCompare(b.subjectName);
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      return a.deadline.getTime() - b.deadline.getTime();
    });

  const handleRowClick = (paperId: string) => {
    handleSelectPaper(paperId);
    console.log('Navigate to review page for paper', paperId);
  };

  const pendingReviewCount = papers.filter((paper) => paper.status === 'pending_review').length;
  const approvedCount = papers.filter((paper) => paper.status === 'approved').length;
  const rejectedCount = papers.filter((paper) => paper.status === 'rejected').length;
  const lockedCount = papers.filter((paper) => paper.status === 'locked').length;
  const selectedPaper = papersForReview.find((paper) => paper.id === selectedPaperId);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">HOD Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Review and select exam papers for {departmentName}
        </p>
      </div>

      {/* Stats */}
      <div className="rounded-[12px] border border-border/40 bg-card">
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-border/40 sm:border-r sm:px-5 sm:py-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-warning/10 flex items-center justify-center sm:h-10 sm:w-10">
                <Clock className="h-4 w-4 text-warning sm:h-5 sm:w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Pending Review</p>
                <p className="text-xs text-muted-foreground mt-1">Papers awaiting selection</p>
              </div>
            </div>
            <p className="text-[28px] font-semibold leading-none">{pendingReviewCount}</p>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-border/40 sm:border-b sm:border-r-0 sm:px-5 sm:py-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center sm:h-10 sm:w-10">
                <CheckCircle className="h-4 w-4 text-success sm:h-5 sm:w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Selected Today</p>
              </div>
            </div>
            <p className="text-[28px] font-semibold leading-none">{approvedCount}</p>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-border/40 sm:border-b-0 sm:border-r sm:px-5 sm:py-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center sm:h-10 sm:w-10">
                <XCircle className="h-4 w-4 text-destructive sm:h-5 sm:w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Rejected</p>
              </div>
            </div>
            <p className="text-[28px] font-semibold leading-none">{rejectedCount}</p>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5 sm:py-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center sm:h-10 sm:w-10">
                <Lock className="h-4 w-4 text-accent sm:h-5 sm:w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Locked Papers</p>
                <p className="text-xs text-muted-foreground mt-1">Ready for exam</p>
              </div>
            </div>
            <p className="text-[28px] font-semibold leading-none">{lockedCount}</p>
          </div>
        </div>
      </div>

      {/* Anonymous Review Notice */}
      <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 flex flex-col sm:flex-row items-start gap-3">
        <div className="w-9 h-9 rounded-md gradient-accent flex items-center justify-center flex-shrink-0">
          <Eye className="w-5 h-5 text-accent-foreground" />
        </div>
        <div>
          <h4 className="font-semibold text-accent">Anonymous Review Mode</h4>
          <p className="text-sm text-muted-foreground mt-1">
            Teacher names are hidden to ensure unbiased paper selection. 
            You're seeing papers labeled as "Paper 1", "Paper 2", etc.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-8">
        {/* Subjects List */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Subjects to Review</h2>
              <p className="text-sm text-muted-foreground">
                {subjectsNeedingReview.length} subjects require selection
              </p>
            </div>
            <Badge variant="secondary">{subjectsNeedingReview.length} Total</Badge>
          </div>
          {error ? (
            <div className="border rounded-lg bg-card p-4 text-sm text-destructive">
              {error}
            </div>
          ) : (
            <div className="border rounded-lg divide-y bg-card">
              {subjectsNeedingReview.length > 0 ? (
                subjectsNeedingReview.map((subject) => (
                  <button
                    key={subject.id}
                    onClick={() => setSelectedSubject(subject.id)}
                    className={`w-full px-4 py-3 text-left transition-all duration-150 ${
                      selectedSubject === subject.id
                        ? 'bg-accent/10 border-l-4 border-accent'
                        : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{subject.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Due {subject.deadline.toLocaleDateString()}
                        </div>
                      </div>
                      <Badge variant="pending">{subject.papersCount}</Badge>
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-4 py-6 text-sm text-muted-foreground">
                  No subjects pending review.
                </div>
              )}
            </div>
          )}
        </section>

        {/* Pending Papers */}
        <section className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Pending Papers</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {papersForReview.length} {papersForReview.length === 1 ? 'paper requires' : 'papers require'} selection
              </p>
            </div>
            <Badge variant="secondary" className="text-sm">
              {papersForReview.length} Pending
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="pending-sort" className="mb-1 block text-xs font-medium text-muted-foreground">
                Sort by
              </label>
              <select
                id="pending-sort"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                className="h-10 w-full rounded-xl border border-border/70 bg-muted/30 px-3 text-sm outline-none focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                <option value="deadline">Nearest deadline</option>
                <option value="subject">Subject</option>
                <option value="status">Status</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="pending-filter" className="mb-1 block text-xs font-medium text-muted-foreground">
                Filter
              </label>
              <select
                id="pending-filter"
                value={filterBy}
                onChange={(event) => setFilterBy(event.target.value as typeof filterBy)}
                className="h-10 w-full rounded-xl border border-border/70 bg-muted/30 px-3 text-sm outline-none focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                <option value="all">All</option>
                <option value="pending">Pending only</option>
                <option value="selected">Selected</option>
              </select>
            </div>
          </div>

          {isLoadingPapers ? (
              <div className="border rounded-lg divide-y bg-card">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`skeleton-${index}`} className="px-4 py-3 animate-pulse">
                    <div className="flex flex-col gap-3 sm:grid sm:grid-cols-[40px_1.6fr_1fr_auto_auto] sm:gap-4 sm:items-center">
                      <div className="h-10 w-10 rounded-md bg-muted" />
                      <div className="space-y-2">
                        <div className="h-3 w-40 rounded bg-muted" />
                        <div className="h-2 w-56 rounded bg-muted" />
                      </div>
                    <div className="space-y-2">
                      <div className="h-3 w-24 rounded bg-muted" />
                      <div className="h-2 w-20 rounded bg-muted" />
                    </div>
                    <div className="h-6 w-20 rounded bg-muted" />
                    <div className="h-8 w-20 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : visiblePapers.length === 0 ? (
            <div className="border rounded-lg bg-card px-6 py-10 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <FileCheck className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold">No pending papers</h3>
              <p className="text-sm text-muted-foreground mt-1">
                You are all caught up. New submissions will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visiblePapers.map((paper) => {
                const statusInfo = getPaperStatus(paper);
                return (
                  <div
                    key={paper.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleRowClick(paper.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleRowClick(paper.id);
                      }
                    }}
                    className={`group cursor-pointer rounded-xl border border-border/70 bg-muted/30 p-4 transition-all duration-150 ${
                      selectedPaperId === paper.id
                        ? 'border-accent/40 bg-accent/10'
                        : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-medium text-foreground sm:text-base">{paper.subjectName}</h3>
                          <p className="mt-1 text-xs text-muted-foreground">Due {formatDueDate(paper.deadline)}</p>
                        </div>
                        <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium sm:text-xs ${statusInfo.className}`}>
                          {statusInfo.label}
                        </span>
                      </div>

                      <div className="w-full">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-10 w-full rounded-lg px-4 text-sm font-medium transition active:scale-95 sm:h-9 sm:w-auto"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRowClick(paper.id);
                          }}
                        >
                          <FileCheck className="h-4 w-4" />
                          Review
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Selection Confirmation */}
        {selectedPaperId && (
          <div className="p-3 rounded-lg bg-success/10 border border-success/20 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-success" />
              <span className="font-medium">
                {selectedPaper?.anonymousId || 'Selected paper'} ready to approve
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="success"
                className="gap-2 w-full sm:w-auto"
              >
                <CheckCircle className="w-4 h-4" />
                Approve & Lock
              </Button>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setSelectedPaperId(null)}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Warning */}
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-warning">Important</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Once a paper is approved and locked, it cannot be changed.
              The paper will be forwarded to Examination Cell and other submissions will be automatically rejected.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

