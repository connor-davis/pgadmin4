import { SQL } from 'bun';
import { Database } from 'bun:sqlite';
import { BrowserView, BrowserWindow } from 'electrobun/bun';
import fs from 'fs';
import os from 'os';
import path from 'path';

import type {
  ColumnDef,
  ColumnInfo,
  ConnectionStatus,
  ConstraintInfo,
  DbInfo,
  ERDData,
  ERDRelationship,
  ERDTable,
  IndexInfo,
  QueryResult,
  RLSPolicyInfo,
  RuleInfo,
  SchemaInfo,
  ServerConfig,
  TableDataResult,
  TableInfo,
  TriggerInfo,
} from './rpc-schema';

// ─── App data directory ───────────────────────────────────────────────────────

const userDataDir = process.env.APPDATA
  ? path.join(process.env.APPDATA, 'pgadmin4-v2')
  : path.join(os.homedir(), '.pgadmin4-v2');

if (!fs.existsSync(userDataDir)) {
  fs.mkdirSync(userDataDir, { recursive: true });
}

// ─── SQLite server config store ───────────────────────────────────────────────

const db = new Database(path.join(userDataDir, 'servers.db'));

db.run(`
  CREATE TABLE IF NOT EXISTS servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    host TEXT NOT NULL DEFAULT 'localhost',
    port INTEGER NOT NULL DEFAULT 5432,
    username TEXT NOT NULL DEFAULT 'postgres',
    password TEXT NOT NULL DEFAULT '',
    database TEXT NOT NULL DEFAULT 'postgres',
    ssl INTEGER NOT NULL DEFAULT 0
  )
`);

type ServerRow = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: number;
};

type AddServerParams = Omit<ServerConfig, 'id'>;
type UpdateServerParams = ServerConfig;
type ServerIdParams = { id: string };
type ServerDatabaseParams = { serverId: string; database: string };
type ServerDatabaseSchemaParams = ServerDatabaseParams & { schema: string };
type ServerDatabaseSchemaTableParams = ServerDatabaseParams & {
  schema: string;
  table: string;
};
type ExecuteQueryParams = ServerDatabaseParams & { query: string };
type CreateDatabaseParams = { serverId: string; name: string; owner?: string };
type DropDatabaseParams = { serverId: string; name: string };
type CreateSchemaParams = ServerDatabaseParams & {
  name: string;
  owner?: string;
};
type DropSchemaParams = ServerDatabaseParams & {
  name: string;
  cascade?: boolean;
};
type CreateTableParams = ServerDatabaseParams & {
  schema: string;
  name: string;
  columns: ColumnDef[];
};
type DropTableParams = ServerDatabaseParams & {
  schema: string;
  name: string;
  cascade?: boolean;
};
type GetTableDataParams = ServerDatabaseSchemaTableParams & {
  rowMode?: 'first' | 'last' | 'filtered';
  page?: number;
  pageSize?: number;
  filter?: string;
};
type TruncateTableParams = ServerDatabaseSchemaTableParams & {
  mode?: 'normal' | 'cascade' | 'restart' | 'cascade_restart';
};
type AddColumnParams = ServerDatabaseSchemaTableParams & { column: ColumnDef };

function rowToConfig(row: ServerRow): ServerConfig {
  return { ...row, ssl: Boolean(row.ssl) };
}

// ─── SQL connection cache ─────────────────────────────────────────────────────

const connections = new Map<string, SQL>();

function getConnectionKey(serverId: string, database: string) {
  return `${serverId}/${database}`;
}

function getServerRow(serverId: string): ServerRow {
  const row = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as
    | ServerRow
    | undefined;
  if (!row) throw new Error(`Server "${serverId}" not found`);
  return row;
}

async function getConnection(serverId: string, database: string): Promise<SQL> {
  const key = getConnectionKey(serverId, database);
  const existing = connections.get(key);
  if (existing) return existing;

  const server = getServerRow(serverId);
  const sql = new SQL({
    hostname: server.host,
    port: server.port,
    username: server.username,
    password: server.password,
    database,
    tls: Boolean(server.ssl),
  });

  await sql.connect();
  connections.set(key, sql);
  return sql;
}

