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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject) => (
              <div key={subject.id} className="rounded-xl border bg-card p-5 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{subject.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{subject.code}</p>
                  </div>
                  <Badge variant="secondary">Semester {subject.semester}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
