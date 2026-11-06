export type WorkflowNodeStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface WorkflowNode {
  id: string;
  project_id: string;
  node_code: string;
  node_name: string;
  sort_order: number;
  status: WorkflowNodeStatus;
  deadline_days: number | null;
  actual_date: string | null;
  expected_date: string | null;
  completed_at: string | null;
  remark: string | null;
  created_at: string;
  updated_at: string;
}

export interface DefaultWorkflowNode {
  node_code: string;
  node_name: string;
  sort_order: number;
  deadline_days: number | null;
}

export const DEFAULT_WORKFLOW_NODES: DefaultWorkflowNode[] = [
  { node_code: 'W01', node_name: '准备申请材料',   sort_order: 1,  deadline_days: null },
  { node_code: 'W02', node_name: '填写申请表格',   sort_order: 2,  deadline_days: 7   },
  { node_code: 'W03', node_name: '提交申请',       sort_order: 3,  deadline_days: null },
  { node_code: 'W04', node_name: '缴纳申请费',     sort_order: 4,  deadline_days: 30  },
  { node_code: 'W05', node_name: '等待受理审查',   sort_order: 5,  deadline_days: 30  },
  { node_code: 'W06', node_name: '补正材料',       sort_order: 6,  deadline_days: 15  },
  { node_code: 'W07', node_name: '等待审批',       sort_order: 7,  deadline_days: 60  },
  { node_code: 'W08', node_name: '领取登记证书',   sort_order: 8,  deadline_days: null },
  { node_code: 'W09', node_name: '归档',           sort_order: 9,  deadline_days: null },
];
