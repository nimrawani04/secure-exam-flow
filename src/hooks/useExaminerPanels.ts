import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface PanelMember {
  id?: string;
  position: number;
  name: string;
  designation: string;
  specialization: string;
  postal_address: string;
  contact_details: string;
  status: string;
}

export interface ExaminerPanel {
  id: string;
  department_id: string;
  school: string | null;
  department_label: string | null;
  programme: string | null;
  semester: string | null;
  session_label: string | null;
  course_title: string | null;
  course_code: string | null;
  status: string;
  head_name: string | null;
  dean_name: string | null;
  notes: string | null;
  sent_at: string | null;
  created_at: string;
  members: PanelMember[];
}

export interface PanelHeaderInput {
  school: string;
  department_label: string;
  programme: string;
  semester: string;
  session_label: string;
  course_title: string;
  course_code: string;
  head_name: string;
  dean_name: string;
  notes: string;
}

export const emptyMember = (position: number): PanelMember => ({
  position,
  name: '',
  designation: '',
  specialization: '',
  postal_address: '',
  contact_details: '',
  status: '',
});

export function useExaminerPanels() {
  const { user, profile } = useAuth();
  const [panels, setPanels] = useState<ExaminerPanel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPanels = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('examiner_panels')
      .select('*, examiner_panel_members(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading panels:', error);
      toast.error('Could not load examiner panels');
      setIsLoading(false);
      return;
    }

    setPanels(
      (data || []).map((p: any) => ({
        ...p,
        members: ((p.examiner_panel_members || []) as PanelMember[]).sort(
          (a, b) => a.position - b.position
        ),
      }))
    );
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPanels();
  }, [fetchPanels]);

  const savePanel = async (
    header: PanelHeaderInput,
    members: PanelMember[],
    panelId?: string
  ): Promise<string | null> => {
    if (!user || !profile?.department_id) {
      toast.error('Your department is not set');
      return null;
    }

    const cleanMembers = members.filter((m) => m.name.trim());
    if (cleanMembers.length === 0) {
      toast.error('Add at least one examiner');
      return null;
    }

    let id = panelId;
    if (id) {
      const { error } = await supabase
        .from('examiner_panels')
        .update({ ...header })
        .eq('id', id);
      if (error) {
        toast.error('Could not save the panel');
        return null;
      }
      await supabase.from('examiner_panel_members').delete().eq('panel_id', id);
    } else {
      const { data, error } = await supabase
        .from('examiner_panels')
        .insert({
          ...header,
          department_id: profile.department_id,
          created_by: user.id,
        })
        .select('id')
        .single();
      if (error || !data) {
        toast.error('Could not create the panel');
        return null;
      }
      id = data.id;
    }

    const { error: memberError } = await supabase.from('examiner_panel_members').insert(
      cleanMembers.map((m, idx) => ({
        panel_id: id,
        position: idx + 1,
        name: m.name.trim(),
        designation: m.designation || null,
        specialization: m.specialization || null,
        postal_address: m.postal_address || null,
        contact_details: m.contact_details || null,
        status: m.status || null,
      }))
    );

    if (memberError) {
      toast.error('Could not save the examiner rows');
      return null;
    }

    toast.success('Panel saved');
    await fetchPanels();
    return id!;
  };

  const sendToExamCell = async (panel: ExaminerPanel): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase
      .from('examiner_panels')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', panel.id);

    if (error) {
      toast.error('Could not send the panel');
      return false;
    }

    await supabase.from('notifications').insert({
      created_by: user.id,
      title: 'Panel of Examiners received',
      message: `${profile?.full_name || 'HOD'} sent a confidential panel of examiners.\nCourse: ${panel.course_title || '-'} (${panel.course_code || '-'})\nProgramme: ${panel.programme || '-'}\nSemester: ${panel.semester || '-'}`,
      target_roles: ['exam_cell'],
      type: 'info',
    });

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'send_examiner_panel',
      entity_type: 'examiner_panel',
      entity_id: panel.id,
      details: { course_code: panel.course_code, members: panel.members.length },
    });

    toast.success('Panel sent to the examination cell');
    await fetchPanels();
    return true;
  };

  const deletePanel = async (id: string) => {
    const { error } = await supabase.from('examiner_panels').delete().eq('id', id);
    if (error) {
      toast.error('Could not delete the panel');
      return;
    }
    toast.success('Panel deleted');
    await fetchPanels();
  };

  return { panels, isLoading, refetch: fetchPanels, savePanel, sendToExamCell, deletePanel };
}
