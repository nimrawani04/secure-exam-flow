import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { PaperCard } from '@/components/dashboard/PaperCard';
import { DeadlineTimer } from '@/components/dashboard/DeadlineTimer';
import { Button } from '@/components/ui/button';
import { ExamPaper } from '@/types';
import {
  FileText,
  Upload,
  CheckCircle,
  Clock,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';

// Mock data
const mockPapers: ExamPaper[] = [
  {
    id: '1',
    subjectId: 's1',
    subjectName: 'Data Structures',
    examType: 'mid_term',
    setName: 'A',
    status: 'approved',
    uploadedBy: '1',
    uploadedAt: new Date('2024-03-10'),
    deadline: new Date('2024-03-20'),
    department: 'Computer Science',
    version: 2,
    approvedAt: new Date('2024-03-15'),
  },
  {
    id: '2',
    subjectId: 's2',
    subjectName: 'Algorithms',
    examType: 'end_term',
    setName: 'A',
    status: 'pending_review',
    uploadedBy: '1',
    uploadedAt: new Date('2024-03-12'),
    deadline: new Date('2024-03-25'),
    department: 'Computer Science',
    version: 1,
  },
  {
    id: '3',
    subjectId: 's3',
    subjectName: 'Database Systems',
    examType: 'mid_term',
    setName: 'B',
    status: 'rejected',
    uploadedBy: '1',
    uploadedAt: new Date('2024-03-08'),
    deadline: new Date('2024-03-22'),
    department: 'Computer Science',
    version: 1,
    feedback: 'Please include more practical questions and reduce the number of theoretical questions.',
  },
];

const upcomingDeadline = new Date();
upcomingDeadline.setDate(upcomingDeadline.getDate() + 2);
upcomingDeadline.setHours(23, 59, 59);

export function TeacherDashboard() {
  const { profile } = useAuth();
  const [papers] = useState<ExamPaper[]>(mockPapers);

  const stats = {
    total: papers.length,
    approved: papers.filter(p => p.status === 'approved').length,
    pending: papers.filter(p => p.status === 'pending_review').length,
    rejected: papers.filter(p => p.status === 'rejected').length,
  };

  const firstName = profile?.full_name?.split(' ')[0] || 'Teacher';

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

          <div className="space-y-4">
            {papers.map((paper) => (
              <PaperCard key={paper.id} paper={paper} />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Deadline */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Next Deadline</h3>
            <DeadlineTimer deadline={upcomingDeadline} label="Database Systems - End Term" />
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
