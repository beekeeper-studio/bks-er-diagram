import type { DatabaseType } from "@beekeeperstudio/plugin";

type SupportedDatabase = Extract<
  DatabaseType,
  "postgresql" | "mysql" | "sqlite" | "sqlserver" | "oracle" | "duckdb"
>;

const SYSTEM_SCHEMAS: Record<SupportedDatabase, (string | RegExp)[]> = {
  postgresql: [
    "pg_catalog",
    "information_schema",
    /^pg_toast/,
    /^pg_temp_/,
    /^pg_internal/,
  ],
  mysql: [],
  sqlite: [],
  sqlserver: ["sys", "INFORMATION_SCHEMA"],
  oracle: [
    "SYS",
    "SYSTEM",
    "OUTLN",
    "XDB",
    "MDSYS",
    "CTXSYS",
    "ORDSYS",
    "WMSYS",
    "DBSNMP",
    "APPQOSSYS",
  ],
  duckdb: ["information_schema", "pg_catalog", "duckdb_catalog"],
};

export function isSystemSchema(
  dbType: SupportedDatabase,
  schemaName: string,
): boolean {
  const list = SYSTEM_SCHEMAS[dbType];
  if (!list) return false;
  return list.some((entry) =>
    typeof entry === "string" ? schemaName === entry : entry.test(schemaName),
  );
}

export function isSupportedDatabase(
  dbType: DatabaseType,
): dbType is SupportedDatabase {
  return dbType in SYSTEM_SCHEMAS;
}

export const isDevMode = !!import.meta.env.DEV;
