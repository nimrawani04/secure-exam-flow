export type UserRole = 'teacher' | 'hod' | 'exam_cell';

export type PaperStatus = 'draft' | 'submitted' | 'pending_review' | 'approved' | 'rejected' | 'locked';

export type ExamType = 'mid_term' | 'end_term' | 'practical' | 'internal';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  subjects?: string[];
}

export interface ExamPaper {
  id: string;
  subjectId: string;
  subjectName: string;
  examType: ExamType;
  setName: string; // A, B, C
  status: PaperStatus;
  uploadedBy: string;
  uploadedAt: Date;
  deadline: Date;
  department: string;
  version: number;
  feedback?: string;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  department: string;
  semester: number;
}

export interface Exam {
  id: string;
  subjectId: string;
  subjectName: string;
  examType: ExamType;
  scheduledDate: Date;
  unlockTime: Date;
  paperId?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'archived';
}

export interface AuditLog {
  id: string;
  action: string;
  userId: string;
  userName: string;
  entityType: 'paper' | 'exam' | 'user';
  entityId: string;
  timestamp: Date;
  ipAddress: string;
  details?: string;
}
