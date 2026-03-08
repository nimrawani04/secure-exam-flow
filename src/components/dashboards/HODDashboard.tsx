import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useHODPapers } from '@/hooks/useHODPapers';
import { useHODPaperRequests, type PaperRequest } from '@/hooks/useHODPaperRequests';
import { toast } from 'sonner';
import {
  FileCheck,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Lock,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  MessageSquareWarning,
  Send,
  ArrowUpDown,
} from 'lucide-react';

export function HODDashboard() {
  const { profile, user } = useAuth();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const { papers, isLoading: isLoadingPapers, error, selectPaper } = useHODPapers();
  const { requests: paperRequests, isLoading: isLoadingRequests, acknowledgeRequest } = useHODPaperRequests();
  const [departmentName, setDepartmentName] = useState<string>('your department');
  const [sortBy, setSortBy] = useState<'deadline' | 'subject' | 'status'>('deadline');
  const [filterBy, setFilterBy] = useState<'all' | 'pending' | 'selected'>('all');
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [replacementDialog, setReplacementDialog] = useState<PaperRequest | null>(null);
  const [replacementSort, setReplacementSort] = useState<'newest' | 'version' | 'set'>('newest');
  const [sendingReplacementId, setSendingReplacementId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  const handlePreviewPaper = async (filePath: string | null, title: string) => {
    if (!filePath) {
      toast.error('No file available for this paper');
      return;
    }
    const { data, error: urlError } = await supabase.storage
      .from('exam-papers')
      .createSignedUrl(filePath, 60 * 10);
    if (urlError || !data?.signedUrl) {
      toast.error('Could not generate preview');
      return;
    }
    setPreviewTitle(title);
    setPreviewUrl(data.signedUrl);
    setPreviewOpen(true);
  };

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
      <div className="rounded-[12px] border border-border/40 bg-white/70 dark:bg-card/70 backdrop-blur-md shadow-lg">
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
      <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 backdrop-blur-sm flex flex-col sm:flex-row items-start gap-3">
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
            <div className="border rounded-lg bg-white/70 dark:bg-card/70 backdrop-blur-md p-4 text-sm text-destructive">
              {error}
            </div>
          ) : (
            <div className="border rounded-lg divide-y bg-white/70 dark:bg-card/70 backdrop-blur-md">
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Pending Papers</h2>
              <p className="text-sm text-muted-foreground">
                {papersForReview.length} {papersForReview.length === 1 ? 'paper requires' : 'papers require'} selection
              </p>
            </div>
            <Badge variant="secondary">
              {papersForReview.length} Pending
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 md:flex md:gap-6">
            <div className="space-y-1 md:w-64">
              <label htmlFor="pending-sort" className="mb-1 block text-xs font-medium text-muted-foreground">
                Sort by
              </label>
              <Select
                value={sortBy}
                onValueChange={(value) => setSortBy(value as typeof sortBy)}
              >
                <SelectTrigger id="pending-sort">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deadline">Nearest deadline</SelectItem>
                  <SelectItem value="subject">Subject</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 md:w-48">
              <label htmlFor="pending-filter" className="mb-1 block text-xs font-medium text-muted-foreground">
                Filter
              </label>
              <Select
                value={filterBy}
                onValueChange={(value) => setFilterBy(value as typeof filterBy)}
              >
                <SelectTrigger id="pending-filter">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending only</SelectItem>
                  <SelectItem value="selected">Selected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoadingPapers ? (
              <div className="border rounded-lg divide-y bg-white/70 dark:bg-card/70 backdrop-blur-md">
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
            <div className="border rounded-lg bg-white/70 dark:bg-card/70 backdrop-blur-md px-6 py-10 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <FileCheck className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold">No pending papers</h3>
              <p className="text-sm text-muted-foreground mt-1">
                You are all caught up. New submissions will appear here.
              </p>
            </div>
          ) : (
            <div className="border rounded-lg divide-y bg-white/70 dark:bg-card/70 backdrop-blur-md">
              {visiblePapers.map((paper) => (
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
                  className={`group cursor-pointer px-4 py-3 transition-all duration-150 ${
                    selectedPaperId === paper.id
                      ? 'bg-accent/10 border-l-4 border-accent'
                      : 'hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{paper.subjectName}</div>
                      <div className="text-xs text-muted-foreground">
                        Due {formatDueDate(paper.deadline)}
                      </div>
                    </div>
                    <Badge variant="pending">1</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Selection Confirmation */}
        {selectedPaperId && (
          <div className="p-3 rounded-lg bg-success/10 border border-success/20 backdrop-blur-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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

        {/* Paper Requests from Exam Cell */}
        {paperRequests.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquareWarning className="h-5 w-5 text-destructive" />
              <h2 className="text-lg font-semibold">Paper Requests from Exam Cell</h2>
              <Badge variant="destructive" className="ml-1">{paperRequests.length}</Badge>
            </div>
            <div className="space-y-3">
              {paperRequests.map((req) => {
                const urgencyStyles =
                  req.urgency === 'critical'
                    ? 'border-destructive/40 bg-destructive/5'
                    : req.urgency === 'urgent'
                    ? 'border-warning/40 bg-warning/5'
                    : 'border-border/60 bg-white/70 dark:bg-card/70';
                const urgencyBadge =
                  req.urgency === 'critical'
                    ? { label: '🚨 Critical', className: 'bg-destructive/15 text-destructive border-destructive/20' }
                    : req.urgency === 'urgent'
                    ? { label: '⚠️ Urgent', className: 'bg-warning/15 text-warning border-warning/20' }
                    : { label: 'Normal', className: 'bg-muted text-muted-foreground' };
                const examTypeLabel = req.examType.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());

                return (
                  <div
                    key={req.id}
                    className={`rounded-xl border ${urgencyStyles} backdrop-blur-md p-4 shadow-sm`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-foreground">{req.subjectName}</h3>
                          <span className="text-xs text-muted-foreground">({req.subjectCode})</span>
                          <Badge variant="outline" className={urgencyBadge.className}>
                            {urgencyBadge.label}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span>{examTypeLabel}</span>
                          <span>•</span>
                          <span>Reason: <strong className="text-foreground">{req.reason}</strong></span>
                        </div>
                        <p className="text-sm text-foreground/80 bg-muted/30 rounded-md px-3 py-2 border border-border/30">
                          {req.remarks}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Requested {req.createdAt.toLocaleDateString()} at {req.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          variant="default"
                          size="sm"
                          className="gap-2"
                          disabled={acknowledgingId === req.id}
                          onClick={async () => {
                            setAcknowledgingId(req.id);
                            const success = await acknowledgeRequest(req.id);
                            setAcknowledgingId(null);
                            if (success) {
                              setReplacementDialog(req);
                            }
                          }}
                        >
                          {acknowledgingId === req.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                          Acknowledge & Select Replacement
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Warning */}
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 backdrop-blur-sm flex items-start gap-3">
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

      {/* Replacement Paper Selection Dialog */}
      <Dialog open={!!replacementDialog} onOpenChange={(open) => !open && setReplacementDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Select Replacement Paper
            </DialogTitle>
            <DialogDescription>
              Choose an approved paper for <strong>{replacementDialog?.subjectName}</strong> ({replacementDialog?.subjectCode}) to replace the compromised paper.
            </DialogDescription>
          </DialogHeader>

          {(() => {
            if (!replacementDialog) return null;

            const coursePapers = papers
              .filter((p) => p.subjectId === replacementDialog.subjectId && (p.status === 'approved' || p.status === 'pending_review'))
              .sort((a, b) => {
                if (replacementSort === 'version') return b.version - a.version;
                if (replacementSort === 'set') return a.setName.localeCompare(b.setName);
                return b.uploadedAt.getTime() - a.uploadedAt.getTime();
              });

            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{coursePapers.length} paper{coursePapers.length !== 1 ? 's' : ''} available</p>
                  <Select value={replacementSort} onValueChange={(v) => setReplacementSort(v as typeof replacementSort)}>
                    <SelectTrigger className="w-40">
                      <ArrowUpDown className="h-3 w-3 mr-1" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest first</SelectItem>
                      <SelectItem value="version">Version (high→low)</SelectItem>
                      <SelectItem value="set">Set name (A→Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {coursePapers.length === 0 ? (
                  <div className="text-center py-8">
                    <FileCheck className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No approved papers available for this subject.</p>
                    <p className="text-xs text-muted-foreground mt-1">Teachers may need to submit new papers first.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {coursePapers.map((paper) => (
                      <div
                        key={paper.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/60 bg-card/50 hover:bg-muted/40 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{paper.anonymousId}</span>
                            <Badge variant="outline" className="text-xs">Set {paper.setName}</Badge>
                            <Badge variant={paper.status === 'approved' ? 'success' : 'pending'} className="text-xs">
                              {paper.status === 'approved' ? 'Approved' : 'Pending Review'}
                            </Badge>
                          </div>
                          <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                            <span>v{paper.version}</span>
                            <span>Uploaded {paper.uploadedAt.toLocaleDateString()}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="default"
                          className="gap-1.5 shrink-0"
                          disabled={sendingReplacementId === paper.id}
                          onClick={async () => {
                            setSendingReplacementId(paper.id);
                            const success = await selectPaper(
                              paper.id,
                              paper.subjectId,
                              paper.examType,
                              `Replacement for paper request: ${replacementDialog.reason}`
                            );
                            setSendingReplacementId(null);
                            if (success) {
                              setReplacementDialog(null);
                            }
                          }}
                        >
                          {sendingReplacementId === paper.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Lock className="h-3.5 w-3.5" />
                          )}
                          Select & Lock
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

