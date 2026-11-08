export interface SqlitePragmaSnapshot {
  journalMode: string;
  synchronous: number;
  busyTimeoutMs: number;
  foreignKeys: boolean;
  cacheSizeKb: number;
  walAutoCheckpoint: number;
  pageCount: number;
  pageSize: number;
  databaseSizeBytes: number;
}

export interface DatabaseHealthReport {
  status: "healthy" | "degraded";
  engine: string;
  filePath: string;
  latencyMs: number;
  pragmas: SqlitePragmaSnapshot;
  writeQueueDepth: number;
}
