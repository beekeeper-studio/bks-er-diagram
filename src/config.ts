import { type DatabaseType } from "@beekeeperstudio/plugin";

/** FIXME use dialect type instead */
type SupportedDatabase = Extract<
  DatabaseType,
  "postgresql" | "mysql" | "mariadb" | "sqlite" | "libsql" | "sqlserver" | "oracle" | "duckdb" | "snowflake" | ""
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
  mariadb: [],
  sqlite: [],
  libsql: [],
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
  snowflake: ["INFORMATION_SCHEMA"],
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
