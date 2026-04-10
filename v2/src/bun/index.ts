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
  DbInfo,
  PgAdminRPCSchema,
  QueryResult,
  SchemaInfo,
  ServerConfig,
  TableInfo,
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

// ─── RPC handlers ─────────────────────────────────────────────────────────────

const rpc = BrowserView.defineRPC<PgAdminRPCSchema>({
  handlers: {
    requests: {
      listServers: (): ServerConfig[] => {
        const rows = db
          .prepare('SELECT * FROM servers ORDER BY name')
          .all() as ServerRow[];
        return rows.map(rowToConfig);
      },

      addServer: (params): ServerConfig => {
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

      updateServer: async (params): Promise<ServerConfig> => {
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

      deleteServer: async (params): Promise<{ success: boolean }> => {
        await closeServerConnections(params!.id);
        db.prepare('DELETE FROM servers WHERE id = ?').run(params!.id);
        return { success: true };
      },

      testConnection: async (params): Promise<ConnectionStatus> => {
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

      getDatabases: async (params): Promise<DbInfo[]> => {
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

      getSchemas: async (params): Promise<SchemaInfo[]> => {
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

      getTables: async (params): Promise<TableInfo[]> => {
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

      getColumns: async (params): Promise<ColumnInfo[]> => {
        const conn = await getConnection(params!.serverId, params!.database);
        const rows = await conn<
          { name: string; type: string; is_nullable: string }[]
        >`
          SELECT column_name AS name,
                 data_type   AS type,
                 is_nullable
          FROM   information_schema.columns
          WHERE  table_schema = ${params!.schema}
            AND  table_name   = ${params!.table}
          ORDER  BY ordinal_position
        `;
        return rows.map((r) => ({
          name: r.name,
          type: r.type,
          nullable: r.is_nullable === 'YES',
        }));
      },

      executeQuery: async (params): Promise<QueryResult> => {
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

      createDatabase: async (params): Promise<DbInfo> => {
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

      dropDatabase: async (params): Promise<{ success: boolean }> => {
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

      createSchema: async (params): Promise<SchemaInfo> => {
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

      dropSchema: async (params): Promise<{ success: boolean }> => {
        const conn = await getConnection(params!.serverId, params!.database);
        const cascade = params!.cascade ? ' CASCADE' : ' RESTRICT';
        await conn.unsafe(`DROP SCHEMA IF EXISTS "${params!.name}"${cascade}`);
        return { success: true };
      },

      createTable: async (params): Promise<TableInfo> => {
        const conn = await getConnection(params!.serverId, params!.database);
        const { schema, name, columns } = params!;
        if (!columns || columns.length === 0) {
          throw new Error('At least one column is required');
        }
        const pkCols = columns
          .filter((c) => c.primaryKey)
          .map((c) => `"${c.name}"`);
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

      dropTable: async (params): Promise<{ success: boolean }> => {
        const conn = await getConnection(params!.serverId, params!.database);
        const cascade = params!.cascade ? ' CASCADE' : ' RESTRICT';
        await conn.unsafe(
          `DROP TABLE IF EXISTS "${params!.schema}"."${params!.name}"${cascade}`
        );
        return { success: true };
      },

      getTableData: async (params): Promise<QueryResult> => {
        const conn = await getConnection(params!.serverId, params!.database);
        const limit = params!.limit ?? 100;
        const result = await conn.unsafe<Record<string, unknown>[]>(
          `SELECT * FROM "${params!.schema}"."${params!.table}" LIMIT ${limit}`
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
    },
  },
});

// ─── Window ───────────────────────────────────────────────────────────────────

const mainWindow = new BrowserWindow({
  title: 'pgAdmin 4',
  url: 'views://mainview/index.html',
  frame: { width: 1280, height: 720, x: 100, y: 100 },
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
