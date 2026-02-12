import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TeacherDashboard } from '@/components/dashboards/TeacherDashboard';
import { HODDashboard } from '@/components/dashboards/HODDashboard';
import { ExamCellDashboard } from '@/components/dashboards/ExamCellDashboard';
import { AdminDashboard } from '@/components/dashboards/AdminDashboard';
import { HODAlerts } from '@/components/dashboards/HODAlerts';

export default function Dashboard() {
  const { profile } = useAuth();
  const location = useLocation();

  const renderDashboard = () => {
    switch (profile?.role) {
      case 'teacher':
        return <TeacherDashboard />;
      case 'hod':
        if (location.pathname === '/hod/alerts') {
          return <HODAlerts />;
        }
        return <HODDashboard />;
      case 'exam_cell':
        if (location.pathname === '/calendar') return <ExamCellDashboard view="calendar" />;
        if (location.pathname === '/exam-cell/sessions') return <ExamCellDashboard view="sessions" />;
        if (location.pathname === '/exam-cell/alerts') return <ExamCellDashboard view="alerts" />;
        if (location.pathname === '/inbox') return <ExamCellDashboard view="inbox" />;
        if (location.pathname === '/archive') return <ExamCellDashboard view="archive" />;
        return <ExamCellDashboard view="overview" />;
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
