import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TeacherDashboard } from '@/components/dashboards/TeacherDashboard';
import { HODDashboard } from '@/components/dashboards/HODDashboard';
import { ExamCellDashboard } from '@/components/dashboards/ExamCellDashboard';
import { AdminDashboard } from '@/components/dashboards/AdminDashboard';

export default function Dashboard() {
  const { profile } = useAuth();

  const renderDashboard = () => {
    switch (profile?.role) {
      case 'teacher':
        return <TeacherDashboard />;
      case 'hod':
        return <HODDashboard />;
      case 'exam_cell':
        return <ExamCellDashboard />;
      case 'admin':
        return <AdminDashboard />;
      default:
        return <div>Loading dashboard...</div>;
    }
  };

  return (
    <DashboardLayout>
      {renderDashboard()}
    </DashboardLayout>
  );
}