async function closeServerConnections(serverId: string) {
  for (const [key, sql] of connections) {
    if (key.startsWith(`${serverId}/`)) {
      try {
        await sql.close({ timeout: 0 });
      } catch {
        // ignore
      }
      connections.delete(key);
    }
  }
}

// ─── Window (forward reference so RPC handlers can reach it) ─────────────────

let mainWindow: BrowserWindow | null = null;

// ─── RPC handlers ─────────────────────────────────────────────────────────────

const rpc = BrowserView.defineRPC({
  handlers: {
    requests: {
      listServers: (): ServerConfig[] => {
        const rows = db
          .prepare('SELECT * FROM servers ORDER BY name')
          .all() as ServerRow[];
        return rows.map(rowToConfig);
      },

      addServer: (params: AddServerParams): ServerConfig => {
        const id = crypto.randomUUID();
        db.prepare(
          `
          INSERT INTO servers (id, name, host, port, username, password, database, ssl)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
        ).run(
          id,
          params!.name,
          params!.host,
          params!.port,
          params!.username,
          params!.password,
          params!.database,
          params!.ssl ? 1 : 0
        );
        return rowToConfig(getServerRow(id));
      },

      updateServer: async (
        params: UpdateServerParams
      ): Promise<ServerConfig> => {
        await closeServerConnections(params!.id);
        db.prepare(
          `
          UPDATE servers SET name=?, host=?, port=?, username=?, password=?, database=?, ssl=?
          WHERE id=?
        `
        ).run(
          params!.name,
          params!.host,
          params!.port,
          params!.username,
          params!.password,
          params!.database,
          params!.ssl ? 1 : 0,
          params!.id
        );
        return rowToConfig(getServerRow(params!.id));
      },

      deleteServer: async (
        params: ServerIdParams
      ): Promise<{ success: boolean }> => {
        await closeServerConnections(params!.id);
        db.prepare('DELETE FROM servers WHERE id = ?').run(params!.id);
        return { success: true };
      },

      testConnection: async (
        params: ServerIdParams
      ): Promise<ConnectionStatus> => {
        const server = getServerRow(params!.id);
        const sql = new SQL({
          hostname: server.host,
          port: server.port,
          username: server.username,
          password: server.password,
          database: server.database,
          tls: Boolean(server.ssl),
        });
        try {
          await sql.connect();
          await sql`SELECT 1`;
          await sql.close({ timeout: 0 });
          return { connected: true };
        } catch (err) {
          try {
            await sql.close({ timeout: 0 });
          } catch {
            // ignore
          }
          return {
            connected: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      },

      getDatabases: async (params: { serverId: string }): Promise<DbInfo[]> => {
        const conn = await getConnection(params!.serverId, 'postgres');
        const rows = await conn<DbInfo[]>`
          SELECT datname AS name,
                 pg_catalog.pg_get_userbyid(datdba) AS owner
          FROM   pg_catalog.pg_database
          WHERE  NOT datistemplate
          ORDER  BY datname
        `;
        return rows;
      },

      getSchemas: async (
        params: ServerDatabaseParams
      ): Promise<SchemaInfo[]> => {
        const conn = await getConnection(params!.serverId, params!.database);
        const rows = await conn<SchemaInfo[]>`
          SELECT nspname AS name,
                 pg_catalog.pg_get_userbyid(nspowner) AS owner
          FROM   pg_catalog.pg_namespace
          WHERE  nspname NOT LIKE 'pg_%'
            AND  nspname != 'information_schema'
          ORDER  BY nspname
        `;
        return rows;
      },

      getTables: async (
        params: ServerDatabaseSchemaParams
      ): Promise<TableInfo[]> => {
        const conn = await getConnection(params!.serverId, params!.database);
        const rows = await conn<TableInfo[]>`
          SELECT tablename AS name,
                 schemaname AS schema,
                 'table' AS type
          FROM   pg_catalog.pg_tables
          WHERE  schemaname = ${params!.schema}
          UNION ALL
          SELECT viewname AS name,
                 schemaname AS schema,
                 'view' AS type
          FROM   pg_catalog.pg_views
          WHERE  schemaname = ${params!.schema}
          ORDER  BY type, name
        `;
        return rows;
      },

      getColumns: async (
        params: ServerDatabaseSchemaTableParams
      ): Promise<ColumnInfo[]> => {
        const conn = await getConnection(params!.serverId, params!.database);
        const rows = await conn<
          {
            column_default: string | null;
            is_nullable: string;
            name: string;
            type: string;
          }[]
        >`
          SELECT column_name AS name,
                 data_type   AS type,
                 is_nullable,
                 column_default
          FROM   information_schema.columns
          WHERE  table_schema = ${params!.schema}
            AND  table_name   = ${params!.table}
          ORDER  BY ordinal_position
        `;
        return rows.map((r) => ({
          defaultValue: r.column_default,
          name: r.name,
          type: r.type,
          nullable: r.is_nullable === 'YES',
        }));
      },

      executeQuery: async (
        params: ExecuteQueryParams
      ): Promise<QueryResult> => {
        const conn = await getConnection(params!.serverId, params!.database);
        const result = await conn.unsafe<Record<string, unknown>[]>(
          params!.query
        );
        if (!Array.isArray(result) || result.length === 0) {
          return { columns: [], rows: [], rowCount: 0 };
        }
        const columns = Object.keys(result[0]);
        const rows = result.map((row) =>
          columns.map((col) => {
            const val = row[col];
            return val === undefined
              ? null
              : (val as string | number | boolean | null);
          })
        );
        return { columns, rows, rowCount: rows.length };
      },

      createDatabase: async (params: CreateDatabaseParams): Promise<DbInfo> => {
        // Must connect to an existing db (postgres), not the one we're creating
        const conn = await getConnection(params!.serverId, 'postgres');
        const name = params!.name;
        const owner = params!.owner;
        if (owner) {
          await conn.unsafe(`CREATE DATABASE "${name}" OWNER "${owner}"`);
        } else {
          await conn.unsafe(`CREATE DATABASE "${name}"`);
        }
        const rows = await conn<DbInfo[]>`
          SELECT datname AS name,
                 pg_catalog.pg_get_userbyid(datdba) AS owner
          FROM   pg_catalog.pg_database
          WHERE  datname = ${name}
        `;
        return rows[0];
      },

      dropDatabase: async (
        params: DropDatabaseParams
      ): Promise<{ success: boolean }> => {
        const serverId = params!.serverId;
        const name = params!.name;
        // Close any cached connections to that database before dropping
        for (const [key, sql] of connections) {
          if (key === getConnectionKey(serverId, name)) {
            try {
              await sql.close({ timeout: 0 });
            } catch {
              /* ignore */
            }
            connections.delete(key);
          }
        }
        const conn = await getConnection(serverId, 'postgres');
        await conn.unsafe(`DROP DATABASE IF EXISTS "${name}"`);
        return { success: true };
      },

      createSchema: async (params: CreateSchemaParams): Promise<SchemaInfo> => {
        const conn = await getConnection(params!.serverId, params!.database);
        const name = params!.name;
        const owner = params!.owner;
        await conn.unsafe(`CREATE SCHEMA IF NOT EXISTS "${name}"`);
        if (owner) {
          await conn.unsafe(`ALTER SCHEMA "${name}" OWNER TO "${owner}"`);
        }
        const rows = await conn<SchemaInfo[]>`
          SELECT nspname AS name,
                 pg_catalog.pg_get_userbyid(nspowner) AS owner
          FROM   pg_catalog.pg_namespace
          WHERE  nspname = ${name}
        `;
        return rows[0];
      },

      dropSchema: async (
        params: DropSchemaParams
      ): Promise<{ success: boolean }> => {
        const conn = await getConnection(params!.serverId, params!.database);
        const cascade = params!.cascade ? ' CASCADE' : ' RESTRICT';
        await conn.unsafe(`DROP SCHEMA IF EXISTS "${params!.name}"${cascade}`);
        return { success: true };
      },

      createTable: async (params: CreateTableParams): Promise<TableInfo> => {
        const conn = await getConnection(params!.serverId, params!.database);
        const { schema, name, columns } = params!;
        if (!columns || columns.length === 0) {
          throw new Error('At least one column is required');
        }
        const pkCols = columns
          .filter((c: ColumnDef) => c.primaryKey)
          .map((c: ColumnDef) => `"${c.name}"`);
        const colDefs = columns.map((c: ColumnDef) => {
          let def = `"${c.name}" ${c.type}`;
          if (!c.nullable) def += ' NOT NULL';
          if (c.defaultValue) def += ` DEFAULT ${c.defaultValue}`;
          return def;
        });
        if (pkCols.length > 0) {
          colDefs.push(`PRIMARY KEY (${pkCols.join(', ')})`);
        }
        const ddl = `CREATE TABLE "${schema}"."${name}" (\n  ${colDefs.join(',\n  ')}\n)`;
        await conn.unsafe(ddl);
        return { name, schema, type: 'table' };
      },

      dropTable: async (
        params: DropTableParams
      ): Promise<{ success: boolean }> => {
        const conn = await getConnection(params!.serverId, params!.database);
        const cascade = params!.cascade ? ' CASCADE' : ' RESTRICT';
        await conn.unsafe(
          `DROP TABLE IF EXISTS "${params!.schema}"."${params!.name}"${cascade}`
        );
        return { success: true };
      },

      getTableData: async (
        params: GetTableDataParams
      ): Promise<TableDataResult> => {
        const conn = await getConnection(params!.serverId, params!.database);
        const {
          schema,
          table,
          rowMode = 'first',
          page = 1,
          pageSize = 100,
          filter,
        } = params!;
        const qualified = `"${schema}"."${table}"`;
        const effectivePageSize = Math.max(1, Math.min(pageSize, 1000));
        const where =
          rowMode === 'filtered' && filter && filter.trim()
            ? ` WHERE ${filter}`
            : '';
        const countResult = await conn.unsafe<
          { total_row_count: number | string }[]
        >(`SELECT COUNT(*)::int AS total_row_count FROM ${qualified}${where}`);
        const totalRowCount = Number(countResult[0]?.total_row_count ?? 0);
        const pageCount =
          totalRowCount === 0
            ? 1
            : Math.ceil(totalRowCount / effectivePageSize);
        const currentPage = Math.max(1, Math.min(page, pageCount));
        const offset = (currentPage - 1) * effectivePageSize;

        let sql: string;

        if (rowMode === 'last') {
          sql = `SELECT *
                 FROM (
                   SELECT *
                   FROM   ${qualified}
                   ORDER  BY ctid DESC
                   LIMIT  ${effectivePageSize}
                   OFFSET ${offset}
                 ) _subq
                 ORDER  BY ctid`;
        } else {
          sql = `SELECT *
                 FROM   ${qualified}${where}
                 LIMIT  ${effectivePageSize}
                 OFFSET ${offset}`;
        }

        const result = await conn.unsafe<Record<string, unknown>[]>(sql);
        if (!Array.isArray(result) || result.length === 0) {
          return {
            columns: [],
            page: currentPage,
            pageCount,
            pageSize: effectivePageSize,
            rowCount: 0,
            rows: [],
            totalRowCount,
          };
        }
        const columns = Object.keys(result[0]);
        const rows = result.map((row) =>
          columns.map((col) => {
            const val = row[col];
            return val === undefined
              ? null
              : (val as string | number | boolean | null);
          })
        );
        return {
          columns,
          page: currentPage,
          pageCount,
          pageSize: effectivePageSize,
          rowCount: rows.length,
          rows,
          totalRowCount,
        };
      },

      truncateTable: async (
        params: TruncateTableParams
      ): Promise<{ success: boolean }> => {
        const conn = await getConnection(params!.serverId, params!.database);
        const { schema, table, mode } = params!;
        const qualified = `"${schema}"."${table}"`;
        let suffix = '';
        if (mode === 'cascade') suffix = ' CASCADE';
        else if (mode === 'restart') suffix = ' RESTART IDENTITY';
        else if (mode === 'cascade_restart')
          suffix = ' RESTART IDENTITY CASCADE';
        await conn.unsafe(`TRUNCATE TABLE ${qualified}${suffix}`);
        return { success: true };
      },

      addColumn: async (params: AddColumnParams): Promise<ColumnInfo> => {
        const conn = await getConnection(params!.serverId, params!.database);
        const { schema, table, column } = params!;
        let def = `"${column.name}" ${column.type}`;
        if (!column.nullable) def += ' NOT NULL';
        if (column.defaultValue) def += ` DEFAULT ${column.defaultValue}`;
        await conn.unsafe(
          `ALTER TABLE "${schema}"."${table}" ADD COLUMN ${def}`
        );
        // Re-query column info to return canonical data
        const rows = await conn<
          {
            column_default: string | null;
            is_nullable: string;
            name: string;
            type: string;
          }[]
        >`
          SELECT column_name AS name,
                 data_type   AS type,
                 is_nullable,
                 column_default
          FROM   information_schema.columns
          WHERE  table_schema = ${schema}
            AND  table_name   = ${table}
            AND  column_name  = ${column.name}
        `;
        if (rows.length === 0)
          throw new Error(`Column "${column.name}" not found after creation`);
        return {
          defaultValue: rows[0].column_default,
          name: rows[0].name,
          type: rows[0].type,
          nullable: rows[0].is_nullable === 'YES',
        };
      },

      getConstraints: async (
        params: ServerDatabaseSchemaTableParams
      ): Promise<ConstraintInfo[]> => {
        const conn = await getConnection(params!.serverId, params!.database);
        const rows = await conn<
          { name: string; type: string; definition: string }[]
        >`
          SELECT con.conname AS name,
                 con.contype AS type,
                 pg_catalog.pg_get_constraintdef(con.oid, true) AS definition
          FROM   pg_catalog.pg_constraint con
          JOIN   pg_catalog.pg_class cls ON cls.oid = con.conrelid
          JOIN   pg_catalog.pg_namespace ns ON ns.oid = cls.relnamespace
          WHERE  ns.nspname = ${params!.schema}
            AND  cls.relname = ${params!.table}
          ORDER  BY con.conname
        `;
        return rows;
      },

      getIndexes: async (
        params: ServerDatabaseSchemaTableParams
      ): Promise<IndexInfo[]> => {
        const conn = await getConnection(params!.serverId, params!.database);
        const rows = await conn<
          {
            name: string;
            definition: string;
            unique: boolean;
            primary: boolean;
          }[]
        >`
          SELECT i.relname AS name,
                 pg_catalog.pg_get_indexdef(ix.indexrelid, 0, true) AS definition,
                 ix.indisunique AS unique,
                 ix.indisprimary AS primary
          FROM   pg_catalog.pg_index ix
          JOIN   pg_catalog.pg_class i ON i.oid = ix.indexrelid
          JOIN   pg_catalog.pg_class t ON t.oid = ix.indrelid
          JOIN   pg_catalog.pg_namespace ns ON ns.oid = t.relnamespace
          WHERE  ns.nspname = ${params!.schema}
            AND  t.relname  = ${params!.table}
          ORDER  BY i.relname
        `;
        return rows;
      },

      getRLSPolicies: async (
        params: ServerDatabaseSchemaTableParams
      ): Promise<RLSPolicyInfo[]> => {
        const conn = await getConnection(params!.serverId, params!.database);
        const rows = await conn<
          {
            name: string;
            cmd: string;
            roles: string;
            using: string | null;
            with_check: string | null;
          }[]
        >`
          SELECT polname AS name,
                 CASE polcmd
                   WHEN 'r' THEN 'SELECT'
                   WHEN 'a' THEN 'INSERT'
                   WHEN 'w' THEN 'UPDATE'
                   WHEN 'd' THEN 'DELETE'
                   ELSE 'ALL'
                 END AS cmd,
                 array_to_string(
                   ARRAY(SELECT pg_catalog.quote_ident(rolname)
                         FROM   pg_catalog.pg_roles
                         WHERE  oid = ANY(polroles)),
                   ', '
                 ) AS roles,
                 pg_catalog.pg_get_expr(polqual, polrelid) AS using,
                 pg_catalog.pg_get_expr(polwithcheck, polrelid) AS with_check
          FROM   pg_catalog.pg_policy pol
          JOIN   pg_catalog.pg_class cls ON cls.oid = pol.polrelid
          JOIN   pg_catalog.pg_namespace ns ON ns.oid = cls.relnamespace
          WHERE  ns.nspname = ${params!.schema}
            AND  cls.relname = ${params!.table}
          ORDER  BY polname
        `;
        return rows.map((r) => ({
          name: r.name,
          cmd: r.cmd,
          roles: r.roles ? r.roles.split(', ').filter(Boolean) : [],
          using: r.using,
          withCheck: r.with_check,
        }));
      },

      getRules: async (
        params: ServerDatabaseSchemaTableParams
      ): Promise<RuleInfo[]> => {
        const conn = await getConnection(params!.serverId, params!.database);
        const rows = await conn<{ name: string; definition: string }[]>`
          SELECT rulename AS name,
                 pg_catalog.pg_get_ruledef(oid, true) AS definition
          FROM   pg_catalog.pg_rewrite
          WHERE  ev_class = (
            SELECT c.oid
            FROM   pg_catalog.pg_class c
            JOIN   pg_catalog.pg_namespace ns ON ns.oid = c.relnamespace
            WHERE  ns.nspname = ${params!.schema}
              AND  c.relname  = ${params!.table}
          )
            AND  rulename != '_RETURN'
          ORDER  BY rulename
        `;
        return rows;
      },

      getERDData: async (params: ServerDatabaseParams): Promise<ERDData> => {
        const conn = await getConnection(params!.serverId, params!.database);
        const tables = await conn<
          { name: string; schema: string; type: string }[]
        >`
          SELECT cls.relname AS name,
                 ns.nspname AS schema,
                 CASE cls.relkind
                   WHEN 'p' THEN 'partitioned table'
                   ELSE 'table'
                 END AS type
          FROM   pg_catalog.pg_class cls
          JOIN   pg_catalog.pg_namespace ns ON ns.oid = cls.relnamespace
          WHERE  cls.relkind IN ('r', 'p')
            AND  ns.nspname NOT IN ('pg_catalog', 'information_schema')
          ORDER  BY ns.nspname, cls.relname
        `;

        const columns = await conn<
          {
            column_default: string | null;
            is_nullable: string;
            name: string;
            schema: string;
            table_name: string;
            type: string;
          }[]
        >`
          SELECT column_name AS name,
                 column_default,
                 data_type AS type,
                 is_nullable,
                 table_name,
                 table_schema AS schema
          FROM   information_schema.columns
          WHERE  table_schema NOT IN ('pg_catalog', 'information_schema')
          ORDER  BY table_schema, table_name, ordinal_position
        `;

        const relationships = await conn<
          {
            name: string;
            source_column: string;
            source_schema: string;
            source_table: string;
            target_column: string;
            target_schema: string;
            target_table: string;
          }[]
        >`
          SELECT con.conname AS name,
                 src_att.attname AS source_column,
                 src_ns.nspname AS source_schema,
                 src.relname AS source_table,
                 tgt_att.attname AS target_column,
                 tgt_ns.nspname AS target_schema,
                 tgt.relname AS target_table
          FROM   pg_catalog.pg_constraint con
          JOIN   pg_catalog.pg_class src ON src.oid = con.conrelid
          JOIN   pg_catalog.pg_namespace src_ns ON src_ns.oid = src.relnamespace
          JOIN   pg_catalog.pg_class tgt ON tgt.oid = con.confrelid
          JOIN   pg_catalog.pg_namespace tgt_ns ON tgt_ns.oid = tgt.relnamespace
          JOIN   unnest(con.conkey) WITH ORDINALITY AS src_key(attnum, ordinality)
                   ON true
          JOIN   unnest(con.confkey) WITH ORDINALITY AS tgt_key(attnum, ordinality)
                   ON tgt_key.ordinality = src_key.ordinality
          JOIN   pg_catalog.pg_attribute src_att
                   ON src_att.attrelid = src.oid
                  AND src_att.attnum = src_key.attnum
          JOIN   pg_catalog.pg_attribute tgt_att
                   ON tgt_att.attrelid = tgt.oid
                  AND tgt_att.attnum = tgt_key.attnum
          WHERE  con.contype = 'f'
            AND  src_ns.nspname NOT IN ('pg_catalog', 'information_schema')
            AND  tgt_ns.nspname NOT IN ('pg_catalog', 'information_schema')
          ORDER  BY src_ns.nspname, src.relname, con.conname, src_key.ordinality
        `;

        const columnsByTable = new Map<string, ColumnInfo[]>();
        for (const column of columns) {
          const tableKey = `${column.schema}.${column.table_name}`;
          const tableColumns = columnsByTable.get(tableKey) ?? [];
          tableColumns.push({
            defaultValue: column.column_default,
            name: column.name,
            type: column.type,
            nullable: column.is_nullable === 'YES',
          });
          columnsByTable.set(tableKey, tableColumns);
        }

        return {
          relationships: relationships.map(
            (relationship): ERDRelationship => ({
              name: relationship.name,
              sourceColumn: relationship.source_column,
              sourceSchema: relationship.source_schema,
              sourceTable: relationship.source_table,
              targetColumn: relationship.target_column,
              targetSchema: relationship.target_schema,
              targetTable: relationship.target_table,
            })
          ),
          tables: tables.map(
            (table): ERDTable => ({
              columns:
                columnsByTable.get(`${table.schema}.${table.name}`) ?? [],
              name: table.name,
              schema: table.schema,
              type: table.type,
            })
          ),
        };
      },

      minimizeWindow: (): void => {
        mainWindow?.minimize();
      },

      maximizeWindow: (): void => {
        if (mainWindow?.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow?.maximize();
        }
      },

      closeWindow: (): void => {
        mainWindow?.close();
      },

      getWindowState: (): { maximized: boolean } => ({
        maximized: mainWindow?.isMaximized() ?? false,
      }),

      getTriggers: async (
        params: ServerDatabaseSchemaTableParams
      ): Promise<TriggerInfo[]> => {
        const conn = await getConnection(params!.serverId, params!.database);
        const rows = await conn<
          {
            name: string;
            event: string;
            timing: string;
            enabled: boolean;
          }[]
        >`
          SELECT t.tgname AS name,
                 string_agg(
                   CASE em.num
                     WHEN 1 THEN 'INSERT'
                     WHEN 2 THEN 'DELETE'
                     WHEN 4 THEN 'UPDATE'
                     WHEN 8 THEN 'TRUNCATE'
                   END,
                   ' OR '
                   ORDER BY em.num
                 ) AS event,
                 CASE t.tgtype & 2 WHEN 2 THEN 'BEFORE' ELSE 'AFTER' END AS timing,
                 t.tgenabled != 'D' AS enabled
          FROM   pg_catalog.pg_trigger t
          JOIN   pg_catalog.pg_class cls ON cls.oid = t.tgrelid
          JOIN   pg_catalog.pg_namespace ns ON ns.oid = cls.relnamespace
          JOIN   (VALUES (1),(2),(4),(8)) AS em(num)
                   ON (t.tgtype & em.num) <> 0
          WHERE  ns.nspname = ${params!.schema}
            AND  cls.relname = ${params!.table}
            AND  NOT t.tgisinternal
          GROUP  BY t.tgname, t.tgtype, t.tgenabled
          ORDER  BY t.tgname
        `;
        return rows;
      },
    } as Record<string, (params?: unknown) => unknown>,
  },
});

// ─── Window ───────────────────────────────────────────────────────────────────

mainWindow = new BrowserWindow({
  title: 'pgAdmin 4',
  url: 'views://mainview/index.html',
  frame: { width: 1280, height: 720, x: 100, y: 100 },
  titleBarStyle: 'hidden',
  rpc,
});

mainWindow.on('close', async () => {
  for (const [, sql] of connections) {
    try {
      await sql.close({ timeout: 0 });
    } catch {
      // ignore
    }
  }
  connections.clear();
  db.close();
});

console.log('[pgAdmin v2] App started.');
