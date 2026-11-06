import * as crypto from 'crypto';
import type Database from 'better-sqlite3';
import { DEFAULT_WORKFLOW_NODES, type WorkflowNode } from '../../../../shared/types/workflow.types';

export type WorkflowMethods = {
  initDefaultWorkflow: (projectId: string) => WorkflowNode[];
  getWorkflowByProject: (projectId: string) => WorkflowNode[];
  updateWorkflowNode: (id: string, updates: Partial<Pick<WorkflowNode, 'status' | 'actual_date' | 'expected_date' | 'remark'>>) => WorkflowNode;
};

export function createWorkflowMethods(getDb: () => Database.Database): WorkflowMethods {
  const getWorkflowByProject = (projectId: string): WorkflowNode[] => {
    const db = getDb();
    return db.prepare(
      'SELECT * FROM workflow_nodes WHERE project_id = ? ORDER BY sort_order',
    ).all(projectId) as WorkflowNode[];
  };

  return {
    initDefaultWorkflow: (projectId) => {
      const db = getDb();
      const insert = db.prepare(`
      INSERT INTO workflow_nodes (id, project_id, node_code, node_name, sort_order, deadline_days)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
      const insertMany = db.transaction(() => {
        for (const node of DEFAULT_WORKFLOW_NODES) {
          insert.run(
            crypto.randomUUID(),
            projectId,
            node.node_code,
            node.node_name,
            node.sort_order,
            node.deadline_days,
          );
        }
      });
      insertMany();
      return getWorkflowByProject(projectId);
    },

    getWorkflowByProject,

    updateWorkflowNode: (id, updates) => {
      const db = getDb();
      const fields: string[] = [];
      const values: unknown[] = [];
      if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
      if (updates.actual_date !== undefined) { fields.push('actual_date = ?'); values.push(updates.actual_date); }
      if (updates.expected_date !== undefined) { fields.push('expected_date = ?'); values.push(updates.expected_date); }
      if (updates.remark !== undefined) { fields.push('remark = ?'); values.push(updates.remark); }
      if (updates.status === 'completed') { fields.push('completed_at = CURRENT_TIMESTAMP'); }
      if (fields.length > 0) {
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        db.prepare(`UPDATE workflow_nodes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
      }
      return db.prepare('SELECT * FROM workflow_nodes WHERE id = ?').get(id) as WorkflowNode;
    },
  };
}
