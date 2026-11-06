export type TaskType = 'import' | 'export' | 'delete' | 'copy' | 'sync' | 'move' | 'other';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type TaskInfo = {
  id: string;
  name: string;
  type: TaskType;
  status: TaskStatus;
  progress: number;
  total?: number;
  current?: number;
  message?: string;
  startedAt: number;
  updatedAt: number;
};

export type TaskProgressCallback = (progress: Partial<TaskInfo>) => void;

export type RegisterTaskInput = {
  id: string;
  name: string;
  type: TaskType;
  total?: number;
  onProgress?: TaskProgressCallback;
  onComplete?: (result?: unknown) => void;
  onFail?: (error?: unknown) => void;
};

export type ActiveTasksResponse = {
  tasks: TaskInfo[];
  hasActiveTasks: boolean;
};