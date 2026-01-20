import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TeacherDashboard } from '@/components/dashboards/TeacherDashboard';
import { HODDashboard } from '@/components/dashboards/HODDashboard';
import { ExamCellDashboard } from '@/components/dashboards/ExamCellDashboard';

export default function Dashboard() {
  const { user } = useAuth();

  const renderDashboard = () => {
    switch (user?.role) {
      case 'teacher':
        return <TeacherDashboard />;
      case 'hod':
        return <HODDashboard />;
      case 'exam_cell':
        return <ExamCellDashboard />;
      default:
        return <div>Unknown role</div>;
    }
  };

  return (
    <DashboardLayout>
      {renderDashboard()}
    </DashboardLayout>
  );
}
