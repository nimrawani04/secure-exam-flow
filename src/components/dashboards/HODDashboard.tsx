import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { PaperCard } from '@/components/dashboard/PaperCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExamPaper } from '@/types';
import {
  FileCheck,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Lock,
  AlertTriangle,
} from 'lucide-react';

interface Department {
  name: string;
}

// Mock data - papers shown anonymously
const mockPapersForReview: ExamPaper[] = [
  {
    id: '1',
    subjectId: 's1',
    subjectName: 'Data Structures',
    examType: 'mid_term',
    setName: 'A',
    status: 'pending_review',
    uploadedBy: 'hidden',
    uploadedAt: new Date('2024-03-10'),
    deadline: new Date('2024-03-20'),
    department: 'Computer Science',
    version: 1,
  },
  {
    id: '2',
    subjectId: 's1',
    subjectName: 'Data Structures',
    examType: 'mid_term',
    setName: 'B',
    status: 'pending_review',
    uploadedBy: 'hidden',
    uploadedAt: new Date('2024-03-11'),
    deadline: new Date('2024-03-20'),
    department: 'Computer Science',
    version: 1,
  },
  {
    id: '3',
    subjectId: 's1',
    subjectName: 'Data Structures',
    examType: 'mid_term',
    setName: 'C',
    status: 'pending_review',
    uploadedBy: 'hidden',
    uploadedAt: new Date('2024-03-12'),
    deadline: new Date('2024-03-20'),
    department: 'Computer Science',
    version: 1,
  },
];

const subjectsNeedingReview = [
  { id: 's1', name: 'Data Structures', papersCount: 3, deadline: new Date('2024-03-20') },
  { id: 's2', name: 'Algorithms', papersCount: 2, deadline: new Date('2024-03-22') },
  { id: 's3', name: 'Database Systems', papersCount: 1, deadline: new Date('2024-03-25') },
];

export function HODDashboard() {
  const { profile } = useAuth();
  const [selectedSubject, setSelectedSubject] = useState<string | null>('s1');
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [papers] = useState<ExamPaper[]>(mockPapersForReview);
  const [departmentName, setDepartmentName] = useState<string>('your department');

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

  const handleSelectPaper = (paperId: string) => {
    setSelectedPaperId(selectedPaperId === paperId ? null : paperId);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">HOD Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Review and select exam papers for {departmentName}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Pending Review"
          value={6}
          subtitle="Papers awaiting selection"
          icon={Clock}
          variant="warning"
        />
        <StatsCard
          title="Selected Today"
          value={2}
          icon={CheckCircle}
          variant="success"
        />
        <StatsCard
          title="Rejected"
          value={1}
          icon={XCircle}
          variant="destructive"
        />
        <StatsCard
          title="Locked Papers"
          value={5}
          subtitle="Ready for exam"
          icon={Lock}
          variant="accent"
        />
      </div>

      {/* Anonymous Review Notice */}
      <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 flex flex-col sm:flex-row items-start gap-4">
        <div className="w-10 h-10 rounded-lg gradient-accent flex items-center justify-center flex-shrink-0">
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
      <div className="grid lg:grid-cols-4 gap-8">
        {/* Subjects List */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold">Subjects to Review</h2>
          <div className="space-y-2">
            {subjectsNeedingReview.map((subject) => (
              <button
                key={subject.id}
                onClick={() => setSelectedSubject(subject.id)}
                className={`w-full p-4 rounded-xl border text-left transition-all duration-200 ${
                  selectedSubject === subject.id
                    ? 'border-accent bg-accent/10 shadow-glow'
                    : 'border-border bg-card hover:border-accent/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{subject.name}</span>
                  <Badge variant="pending">{subject.papersCount}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Due: {subject.deadline.toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Papers Comparison */}
        <div className="lg:col-span-3 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold">
              Compare Papers: Data Structures
            </h2>
            <div className="flex items-center gap-3">
              <Button
                variant="success"
                disabled={!selectedPaperId}
                className="gap-2 w-full sm:w-auto"
              >
                <CheckCircle className="w-4 h-4" />
                Approve & Lock Selected
              </Button>
            </div>
          </div>

          {/* Papers Grid */}
          <div className="grid md:grid-cols-3 gap-4">
            {papers.map((paper, index) => (
              <PaperCard
                key={paper.id}
                paper={paper}
                isAnonymous
                anonymousLabel={`Paper ${index + 1}`}
                showActions
                onView={() => console.log('View paper', paper.id)}
                onSelect={() => handleSelectPaper(paper.id)}
                isSelected={selectedPaperId === paper.id}
              />
            ))}
          </div>

          {/* Selection Confirmation */}
          {selectedPaperId && (
            <div className="p-4 rounded-xl bg-success/10 border border-success/20 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-success" />
                <span className="font-medium">
                  Paper {papers.findIndex(p => p.id === selectedPaperId) + 1} selected for approval
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Click "Approve & Lock" to finalize selection
              </p>
            </div>
          )}

          {/* Warning */}
          <div className="p-4 rounded-xl bg-warning/10 border border-warning/20 flex items-start gap-3">
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
      </div>
    </div>
  );
}
