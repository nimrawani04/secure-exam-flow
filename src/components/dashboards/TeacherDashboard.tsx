import { useAuth } from '@/contexts/AuthContext';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { PaperCard } from '@/components/dashboard/PaperCard';
import { DeadlineTimer } from '@/components/dashboard/DeadlineTimer';
import { Button } from '@/components/ui/button';
import { useTeacherPapers } from '@/hooks/useTeacherPapers';
import type { ExamPaper } from '@/types';
import {
  FileText,
  Upload,
  CheckCircle,
  Clock,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function TeacherDashboard() {
  const { profile } = useAuth();
  const { papers, isLoading, error } = useTeacherPapers();

  const stats = {
    total: papers.length,
    approved: papers.filter(p => p.status === 'approved').length,
    pending: papers.filter(p => p.status === 'pending_review').length,
    rejected: papers.filter(p => p.status === 'rejected').length,
  };

  const firstName = profile?.full_name?.split(' ')[0] || 'Teacher';
  const now = new Date();
  const upcoming = papers
    .map((paper) => ({
      deadline: paper.deadline,
      label: `${paper.subjectName} - ${paper.examType.replace('_', ' ')}`,
    }))
    .filter((item) => item.deadline.getTime() > now.getTime())
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())[0];

  const displayPapers: ExamPaper[] = papers.map((paper) => ({
    id: paper.id,
    subjectId: paper.subjectId,
    subjectName: paper.subjectName,
    examType: paper.examType,
    setName: paper.setName,
    status: paper.status,
    uploadedBy: paper.uploadedBy,
    uploadedAt: paper.uploadedAt,
    deadline: paper.deadline,
    department: paper.department,
    version: paper.version,
    feedback: paper.feedback ?? undefined,
    approvedAt: paper.approvedAt ?? undefined,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Welcome back, {firstName}</h1>
          <p className="text-muted-foreground mt-1">
            Manage your exam papers and track submission status
          </p>
        </div>
        <Link to="/upload">
          <Button variant="hero" size="lg" className="gap-2 w-full sm:w-auto">
            <Plus className="w-5 h-5" />
            Upload Paper
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Submissions"
          value={stats.total}
          subtitle="This semester"
          icon={FileText}
        />
        <StatsCard
          title="Approved"
          value={stats.approved}
          icon={CheckCircle}
          variant="success"
        />
        <StatsCard
          title="Pending Review"
          value={stats.pending}
          icon={Clock}
          variant="warning"
        />
        <StatsCard
          title="Needs Revision"
          value={stats.rejected}
          icon={AlertCircle}
          variant="destructive"
        />
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Papers List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold">Recent Submissions</h2>
            <Link to="/submissions" className="text-sm text-accent hover:underline">
              View all
            </Link>
          </div>

          {isLoading ? (
            <div className="rounded-xl border border-border/60 p-6 text-sm text-muted-foreground">
              Loading your submissions...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
              {error}
            </div>
          ) : papers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 p-8 text-center">
              <p className="text-lg font-medium">No submissions yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload your first paper to start the review process.
              </p>
              <Link to="/upload" className="inline-block mt-4">
                <Button variant="hero" size="lg" className="gap-2">
                  <Plus className="w-5 h-5" />
                  Upload Paper
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {displayPapers.map((paper) => (
                <PaperCard key={paper.id} paper={paper} />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Deadline */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Next Deadline</h3>
            {upcoming ? (
              <DeadlineTimer deadline={upcoming.deadline} label={upcoming.label} />
            ) : (
              <div className="rounded-xl border border-border/60 p-6 text-sm text-muted-foreground">
                No upcoming deadlines yet.
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link to="/upload" className="block">
                <Button variant="outline" className="w-full justify-start gap-3 h-12">
                  <Upload className="w-5 h-5 text-accent" />
                  Upload New Paper
                </Button>
              </Link>
              <Link to="/submissions" className="block">
                <Button variant="outline" className="w-full justify-start gap-3 h-12">
                  <FileText className="w-5 h-5 text-accent" />
                  View All Submissions
                </Button>
              </Link>
              <Link to="/subjects" className="block">
                <Button variant="outline" className="w-full justify-start gap-3 h-12">
                  <Clock className="w-5 h-5 text-accent" />
                  Check Deadlines
                </Button>
              </Link>
            </div>
          </div>

          {/* Tips */}
          <div className="p-4 rounded-xl bg-accent/10 border border-accent/20">
            <h4 className="font-semibold text-accent mb-2">Pro Tip</h4>
            <p className="text-sm text-muted-foreground">
              Upload multiple paper sets (A, B, C) to give HOD more options for selection. 
              Only PDFs are accepted to ensure document integrity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
