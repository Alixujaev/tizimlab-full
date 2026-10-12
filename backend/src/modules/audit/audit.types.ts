export interface AuditLogRow {
  id: string;
  user_id: string | null;
  company_id: string | null;
  table_name: string;
  record_id: string | null;
  action: string;
  old_values: unknown;
  new_values: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string | Date;
  user_name?: string | null;
  user_email?: string | null;
  user_role?: string | null;
  company_name?: string | null;
}

export interface AuditLogDto {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userRole: string | null;
  companyId: string | null;
  companyName: string | null;
  tableName: string;
  recordId: string | null;
  action: string;
  oldValues: unknown;
  newValues: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}
