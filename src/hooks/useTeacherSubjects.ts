import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TeacherSubject {
  id: string;
  name: string;
  code: string;
  semester: number;
  department_id: string;
}

export function useTeacherSubjects() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<TeacherSubject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSubjects() {
      if (!user) {
        setSubjects([]);
        setIsLoading(false);
        return;
      }

      try {
        // Fetch subjects assigned to this teacher
        const { data: teacherSubjects, error: tsError } = await supabase
          .from('teacher_subjects')
          .select(`
            subject_id,
            subjects (
              id,
              name,
              code,
              semester,
              department_id
            )
          `)
          .eq('teacher_id', user.id);

        if (tsError) {
          console.error('Error fetching teacher subjects:', tsError);
          setError('Failed to load subjects');
          setSubjects([]);
          return;
        }

        const mappedSubjects: TeacherSubject[] = (teacherSubjects || [])
          .filter((ts) => ts.subjects)
          .map((ts) => ({
            id: (ts.subjects as any).id,
            name: (ts.subjects as any).name,
            code: (ts.subjects as any).code,
            semester: (ts.subjects as any).semester,
            department_id: (ts.subjects as any).department_id,
          }));

        setSubjects(mappedSubjects);
        setError(null);
      } catch (err) {
        console.error('Error in fetchSubjects:', err);
        setError('An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchSubjects();
  }, [user]);

  return { subjects, isLoading, error };
}
