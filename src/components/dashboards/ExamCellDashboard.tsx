import { useState } from 'react';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Exam } from '@/types';
import {
  Calendar,
  FileText,
  Download,
  Lock,
  Clock,
  CheckCircle,
  Archive,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock data
const mockExams: Exam[] = [
  {
    id: '1',
    subjectId: 's1',
    subjectName: 'Data Structures',
    examType: 'mid_term',
    scheduledDate: new Date('2024-03-25T09:00:00'),
    unlockTime: new Date('2024-03-25T08:30:00'),
    paperId: 'p1',
    status: 'scheduled',
  },
  {
    id: '2',
    subjectId: 's2',
    subjectName: 'Algorithms',
    examType: 'mid_term',
    scheduledDate: new Date('2024-03-26T14:00:00'),
    unlockTime: new Date('2024-03-26T13:30:00'),
    paperId: 'p2',
    status: 'scheduled',
  },
  {
    id: '3',
    subjectId: 's3',
    subjectName: 'Database Systems',
    examType: 'end_term',
    scheduledDate: new Date('2024-03-27T09:00:00'),
    unlockTime: new Date('2024-03-27T08:30:00'),
    paperId: 'p3',
    status: 'scheduled',
  },
];

const calendarDays = Array.from({ length: 35 }, (_, i) => {
  const date = new Date('2024-03-01');
  date.setDate(date.getDate() + i - date.getDay());
  return date;
});

export function ExamCellDashboard() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date('2024-03-25'));
  const [exams] = useState<Exam[]>(mockExams);

  const examDates = new Set(exams.map(e => e.scheduledDate.toDateString()));

  const getExamsForDate = (date: Date) => {
    return exams.filter(e => e.scheduledDate.toDateString() === date.toDateString());
  };

  const selectedExams = selectedDate ? getExamsForDate(selectedDate) : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Examination Cell Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Manage exam schedules and access approved papers
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Upcoming Exams"
          value={12}
          subtitle="Next 7 days"
          icon={Calendar}
          variant="accent"
        />
        <StatsCard
          title="Papers Ready"
          value={10}
          subtitle="Approved & locked"
          icon={FileText}
          variant="success"
        />
        <StatsCard
          title="Pending Papers"
          value={2}
          subtitle="Awaiting HOD approval"
          icon={Clock}
          variant="warning"
        />
        <StatsCard
          title="Archived"
          value={156}
          subtitle="Past exams"
          icon={Archive}
        />
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <div className="bg-card rounded-2xl border p-6 shadow-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
              <h2 className="text-xl font-semibold">Exam Calendar</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm">Previous</Button>
                <span className="font-medium px-4">March 2024</span>
                <Button variant="outline" size="sm">Next</Button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
              {calendarDays.map((date, index) => {
                const hasExam = examDates.has(date.toDateString());
                const isSelected = selectedDate?.toDateString() === date.toDateString();
                const isCurrentMonth = date.getMonth() === 2; // March

                return (
                  <button
                    key={index}
                    onClick={() => setSelectedDate(date)}
                    className={cn(
                      'aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all duration-200',
                      !isCurrentMonth && 'text-muted-foreground/40',
                      isSelected && 'bg-accent text-accent-foreground shadow-glow',
                      hasExam && !isSelected && 'bg-accent/20 text-accent font-medium',
                      !hasExam && !isSelected && 'hover:bg-secondary'
                    )}
                  >
                    <span>{date.getDate()}</span>
                    {hasExam && (
                      <span className={cn(
                        'w-1.5 h-1.5 rounded-full mt-1',
                        isSelected ? 'bg-accent-foreground' : 'bg-accent'
                      )} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-accent" />
                <span className="text-muted-foreground">Exam scheduled</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-success" />
                <span className="text-muted-foreground">Paper ready</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-warning" />
                <span className="text-muted-foreground">Paper pending</span>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Date Details */}
        <div className="space-y-6">
          <div className="bg-card rounded-2xl border p-6 shadow-card">
            <h3 className="text-lg font-semibold mb-4">
              {selectedDate?.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </h3>

            {selectedExams.length > 0 ? (
              <div className="space-y-4">
                {selectedExams.map((exam) => (
                  <div
                    key={exam.id}
                    className="p-4 rounded-xl border bg-secondary/50 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{exam.subjectName}</h4>
                        <p className="text-sm text-muted-foreground">
                          {exam.examType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </p>
                      </div>
                      <Badge variant="success">Ready</Badge>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {exam.scheduledDate.toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      <div className="flex items-center gap-1.5 text-accent">
                        <Lock className="w-4 h-4" />
                        Unlocks at {exam.unlockTime.toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 pt-2">
                      <Button variant="outline" size="sm" className="flex-1 gap-1.5">
                        <Eye className="w-4 h-4" />
                        Preview
                      </Button>
                      <Button variant="hero" size="sm" className="flex-1 gap-1.5" disabled>
                        <Download className="w-4 h-4" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No exams scheduled</p>
              </div>
            )}
          </div>

          {/* Emergency Actions */}
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <h4 className="font-semibold text-destructive">Emergency Actions</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Use only if paper leak is suspected
            </p>
            <Button variant="destructive" size="sm" className="w-full gap-2">
              <Lock className="w-4 h-4" />
              Emergency Re-lock Paper
            </Button>
          </div>
        </div>
      </div>

      {/* Approved Papers Inbox */}
      <div className="bg-card rounded-2xl border p-6 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h2 className="text-xl font-semibold">Approved Papers Inbox</h2>
          <Button variant="outline" className="gap-2 w-full sm:w-auto">
            <Archive className="w-4 h-4" />
            View Archive
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Subject</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Exam Type</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Department</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Exam Date</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((exam) => (
                <tr key={exam.id} className="border-b hover:bg-secondary/50 transition-colors">
                  <td className="py-4 px-4 font-medium">{exam.subjectName}</td>
                  <td className="py-4 px-4 text-muted-foreground">
                    {exam.examType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </td>
                  <td className="py-4 px-4 text-muted-foreground">Computer Science</td>
                  <td className="py-4 px-4 text-muted-foreground">
                    {exam.scheduledDate.toLocaleDateString()}
                  </td>
                  <td className="py-4 px-4">
                    <Badge variant="success">
                      <Lock className="w-3 h-3 mr-1" />
                      Locked
                    </Badge>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" disabled>
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
