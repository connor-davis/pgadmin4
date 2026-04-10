/**
 * Typed wrappers around the Electrobun RPC proxy exposed by mainview.ts.
 *
 * The webview entry (src/bun/views/mainview.ts, compiled by Bun) sets up the
 * Electroview bridge and exposes `electroview.rpc` as `window.__pgRpc`.
 * This file provides fully-typed helpers so React code never uses `window as any`.
 */

// ─── Types (kept in sync with src/bun/rpc-schema.ts) ─────────────────────────

export type ServerConfig = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
};

export type DbInfo = {
  name: string;
  owner: string;
};

export type SchemaInfo = {
  name: string;
  owner: string;
};

export type TableInfo = {
  name: string;
  schema: string;
  type: string;
};

export type ColumnInfo = {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
};

export type ConstraintInfo = {
  name: string;
  type: string;
  definition: string;
};

export type IndexInfo = {
  name: string;
  definition: string;
  unique: boolean;
  primary: boolean;
};

export type RLSPolicyInfo = {
  name: string;
  cmd: string;
  roles: string[];
  using: string | null;
  withCheck: string | null;
};

export type RuleInfo = {
  name: string;
  definition: string;
};

export type TriggerInfo = {
  name: string;
  event: string;
  timing: string;
  enabled: boolean;
};

export type ColumnDef = {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey?: boolean;
  defaultValue?: string;
};

export type QueryResult = {
  columns: string[];
  rows: (string | number | boolean | null)[][];
  rowCount: number;
};

export type TableDataResult = QueryResult & {
  page: number;
  pageCount: number;
  pageSize: number;
  totalRowCount: number;
};

export type ERDTable = {
  columns: ColumnInfo[];
  name: string;
  schema: string;
  type: string;
};

export type ERDRelationship = {
  name: string;
  sourceColumn: string;
  sourceSchema: string;
  sourceTable: string;
  targetColumn: string;
  targetSchema: string;
  targetTable: string;
};

export type ERDData = {
  relationships: ERDRelationship[];
  tables: ERDTable[];
};

export type ConnectionStatus = {
  connected: boolean;
  error?: string;
};

// ─── RPC accessor ─────────────────────────────────────────────────────────────

function getProxy() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).__pgRpc?.request as {
    listServers: () => Promise<ServerConfig[]>;
    addServer: (params: Omit<ServerConfig, 'id'>) => Promise<ServerConfig>;
    updateServer: (params: ServerConfig) => Promise<ServerConfig>;
    deleteServer: (params: { id: string }) => Promise<{ success: boolean }>;
    testConnection: (params: { id: string }) => Promise<ConnectionStatus>;
    getDatabases: (params: { serverId: string }) => Promise<DbInfo[]>;
    getSchemas: (params: {
      serverId: string;
      database: string;
    }) => Promise<SchemaInfo[]>;
    getTables: (params: {
      serverId: string;
      database: string;
      schema: string;
    }) => Promise<TableInfo[]>;
    getColumns: (params: {
      serverId: string;
      database: string;
      schema: string;
      table: string;
    }) => Promise<ColumnInfo[]>;
    executeQuery: (params: {
      serverId: string;
      database: string;
      query: string;
    }) => Promise<QueryResult>;
    createDatabase: (params: { serverId: string; name: string; owner?: string }) => Promise<DbInfo>;
    dropDatabase: (params: { serverId: string; name: string }) => Promise<{ success: boolean }>;
    createSchema: (params: { serverId: string; database: string; name: string; owner?: string }) => Promise<SchemaInfo>;
    dropSchema: (params: { serverId: string; database: string; name: string; cascade?: boolean }) => Promise<{ success: boolean }>;
    createTable: (params: {
      serverId: string;
      database: string;
      schema: string;
      name: string;
      columns: ColumnDef[];
    }) => Promise<TableInfo>;
    dropTable: (params: { serverId: string; database: string; schema: string; name: string; cascade?: boolean }) => Promise<{ success: boolean }>;
    getTableData: (params: {
      serverId: string;
      database: string;
      schema: string;
      table: string;
      page?: number;
      pageSize?: number;
      rowMode?: "first" | "last" | "all" | "filtered";
      filter?: string;
    }) => Promise<TableDataResult>;
    truncateTable: (params: {
      serverId: string;
      database: string;
      schema: string;
      table: string;
      mode: "plain" | "cascade" | "restart" | "cascade_restart";
    }) => Promise<{ success: boolean }>;
    addColumn: (params: {
      serverId: string;
      database: string;
      schema: string;
      table: string;
      column: ColumnDef;
    }) => Promise<ColumnInfo>;
    getConstraints: (params: { serverId: string; database: string; schema: string; table: string }) => Promise<ConstraintInfo[]>;
    getIndexes: (params: { serverId: string; database: string; schema: string; table: string }) => Promise<IndexInfo[]>;
    getRLSPolicies: (params: { serverId: string; database: string; schema: string; table: string }) => Promise<RLSPolicyInfo[]>;
    getRules: (params: { serverId: string; database: string; schema: string; table: string }) => Promise<RuleInfo[]>;
    getTriggers: (params: { serverId: string; database: string; schema: string; table: string }) => Promise<TriggerInfo[]>;
    getERDData: (params: { serverId: string; database: string }) => Promise<ERDData>;
    minimizeWindow: () => Promise<void>;
    maximizeWindow: () => Promise<void>;
    closeWindow: () => Promise<void>;
    getWindowState: () => Promise<{ maximized: boolean }>;
  };
}

