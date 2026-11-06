import type Database from 'better-sqlite3';
import type { Reminder, ReminderCreateDTO } from '../../../../shared/types/reminder.types';

export type RemindersMethods = {
  insertReminder: (dto: ReminderCreateDTO) => Reminder;
  updateReminder: (id: string, updates: Partial<Pick<Reminder, 'title' | 'content' | 'reminder_date' | 'priority' | 'is_read' | 'is_completed'>>) => Reminder;
  deleteReminder: (id: string) => void;
  getReminders: (projectId?: string) => Reminder[];
  markReminderRead: (id: string) => void;
  getUnreadRemindersCount: () => number;
};

export function createRemindersMethods(getDb: () => Database.Database): RemindersMethods {
  return {
    insertReminder: (dto) => {
      const db = getDb();
      db.prepare(`
      INSERT INTO reminders (id, project_id, node_id, title, content, reminder_date, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        dto.id,
        dto.project_id,
        dto.node_id ?? null,
        dto.title,
        dto.content ?? null,
        dto.reminder_date,
        dto.priority ?? 'normal',
      );
      return db.prepare('SELECT * FROM reminders WHERE id = ?').get(dto.id) as Reminder;
    },

    updateReminder: (id, updates) => {
      const db = getDb();
      const fields: string[] = [];
      const values: unknown[] = [];
      if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
      if (updates.content !== undefined) { fields.push('content = ?'); values.push(updates.content); }
      if (updates.reminder_date !== undefined) { fields.push('reminder_date = ?'); values.push(updates.reminder_date); }
      if (updates.priority !== undefined) { fields.push('priority = ?'); values.push(updates.priority); }
      if (updates.is_read !== undefined) { fields.push('is_read = ?'); values.push(updates.is_read); }
      if (updates.is_completed !== undefined) {
        fields.push('is_completed = ?'); values.push(updates.is_completed);
        if (updates.is_completed) fields.push('completed_at = CURRENT_TIMESTAMP');
      }
      if (fields.length > 0) {
        values.push(id);
        db.prepare(`UPDATE reminders SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      }
      return db.prepare('SELECT * FROM reminders WHERE id = ?').get(id) as Reminder;
    },

    deleteReminder: (id) => {
      const db = getDb();
      db.prepare('DELETE FROM reminders WHERE id = ?').run(id);
    },

    getReminders: (projectId) => {
      const db = getDb();
      if (projectId) {
        return db.prepare(
          'SELECT * FROM reminders WHERE project_id = ? ORDER BY reminder_date',
        ).all(projectId) as Reminder[];
      }
      return db.prepare('SELECT * FROM reminders ORDER BY reminder_date').all() as Reminder[];
    },

    markReminderRead: (id) => {
      const db = getDb();
      db.prepare('UPDATE reminders SET is_read = 1 WHERE id = ?').run(id);
    },

    getUnreadRemindersCount: () => {
      const db = getDb();
      const row = db.prepare(
        'SELECT COUNT(*) as count FROM reminders WHERE is_read = 0 AND is_completed = 0',
      ).get() as { count: number };
      return row.count;
    },
  };
}

