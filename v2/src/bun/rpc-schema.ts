// Shared RPC schema and types — no runtime imports; safe to use from both Bun and Vite contexts.

export type ServerConfig = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  /** Default database to connect to (usually "postgres") */
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
  /** "table" | "view" | "materialized view" */
  type: string;
};

export type ColumnInfo = {
  name: string;
  type: string;
  nullable: boolean;
};

/** Column definition used when creating a new table */
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

export type ConnectionStatus = {
  connected: boolean;
  error?: string;
};

/**
 * Electrobun RPC schema — bun side exposes all Postgres handlers;
 * the webview side has no incoming request handlers (it only calls bun).
 */
export type PgAdminRPCSchema = {
  bun: {
    requests: {
      listServers: { params: undefined; response: ServerConfig[] };
      addServer: { params: Omit<ServerConfig, "id">; response: ServerConfig };
      updateServer: { params: ServerConfig; response: ServerConfig };
      deleteServer: { params: { id: string }; response: { success: boolean } };
      testConnection: { params: { id: string }; response: ConnectionStatus };
      getDatabases: { params: { serverId: string }; response: DbInfo[] };
      getSchemas: {
        params: { serverId: string; database: string };
        response: SchemaInfo[];
      };
      getTables: {
        params: { serverId: string; database: string; schema: string };
        response: TableInfo[];
      };
      getColumns: {
        params: {
          serverId: string;
          database: string;
          schema: string;
          table: string;
        };
        response: ColumnInfo[];
      };
      executeQuery: {
        params: { serverId: string; database: string; query: string };
        response: QueryResult;
      };
      createDatabase: {
        params: { serverId: string; name: string; owner?: string };
        response: DbInfo;
      };
      dropDatabase: {
        params: { serverId: string; name: string };
        response: { success: boolean };
      };
      createSchema: {
        params: { serverId: string; database: string; name: string; owner?: string };
        response: SchemaInfo;
      };
      dropSchema: {
        params: { serverId: string; database: string; name: string; cascade?: boolean };
        response: { success: boolean };
      };
      createTable: {
        params: {
          serverId: string;
          database: string;
          schema: string;
          name: string;
          columns: ColumnDef[];
        };
        response: TableInfo;
      };
      dropTable: {
        params: { serverId: string; database: string; schema: string; name: string; cascade?: boolean };
        response: { success: boolean };
      };
      getTableData: {
        params: { serverId: string; database: string; schema: string; table: string; limit?: number };
        response: QueryResult;
      };
    };
    messages: {};
  };
  webview: {
    requests: {};
    messages: {};
  };
};
