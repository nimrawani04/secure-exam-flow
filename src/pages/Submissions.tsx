import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTeacherPapers, TeacherPaper } from '@/hooks/useTeacherPapers';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Upload,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type PaperStatus = Database['public']['Enums']['paper_status'];

const statusConfig: Record<PaperStatus, { 
  label: string; 
  variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';
  icon: typeof CheckCircle;
}> = {
  draft: { label: 'Draft', variant: 'secondary', icon: FileText },
  submitted: { label: 'Submitted', variant: 'outline', icon: Upload },
  pending_review: { label: 'Pending Review', variant: 'warning', icon: Clock },
  approved: { label: 'Approved', variant: 'success', icon: CheckCircle },
  rejected: { label: 'Needs Revision', variant: 'destructive', icon: XCircle },
  locked: { label: 'Locked', variant: 'default', icon: CheckCircle },
};

const examTypeLabels: Record<string, string> = {
  mid_term: 'Mid Term',
  end_term: 'End Term',
  practical: 'Practical',
  internal: 'Internal',
};

function PaperRow({ paper }: { paper: TeacherPaper }) {
  const config = statusConfig[paper.status];
  const StatusIcon = config.icon;

  return (
    <div className="group rounded-xl border bg-card p-5 shadow-card transition-all duration-200 hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div className="rounded-lg bg-secondary p-3">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-lg">{paper.subjectName}</h3>
              <span className="text-sm text-muted-foreground">({paper.subjectCode})</span>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="px-2 py-0.5 bg-secondary rounded-md text-sm">
                {examTypeLabels[paper.examType]}
              </span>
              <span className="text-sm text-muted-foreground">|</span>
              <span className="text-sm text-muted-foreground">Set {paper.setName}</span>
              <span className="text-sm text-muted-foreground">|</span>
              <span className="text-sm text-muted-foreground">v{paper.version}</span>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>Uploaded {paper.uploadedAt.toLocaleDateString()}</span>
              </div>
              {paper.approvedAt && (
                <div className="flex items-center gap-1.5 text-success">
                  <CheckCircle className="h-4 w-4" />
                  <span>Approved {paper.approvedAt.toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <Badge variant={config.variant as any} className="flex items-center gap-1.5">
          <StatusIcon className="h-3.5 w-3.5" />
          {config.label}
        </Badge>
      </div>

      {paper.feedback && paper.status === 'rejected' && (
        <div className="mt-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Revision Required</p>
              <p className="text-sm text-destructive/80 mt-1">{paper.feedback}</p>
            </div>
          </div>
          <Link to="/upload" className="mt-3 inline-block">
            <Button variant="outline" size="sm" className="gap-1.5">
              <RefreshCw className="h-4 w-4" />
              Upload Revised Version
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

export default function Submissions() {
  const { papers, isLoading, error, refetch } = useTeacherPapers();
  const [activeTab, setActiveTab] = useState('all');

  const filteredPapers = papers.filter((paper) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return paper.status === 'pending_review';
    if (activeTab === 'approved') return paper.status === 'approved' || paper.status === 'locked';
    if (activeTab === 'rejected') return paper.status === 'rejected';
    return true;
  });

  const stats = {
    total: papers.length,
    pending: papers.filter((p) => p.status === 'pending_review').length,
    approved: papers.filter((p) => p.status === 'approved' || p.status === 'locked').length,
    rejected: papers.filter((p) => p.status === 'rejected').length,
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Total Submissions</p>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </div>
          <div className="bg-card rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Pending Review</p>
            <p className="text-2xl font-bold mt-1 text-warning">{stats.pending}</p>
          </div>
          <div className="bg-card rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Approved</p>
            <p className="text-2xl font-bold mt-1 text-success">{stats.approved}</p>
          </div>
          <div className="bg-card rounded-xl border p-4">
            <p className="text-sm text-muted-foreground">Needs Revision</p>
            <p className="text-2xl font-bold mt-1 text-destructive">{stats.rejected}</p>
          </div>
        </div>

        {/* Tabs & List */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start gap-1 overflow-x-auto sm:overflow-visible sm:grid sm:grid-cols-4 sm:gap-2">
            <TabsTrigger value="all" className="w-full">All ({stats.total})</TabsTrigger>
            <TabsTrigger value="pending" className="w-full">Pending ({stats.pending})</TabsTrigger>
            <TabsTrigger value="approved" className="w-full">Approved ({stats.approved})</TabsTrigger>
            <TabsTrigger value="rejected" className="w-full">Rejected ({stats.rejected})</TabsTrigger>
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
                <p className="text-lg font-medium">No submissions found</p>
                <p className="text-muted-foreground mt-1">
                  {activeTab === 'all' 
                    ? "You haven't uploaded any papers yet." 
                    : `No ${activeTab} papers found.`}
                </p>
                <Link to="/upload">
                  <Button variant="hero" className="mt-4 gap-2">
                    <Upload className="h-4 w-4" />
                    Upload Your First Paper
                  </Button>
                </Link>
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
