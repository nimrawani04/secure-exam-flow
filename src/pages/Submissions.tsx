import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTeacherPapers, TeacherPaper } from '@/hooks/useTeacherPapers';
import { 
  FileText, 
  Clock, 
  AlertCircle,
  Upload,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const examTypeLabels: Record<string, string> = {
  mid_term: 'Mid Term',
  end_term: 'End Term',
  practical: 'Practical',
  internal: 'Internal',
};

function PaperRow({ paper }: { paper: TeacherPaper }) {
  return (
    <div className="group rounded-xl border border-border/60 bg-card px-5 py-4 shadow-[0_1px_6px_rgba(15,23,42,0.06)] transition-all duration-200 hover:shadow-[0_6px_18px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-[10px] bg-secondary/80 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-[17px]">{paper.subjectName}</h3>
            <p className="text-[13px] text-muted-foreground">{paper.subjectCode}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-6 items-center rounded-full bg-accent/10 px-3 text-xs font-medium text-accent">
              {examTypeLabels[paper.examType]}
            </span>
            <span className="inline-flex h-6 items-center rounded-full bg-primary/10 px-3 text-xs font-medium text-primary">
              v{paper.version}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
            <Clock className="h-3.5 w-3.5" />
            <span>
              Uploaded{' '}
              {paper.uploadedAt.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Submissions() {
  const { papers, isLoading, error, refetch } = useTeacherPapers();
  const [activeTab, setActiveTab] = useState('all');

  const filteredPapers = papers.filter((paper) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return paper.status === 'pending_review';
    return true;
  });

  const stats = {
    total: papers.length,
    pending: papers.filter((p) => p.status === 'pending_review').length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Submissions</h1>
            <p className="text-muted-foreground mt-1">
              Track your paper submissions and review status
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <Button variant="outline" size="sm" onClick={refetch} className="w-full gap-1.5 sm:w-auto">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Link to="/upload" className="w-full sm:w-auto">
              <Button variant="hero" className="w-full gap-2 sm:w-auto">
                <Upload className="h-4 w-4" />
                Upload Paper
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="rounded-[12px] border border-border/40 bg-card">
          <div className="flex flex-col divide-y divide-border/40 sm:flex-row sm:divide-y-0 sm:divide-x">
            <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:flex-1 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center sm:h-10 sm:w-10">
                  <FileText className="h-4 w-4 text-accent sm:h-5 sm:w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Total Submissions</p>
                  <p className="text-xs text-muted-foreground mt-1">This semester</p>
                </div>
              </div>
              <p className="text-[28px] font-semibold leading-none">{stats.total}</p>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:flex-1 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-warning/10 flex items-center justify-center sm:h-10 sm:w-10">
                  <Clock className="h-4 w-4 text-warning sm:h-5 sm:w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Pending Review</p>
                </div>
              </div>
              <p className="text-[28px] font-semibold leading-none">{stats.pending}</p>
            </div>
          </div>
        </div>

        {/* Tabs & List */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full rounded-full bg-secondary/70 p-1 grid grid-cols-2 gap-1 sm:inline-grid sm:w-auto">
            <TabsTrigger
              value="all"
              className="w-full rounded-full text-sm data-[state=active]:bg-accent/10 data-[state=active]:text-accent data-[state=active]:shadow-none"
            >
              All ({stats.total})
            </TabsTrigger>
            <TabsTrigger
              value="pending"
              className="w-full rounded-full text-sm data-[state=active]:bg-accent/10 data-[state=active]:text-accent data-[state=active]:shadow-none"
            >
              Pending ({stats.pending})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <p className="text-lg font-medium">Failed to load submissions</p>
                <p className="text-muted-foreground mt-1">{error}</p>
                <Button variant="outline" onClick={refetch} className="mt-4">
                  Try Again
                </Button>
              </div>
            ) : filteredPapers.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">
                  {activeTab === 'pending' ? 'No pending submissions' : 'No submissions found'}
                </p>
                <p className="text-muted-foreground mt-1">
                  {activeTab === 'all'
                    ? "You haven't uploaded any papers yet."
                    : 'No pending papers found.'}
                </p>
                {stats.total === 0 && (
                  <Link to="/upload">
                    <Button variant="hero" className="mt-4 gap-2">
                      <Upload className="h-4 w-4" />
                      Upload Your First Paper
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPapers.map((paper) => (
                  <PaperRow key={paper.id} paper={paper} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
