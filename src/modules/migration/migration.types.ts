export type InventorySyncSourceMode =
  | "loopback-bridge"
  | "sibling-sqlite"
  | "unavailable";

export interface MigrationTableCount {
  table: string;
  label: string;
  group: "Members & RBAC" | "Finance & Attendance" | "Community Content";
  inventoryCount: number;
  sqliteCount: number;
}

export interface MigrationPreviewReport {
  inventoryReachable: boolean;
  sourceMode: InventorySyncSourceMode;
  sourceLabel: string;
  error?: string;
  tables: MigrationTableCount[];
  totalInventoryRows: number;
  totalSqliteRows: number;
}

export interface MigrationRunResult {
  ok: boolean;
  sourceMode: InventorySyncSourceMode;
  sourceLabel: string;
  durationMs: number;
  importedByTable: Record<string, number>;
  totalImported: number;
  hallsProvisioned: number;
  warnings: string[];
}
