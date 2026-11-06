export type ProjectStatus =
  | 'preparing'      // 准备材料
  | 'submitted'      // 已提交
  | 'accepted'       // 已受理
  | 'correction'     // 需补正
  | 'approved'       // 已批准
  | 'registered'     // 已登记
  | 'rejected';      // 已驳回

export type ApplicantType = 'individual' | 'enterprise';
export type SoftwareType = 'application' | 'system' | 'embedded' | 'middleware' | 'support';

export interface Project {
  id: string;
  name: string;
  short_name: string | null;
  version: string;
  folder_path: string;
  status: ProjectStatus;
  applicant_type: ApplicantType;
  applicant_name: string;
  applicant_cert_no: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  developer_name: string | null;
  completion_date: string;
  software_type: SoftwareType;
  application_no: string | null;
  registration_no: string | null;
  certificate_no: string | null;
  submit_date: string | null;
  accept_date: string | null;
  approval_date: string | null;
  fee_amount: number | null;
  fee_paid_date: string | null;
  remark: string | null;
  is_archived: number;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreateDTO {
  name: string;
  short_name?: string;
  version?: string;
  folder_path: string;
  applicant_type: ApplicantType;
  applicant_name: string;
  applicant_cert_no?: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  developer_name?: string;
  completion_date: string;
  software_type?: SoftwareType;
  remark?: string;
}

export interface ProjectUpdateDTO {
  id: string;
  name?: string;
  short_name?: string;
  version?: string;
  status?: ProjectStatus;
  applicant_type?: ApplicantType;
  applicant_name?: string;
  applicant_cert_no?: string;
  contact_person?: string;
  contact_phone?: string;
  contact_email?: string;
  developer_name?: string;
  completion_date?: string;
  software_type?: SoftwareType;
  application_no?: string;
  registration_no?: string;
  certificate_no?: string;
  submit_date?: string;
  accept_date?: string;
  approval_date?: string;
  fee_amount?: number;
  fee_paid_date?: string;
  remark?: string;
  is_archived?: number;
}
