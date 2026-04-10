//////////////////////////////////////////////////////////////////////////
//
// pgAdmin 4 - PostgreSQL Tools
//
// Copyright (C) 2013 - 2026, The pgAdmin Development Team
// This software is released under the PostgreSQL Licence
//
//////////////////////////////////////////////////////////////////////////
import { useQuery } from '@tanstack/react-query';
import {
  Background,
  type Connection,
  Controls,
  type Edge,
  type EdgeChange,
  Handle,
  MiniMap,
  type Node,
  type NodeChange,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Loader2, Network, RefreshCw, Trash2 } from 'lucide-react';
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';
import { type ColumnInfo, type ERDData, rpc } from '@/lib/rpc';

interface ERDTabProps {
  serverId: string;
  database: string;
}

type ERDNodeData = {
  columns: ColumnInfo[];
  schema: string;
  table: string;
};

type StoredDiagramState = {
  manualEdges: Edge[];
  positions: Record<string, { x: number; y: number }>;
};

const DIAGRAM_STORAGE_PREFIX = 'pgadmin4-erd';

const NODE_TYPES = {
  table: TableNodeCard,
};

type FlowThemeStyle = CSSProperties & {
  '--xy-attribution-background-color-default'?: string;
  '--xy-background-color-default'?: string;
  '--xy-background-pattern-dots-color-default'?: string;
  '--xy-connectionline-stroke-default'?: string;
  '--xy-controls-box-shadow-default'?: string;
  '--xy-controls-button-background-color-default'?: string;
  '--xy-controls-button-background-color-hover-default'?: string;
  '--xy-controls-button-border-color-default'?: string;
  '--xy-controls-button-color-default'?: string;
  '--xy-controls-button-color-hover-default'?: string;
  '--xy-edge-label-background-color-default'?: string;
  '--xy-edge-label-color-default'?: string;
  '--xy-edge-stroke-default'?: string;
  '--xy-edge-stroke-selected-default'?: string;
  '--xy-handle-background-color-default'?: string;
  '--xy-handle-border-color-default'?: string;
  '--xy-minimap-background-color-default'?: string;
  '--xy-minimap-mask-background-color-default'?: string;
  '--xy-minimap-node-background-color-default'?: string;
  '--xy-minimap-node-stroke-color-default'?: string;
  '--xy-node-background-color-default'?: string;
  '--xy-node-border-default'?: string;
  '--xy-node-boxshadow-hover-default'?: string;
  '--xy-node-boxshadow-selected-default'?: string;
  '--xy-node-color-default'?: string;
  '--xy-selection-background-color-default'?: string;
  '--xy-selection-border-default'?: string;
};

function getDiagramStorageKey(serverId: string, database: string) {
  return `${DIAGRAM_STORAGE_PREFIX}:${serverId}:${database}`;
}

function getTableNodeId(schema: string, table: string) {
  return `${schema}.${table}`;
}

function getDefaultPosition(index: number) {
  const columns = 4;
  return {
    x: 32 + (index % columns) * 320,
    y: 32 + Math.floor(index / columns) * 260,
  };
}

function loadStoredDiagramState(storageKey: string): StoredDiagramState {
  const stored = localStorage.getItem(storageKey);

  if (!stored) {
    return { manualEdges: [], positions: {} };
  }

  try {
    const parsed = JSON.parse(stored) as Partial<StoredDiagramState>;
    return {
      manualEdges: Array.isArray(parsed.manualEdges) ? parsed.manualEdges : [],
      positions:
        parsed.positions && typeof parsed.positions === 'object'
          ? parsed.positions
          : {},
    };
  } catch {
    return { manualEdges: [], positions: {} };
  }
}

