import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTeacherSubjects } from '@/hooks/useTeacherSubjects';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BookOpen, Loader2 } from 'lucide-react';

type SortOrder = 'asc' | 'desc';

const SEMESTER_OPTIONS = [1, 2, 3, 4, 5, 6];

export default function Subjects() {
  const { subjects, isLoading, error } = useTeacherSubjects();
  const [selectedSemester, setSelectedSemester] = useState<number | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const filteredAndSortedSubjects = useMemo(() => {
    const filtered =
      selectedSemester === 'all'
        ? subjects
        : subjects.filter((subject) => subject.semester === selectedSemester);

    return [...filtered].sort((a, b) => {
      if (sortOrder === 'asc') {
        if (a.semester !== b.semester) return a.semester - b.semester;
      } else {
        if (a.semester !== b.semester) return b.semester - a.semester;
      }
      return a.name.localeCompare(b.name);
    });
  }, [subjects, selectedSemester, sortOrder]);

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
          <>
            <div className="space-y-3">
              <div className="md:hidden sticky top-0 z-10 -mx-4 border-y bg-background/95 px-4 py-3 backdrop-blur">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setSelectedSemester('all')}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      selectedSemester === 'all'
                        ? 'border-accent/40 bg-accent/10 text-accent'
                        : 'border-border/60 bg-background text-muted-foreground'
                    }`}
                  >
                    All
                  </button>
                  {SEMESTER_OPTIONS.map((semester) => (
                    <button
                      key={semester}
                      type="button"
                      onClick={() => setSelectedSemester(semester)}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        selectedSemester === semester
                          ? 'border-accent/40 bg-accent/10 text-accent'
                          : 'border-border/60 bg-background text-muted-foreground'
                      }`}
                    >
                      Sem {semester}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSortOrder('desc')}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      sortOrder === 'desc'
                        ? 'border-accent/40 bg-accent/10 text-accent'
                        : 'border-border/60 bg-background text-muted-foreground'
                    }`}
                  >
                    Newest First
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortOrder('asc')}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      sortOrder === 'asc'
                        ? 'border-accent/40 bg-accent/10 text-accent'
                        : 'border-border/60 bg-background text-muted-foreground'
                    }`}
                  >
                    Oldest First
                  </button>
                </div>
              </div>

              <div className="hidden md:flex items-center gap-3">
                <Select
                  value={selectedSemester === 'all' ? 'all' : String(selectedSemester)}
                  onValueChange={(value) =>
                    setSelectedSemester(value === 'all' ? 'all' : Number(value))
                  }
                >
                  <SelectTrigger className="w-[190px]">
                    <SelectValue placeholder="Filter by semester" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Semesters</SelectItem>
                    {SEMESTER_OPTIONS.map((semester) => (
                      <SelectItem key={semester} value={String(semester)}>
                        Semester {semester}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={sortOrder}
                  onValueChange={(value) => setSortOrder(value as SortOrder)}
                >
                  <SelectTrigger className="w-[190px]">
                    <SelectValue placeholder="Sort order" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Semester Descending</SelectItem>
                    <SelectItem value="asc">Semester Ascending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filteredAndSortedSubjects.length === 0 ? (
              <div className="rounded-xl border bg-card p-8 text-center">
                <p className="text-sm font-medium">No subjects found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try changing the semester filter.
                </p>
              </div>
            ) : (
              <>
                <div className="md:hidden divide-y divide-border/60 rounded-lg border border-border/60 bg-card px-4">
                  {filteredAndSortedSubjects.map((subject) => (
                    <div
                      key={subject.id}
                      className="py-4 transition-colors active:bg-muted/30"
                    >
                      <h3 className="text-base font-semibold leading-tight">{subject.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {subject.code}
                        <span className="mx-2">&bull;</span>
                        Semester {subject.semester}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="hidden gap-4 md:grid md:grid-cols-2">
                  {filteredAndSortedSubjects.map((subject) => (
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
              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

