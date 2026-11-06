export type ReminderPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Reminder {
  id: string;
  project_id: string;
  node_id: string | null;
  title: string;
  content: string | null;
  reminder_date: string;
  is_read: number;
  is_completed: number;
  priority: ReminderPriority;
  created_at: string;
  completed_at: string | null;
}

export interface ReminderCreateDTO {
  id: string;
  project_id: string;
  node_id?: string;
  title: string;
  content?: string;
  reminder_date: string;
  priority?: ReminderPriority;
}
