export type LibraryCalendarEventSeverity = 'info' | 'warning' | 'danger';

export interface LibraryCalendarEventEntity {
  id: string;
  source_type: string;
  source_id: string;
  event_key: string;
  event_date: string;
  title: string;
  content: string | null;
  severity: LibraryCalendarEventSeverity;
  meta: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LibraryCalendarEventQueryDTO {
  libraryPath: string;
  startDate: string;
  endDate: string;
  includeDeleted?: boolean;
}

export interface LibraryCalendarEventRebuildDTO {
  libraryPath: string;
}

export interface LibraryCalendarManualReminderCreateDTO {
  libraryPath: string;
  eventDate: string;
  title: string;
  content?: string | null;
  severity?: LibraryCalendarEventSeverity;
  meta?: Record<string, unknown> | null;
}