// ─── Exported RPC helpers ─────────────────────────────────────────────────────

export const rpc = {
  listServers: () => getProxy().listServers(),
  addServer: (params: Omit<ServerConfig, 'id'>) => getProxy().addServer(params),
  updateServer: (params: ServerConfig) => getProxy().updateServer(params),
  deleteServer: (id: string) => getProxy().deleteServer({ id }),
  testConnection: (id: string) => getProxy().testConnection({ id }),
  getDatabases: (serverId: string) => getProxy().getDatabases({ serverId }),
  getSchemas: (serverId: string, database: string) =>
    getProxy().getSchemas({ serverId, database }),
  getTables: (serverId: string, database: string, schema: string) =>
    getProxy().getTables({ serverId, database, schema }),
  getColumns: (
    serverId: string,
    database: string,
    schema: string,
    table: string
  ) => getProxy().getColumns({ serverId, database, schema, table }),
  executeQuery: (serverId: string, database: string, query: string) =>
    getProxy().executeQuery({ serverId, database, query }),
  createDatabase: (serverId: string, name: string, owner?: string) =>
    getProxy().createDatabase({ serverId, name, owner }),
  dropDatabase: (serverId: string, name: string) =>
    getProxy().dropDatabase({ serverId, name }),
  createSchema: (serverId: string, database: string, name: string, owner?: string) =>
    getProxy().createSchema({ serverId, database, name, owner }),
  dropSchema: (serverId: string, database: string, name: string, cascade?: boolean) =>
    getProxy().dropSchema({ serverId, database, name, cascade }),
  createTable: (
    serverId: string,
    database: string,
    schema: string,
    name: string,
    columns: ColumnDef[]
  ) => getProxy().createTable({ serverId, database, schema, name, columns }),
  dropTable: (serverId: string, database: string, schema: string, name: string, cascade?: boolean) =>
    getProxy().dropTable({ serverId, database, schema, name, cascade }),
  getTableData: (
    serverId: string,
    database: string,
    schema: string,
    table: string,
    options?: {
      page?: number;
      pageSize?: number;
      rowMode?: 'first' | 'last' | 'all' | 'filtered';
      filter?: string;
    }
  ) =>
    getProxy().getTableData({
      serverId,
      database,
      schema,
      table,
      page: options?.page,
      pageSize: options?.pageSize,
      rowMode: options?.rowMode,
      filter: options?.filter,
    }),
  truncateTable: (
    serverId: string,
    database: string,
    schema: string,
    table: string,
    mode: 'plain' | 'cascade' | 'restart' | 'cascade_restart'
  ) => getProxy().truncateTable({ serverId, database, schema, table, mode }),
  addColumn: (
    serverId: string,
    database: string,
    schema: string,
    table: string,
    column: ColumnDef
  ) => getProxy().addColumn({ serverId, database, schema, table, column }),
  getConstraints: (serverId: string, database: string, schema: string, table: string) =>
    getProxy().getConstraints({ serverId, database, schema, table }),
  getIndexes: (serverId: string, database: string, schema: string, table: string) =>
    getProxy().getIndexes({ serverId, database, schema, table }),
  getRLSPolicies: (serverId: string, database: string, schema: string, table: string) =>
    getProxy().getRLSPolicies({ serverId, database, schema, table }),
  getRules: (serverId: string, database: string, schema: string, table: string) =>
    getProxy().getRules({ serverId, database, schema, table }),
  getTriggers: (serverId: string, database: string, schema: string, table: string) =>
    getProxy().getTriggers({ serverId, database, schema, table }),
  getERDData: (serverId: string, database: string) =>
    getProxy().getERDData({ serverId, database }),
  minimizeWindow: () => getProxy().minimizeWindow(),
  maximizeWindow: () => getProxy().maximizeWindow(),
  closeWindow: () => getProxy().closeWindow(),
  getWindowState: () => getProxy().getWindowState(),
};

// ─── React Query key factory ──────────────────────────────────────────────────

export const queryKeys = {
  servers: () => ['servers'] as const,
  server: (id: string) => ['server', id] as const,
  databases: (serverId: string) => ['databases', serverId] as const,
  schemas: (serverId: string, database: string) =>
    ['schemas', serverId, database] as const,
  tables: (serverId: string, database: string, schema: string) =>
    ['tables', serverId, database, schema] as const,
  columns: (
    serverId: string,
    database: string,
    schema: string,
    table: string
  ) => ['columns', serverId, database, schema, table] as const,
  tableData: (
    serverId: string,
    database: string,
    schema: string,
    table: string
  ) => ['tableData', serverId, database, schema, table] as const,
  constraints: (serverId: string, database: string, schema: string, table: string) =>
    ['constraints', serverId, database, schema, table] as const,
  indexes: (serverId: string, database: string, schema: string, table: string) =>
    ['indexes', serverId, database, schema, table] as const,
  rlsPolicies: (serverId: string, database: string, schema: string, table: string) =>
    ['rlsPolicies', serverId, database, schema, table] as const,
  rules: (serverId: string, database: string, schema: string, table: string) =>
    ['rules', serverId, database, schema, table] as const,
  triggers: (serverId: string, database: string, schema: string, table: string) =>
    ['triggers', serverId, database, schema, table] as const,
};
