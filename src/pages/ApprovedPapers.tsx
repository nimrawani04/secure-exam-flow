import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useHODPapers } from '@/hooks/useHODPapers';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2, Lock } from 'lucide-react';

const examTypeLabels: Record<string, string> = {
  mid_term: 'Mid Term',
  end_term: 'End Term',
  practical: 'Practical',
  internal: 'Internal',
};

export default function ApprovedPapers() {
  const { papers, isLoading, error, refetch } = useHODPapers();

  const approvedPapers = papers.filter((paper) => paper.status === 'locked' && paper.isSelected);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Approved Papers</h1>
            <p className="text-muted-foreground mt-1">
              Selected and locked papers ready for the exam.
            </p>
          </div>
          <button
            type="button"
            onClick={refetch}
            className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium transition-colors hover:bg-secondary"
          >
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-xl border bg-card p-6">
            <p className="text-sm font-medium text-destructive">Failed to load approved papers</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        ) : approvedPapers.length === 0 ? (
          <div className="rounded-xl border bg-card p-10 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-lg font-medium">No approved papers yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Papers will appear here after they are selected and locked.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {approvedPapers.map((paper) => (
              <div key={paper.id} className="rounded-xl border bg-card p-5 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{paper.subjectName}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{paper.subjectCode}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <span className="rounded-md bg-secondary px-2 py-0.5">
                        {examTypeLabels[paper.examType]}
                      </span>
                      <span>|</span>
                      <span>Set {paper.setName}</span>
                      <span>|</span>
                      <span>v{paper.version}</span>
                    </div>
                  </div>
                  <Badge variant="success" className="flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Locked
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
