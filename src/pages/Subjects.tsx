import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTeacherSubjects } from '@/hooks/useTeacherSubjects';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Loader2 } from 'lucide-react';

export default function Subjects() {
  const { subjects, isLoading, error } = useTeacherSubjects();

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Assigned Subjects</h1>
          <p className="text-muted-foreground mt-1">
            Review the subjects currently assigned to you.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-xl border bg-card p-6">
            <p className="text-sm font-medium text-destructive">Failed to load subjects</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        ) : subjects.length === 0 ? (
          <div className="rounded-xl border bg-card p-10 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-lg font-medium">No subjects assigned</p>
            <p className="text-sm text-muted-foreground mt-1">
              Contact your HOD if you should have subjects assigned.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {subjects.map((subject) => (
              <div
                key={subject.id}
                className="rounded-lg sm:rounded-xl border border-border/60 bg-card px-5 py-4 shadow-[0_1px_4px_rgba(15,23,42,0.04)] transition-all duration-200 hover:shadow-[0_6px_16px_rgba(15,23,42,0.08)] hover:border-accent/30"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <h3 className="text-[17px] font-semibold">{subject.name}</h3>
                    <p className="text-[13px] text-muted-foreground">{subject.code}</p>
                  </div>
                  <Badge className="w-fit rounded-full bg-accent/10 px-3 py-1 text-[12px] font-medium text-accent">
                    Semester {subject.semester}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
