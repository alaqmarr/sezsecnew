export interface MigrationTableCount {
  table: string;
  label: string;
  group: "Members & RBAC" | "Finance & Attendance" | "Community Content";
  neonCount: number;
  sqliteCount: number;
}

export interface MigrationPreviewReport {
  neonConfigured: boolean;
  neonReachable: boolean;
  error?: string;
  tables: MigrationTableCount[];
  totalNeonRows: number;
  totalSqliteRows: number;
}

export interface MigrationRunResult {
  ok: boolean;
  durationMs: number;
  importedByTable: Record<string, number>;
  totalImported: number;
  warnings: string[];
}