function TableNodeCard({ data }: NodeProps<Node<ERDNodeData>>) {
  return (
    <div className="w-72 rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <Handle type="target" position={Position.Left} className="h-3! w-3!" />
      <Handle type="source" position={Position.Right} className="h-3! w-3!" />

      <div className="border-b border-border px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {data.schema}
        </p>
        <p className="truncate text-sm font-semibold text-foreground">
          {data.table}
        </p>
      </div>

      <div className="max-h-52 overflow-y-auto px-3 py-2">
        <ul className="space-y-1.5">
          {data.columns.map((column) => (
            <li
              key={column.name}
              className="flex items-start justify-between gap-3 text-xs"
            >
              <span className="truncate font-medium text-foreground">
                {column.name}
              </span>
              <span className="truncate text-right text-muted-foreground">
                {column.type}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ERDCanvas({
  colorMode,
  data,
  database,
  flowThemeStyle,
  serverId,
}: {
  data: ERDData;
  database: string;
  serverId: string;
  colorMode: 'dark' | 'light';
  flowThemeStyle: FlowThemeStyle;
}) {
  const storageKey = getDiagramStorageKey(serverId, database);
  const savedState = useMemo(
    () => loadStoredDiagramState(storageKey),
    [storageKey]
  );
  const { fitView } = useReactFlow();

  const gridNodes = useMemo<Node<ERDNodeData>[]>(
    () =>
      data.tables.map((table, index) => ({
        id: getTableNodeId(table.schema, table.name),
        type: 'table',
        position: getDefaultPosition(index),
        data: {
          columns: table.columns,
          schema: table.schema,
          table: table.name,
        },
      })),
    [data.tables]
  );

  const positionedNodes = useMemo<Node<ERDNodeData>[]>(
    () =>
      gridNodes.map((node) => ({
        ...node,
        position: savedState.positions[node.id] ?? node.position,
      })),
    [gridNodes, savedState.positions]
  );

  const generatedEdges = useMemo<Edge[]>(
    () =>
      data.relationships.map((relationship) => ({
        id: `fk:${relationship.name}:${relationship.sourceSchema}.${relationship.sourceTable}:${relationship.targetSchema}.${relationship.targetTable}:${relationship.sourceColumn}:${relationship.targetColumn}`,
        label: `${relationship.sourceColumn} -> ${relationship.targetColumn}`,
        source: getTableNodeId(
          relationship.sourceSchema,
          relationship.sourceTable
        ),
        target: getTableNodeId(
          relationship.targetSchema,
          relationship.targetTable
        ),
        type: 'smoothstep',
        selectable: false,
      })),
    [data.relationships]
  );

  const [nodes, setNodes] = useState<Node<ERDNodeData>[]>(positionedNodes);
  const [manualEdges, setManualEdges] = useState<Edge[]>(
    savedState.manualEdges
  );

  useEffect(() => {
    setNodes(positionedNodes);
  }, [positionedNodes]);

  useEffect(() => {
    setManualEdges(savedState.manualEdges);
  }, [savedState.manualEdges, storageKey]);

  useEffect(() => {
    const positions = Object.fromEntries(
      nodes.map((node) => [node.id, node.position])
    );

    localStorage.setItem(
      storageKey,
      JSON.stringify({
        manualEdges,
        positions,
      } satisfies StoredDiagramState)
    );
  }, [manualEdges, nodes, storageKey]);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<ERDNodeData>>[]) => {
      setNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
    },
    []
  );

  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    setManualEdges((currentEdges) => applyEdgeChanges(changes, currentEdges));
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) {
      return;
    }

    setManualEdges((currentEdges) =>
      addEdge(
        {
          ...connection,
          id: `manual:${connection.source}:${connection.target}:${Date.now()}`,
          label: 'Manual relationship',
          type: 'smoothstep',
        },
        currentEdges
      )
    );
  }, []);

  const edges = useMemo(
    () => [...generatedEdges, ...manualEdges],
    [generatedEdges, manualEdges]
  );

  function handleResetLayout() {
    setNodes(gridNodes);
    requestAnimationFrame(() => {
      fitView({ padding: 0.12 });
    });
  }

  function handleClearManualRelationships() {
    setManualEdges([]);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/20 px-3 py-1.5">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Entity Relationship Diagram
          </p>
          <p className="text-xs text-muted-foreground">
            Drag tables to reposition them. Manual relationships are stored
            locally.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fitView({ padding: 0.12 })}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Fit View
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetLayout}>
            <Network className="mr-2 h-3.5 w-3.5" />
            Reset Layout
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearManualRelationships}
            disabled={manualEdges.length === 0}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Clear Manual Links
          </Button>
        </div>
      </div>

      <div className="flex-1">
        <ReactFlow
          className="bg-background"
          colorMode={colorMode}
          fitView
          edges={edges}
          nodes={nodes}
          nodeTypes={NODE_TYPES}
          onConnect={onConnect}
          onEdgesChange={onEdgesChange}
          onNodesChange={onNodesChange}
          style={flowThemeStyle}
        >
          <Background gap={20} size={1} />
          <Controls />
          <MiniMap zoomable pannable />
        </ReactFlow>
      </div>
    </div>
  );
}

