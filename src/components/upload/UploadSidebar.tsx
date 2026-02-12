import { DeadlineTimer } from '@/components/dashboard/DeadlineTimer';
import { ClipboardList, Clock, Lock, ShieldCheck } from 'lucide-react';

interface UploadSidebarProps {
  deadline: Date;
}

export function UploadSidebar({ deadline }: UploadSidebarProps) {
  return (
    <div className="space-y-6">
      {/* Deadline */}
      <DeadlineTimer deadline={deadline} label="Submission Deadline" />

      {/* Security Info */}
      <div className="bg-card rounded-xl border p-4 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-success" />
          Security Features
        </h3>
        <ul className="space-y-3 text-sm">
          <li className="flex items-start gap-2">
            <Lock className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
            <span>Secure storage with access control</span>
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
            <span>No direct file URL access</span>
          </li>
          <li className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
            <span>Auto-lock after deadline</span>
          </li>
        </ul>
      </div>

      {/* Guidelines */}
      <div className="bg-accent/10 rounded-xl border border-accent/20 p-4">
        <h4 className="font-semibold text-accent mb-3 flex items-center gap-2">
          <ClipboardList className="w-4 h-4" />
          Guidelines
        </h4>
        <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
          <li>Include clear instructions for students</li>
          <li>Verify question count and marks</li>
          <li>Check for typos and formatting</li>
          <li>Ensure PDF is not password protected</li>
          <li>Upload before deadline to avoid issues</li>
        </ul>
      </div>
    </div>
  );
}