export function ERDTab({ serverId, database }: ERDTabProps) {
  const { resolvedTheme } = useTheme();
  const { data, error, isLoading } = useQuery({
    queryKey: ['erd-data', serverId, database],
    queryFn: () => rpc.getERDData(serverId, database),
  });
  const colorMode = resolvedTheme === 'dark' ? 'dark' : 'light';
  const flowThemeStyle = useMemo<FlowThemeStyle>(
    () => ({
      '--xy-attribution-background-color-default': 'var(--popover)',
      '--xy-background-color-default': 'var(--background)',
      '--xy-background-pattern-dots-color-default': 'var(--border)',
      '--xy-connectionline-stroke-default': 'var(--border)',
      '--xy-controls-box-shadow-default': '0 0 0 1px var(--border)',
      '--xy-controls-button-background-color-default': 'var(--card)',
      '--xy-controls-button-background-color-hover-default': 'var(--accent)',
      '--xy-controls-button-border-color-default': 'var(--border)',
      '--xy-controls-button-color-default': 'var(--foreground)',
      '--xy-controls-button-color-hover-default': 'var(--accent-foreground)',
      '--xy-edge-label-background-color-default': 'var(--popover)',
      '--xy-edge-label-color-default': 'var(--popover-foreground)',
      '--xy-edge-stroke-default': 'var(--border)',
      '--xy-edge-stroke-selected-default': 'var(--primary)',
      '--xy-handle-background-color-default': 'var(--primary)',
      '--xy-handle-border-color-default': 'var(--background)',
      '--xy-minimap-background-color-default': 'var(--card)',
      '--xy-minimap-mask-background-color-default':
        'color-mix(in oklch, var(--background) 65%, transparent)',
      '--xy-minimap-node-background-color-default': 'var(--muted-foreground)',
      '--xy-minimap-node-stroke-color-default': 'var(--border)',
      '--xy-node-background-color-default': 'var(--card)',
      '--xy-node-border-default': '1px solid var(--border)',
      '--xy-node-boxshadow-hover-default':
        '0 1px 4px 1px color-mix(in oklch, var(--foreground) 8%, transparent)',
      '--xy-node-boxshadow-selected-default': '0 0 0 1px var(--primary)',
      '--xy-node-color-default': 'var(--card-foreground)',
      '--xy-selection-background-color-default':
        'color-mix(in oklch, var(--primary) 12%, transparent)',
      '--xy-selection-border-default': '1px dotted var(--primary)',
    }),
    []
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-4 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {error instanceof Error ? error.message : 'Failed to load ERD data.'}
      </div>
    );
  }

  if (!data || data.tables.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No tables were found for this database.
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <ERDCanvas
        colorMode={colorMode}
        data={data}
        database={database}
        flowThemeStyle={flowThemeStyle}
        serverId={serverId}
      />
    </ReactFlowProvider>
  );
}
