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
import { useTheme } from 'next-themes';
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { Button } from '@/components/ui/button';
import { type ColumnInfo, type ERDData, queryKeys, rpc } from '@/lib/rpc';

interface ERDTabProps {
  serverId: string;
  database: string;
  schema?: string;
}

type ERDNodeData = {
  columns: ColumnInfo[];
  schema: string;
  table: string;
};

type NodePosition = {
  x: number;
  y: number;
};

type StoredDiagramState = {
  manualEdges: Edge[];
  manualPositions: Record<string, NodePosition>;
  positions?: Record<string, NodePosition>;
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

const DIAGRAM_STORAGE_PREFIX = 'viper-erd';
const NODE_WIDTH = 288;
const NODE_MIN_HEIGHT = 120;
const NODE_HEADER_HEIGHT = 56;
const NODE_ROW_HEIGHT = 22;
const LAYER_GAP = 144;
const NODE_GAP_Y = 36;
const COMPONENT_GAP = 180;
const SECTION_GAP_Y = 180;
const MAX_LAYOUT_WIDTH = 1900;

const NODE_TYPES = {
  table: TableNodeCard,
};

function getDiagramStorageKey(serverId: string, database: string, schema?: string) {
  return `${DIAGRAM_STORAGE_PREFIX}:${serverId}:${database}:${schema ?? '__database__'}`;
}

function getTableNodeId(schema: string, table: string) {
  return `${schema}.${table}`;
}

function getTableNodeHeight(columns: ColumnInfo[]) {
  return Math.max(NODE_MIN_HEIGHT, NODE_HEADER_HEIGHT + columns.length * NODE_ROW_HEIGHT);
}

function compareIds(a: string, b: string, degrees: Map<string, number>) {
  const degreeDelta = (degrees.get(b) ?? 0) - (degrees.get(a) ?? 0);

  if (degreeDelta !== 0) {
    return degreeDelta;
  }

  return a.localeCompare(b);
}

function buildAdjacency(
  tables: ERDData['tables'],
  relationships: ERDData['relationships']
) {
  const tableIds = new Set(tables.map((table) => getTableNodeId(table.schema, table.name)));
  const adjacency = new Map<string, Set<string>>();

  for (const tableId of tableIds) {
    adjacency.set(tableId, new Set());
  }

  for (const relationship of relationships) {
    const sourceId = getTableNodeId(
      relationship.sourceSchema,
      relationship.sourceTable
    );
    const targetId = getTableNodeId(
      relationship.targetSchema,
      relationship.targetTable
    );

    if (!tableIds.has(sourceId) || !tableIds.has(targetId)) {
      continue;
    }

    adjacency.get(sourceId)?.add(targetId);
    adjacency.get(targetId)?.add(sourceId);
  }

  return adjacency;
}

function getConnectedComponents(
  nodeIds: string[],
  adjacency: Map<string, Set<string>>,
  degrees: Map<string, number>
) {
  const remaining = new Set(nodeIds);
  const components: string[][] = [];

  while (remaining.size > 0) {
    const root = [...remaining].sort((a, b) => compareIds(a, b, degrees))[0];
    const queue = [root];
    const component: string[] = [];
    remaining.delete(root);

    while (queue.length > 0) {
      const current = queue.shift();

      if (!current) {
        continue;
      }

      component.push(current);

      const neighbors = [...(adjacency.get(current) ?? [])].filter((neighbor) =>
        remaining.has(neighbor)
      );
      neighbors.sort((a, b) => compareIds(a, b, degrees));

      for (const neighbor of neighbors) {
        remaining.delete(neighbor);
        queue.push(neighbor);
      }
    }

    components.push(component);
  }

  return components.sort((a, b) => {
    if (b.length !== a.length) {
      return b.length - a.length;
    }

    const degreeA = a.reduce((sum, id) => sum + (degrees.get(id) ?? 0), 0);
    const degreeB = b.reduce((sum, id) => sum + (degrees.get(id) ?? 0), 0);

    if (degreeB !== degreeA) {
      return degreeB - degreeA;
    }

    return a[0].localeCompare(b[0]);
  });
}

function buildComponentLayout(
  nodeIds: string[],
  nodeHeights: Map<string, number>,
  adjacency: Map<string, Set<string>>,
  degrees: Map<string, number>
) {
  const root = [...nodeIds].sort((a, b) => compareIds(a, b, degrees))[0];
  const queue: string[] = [root];
  const depths = new Map<string, number>([[root, 0]]);

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      continue;
    }

    const nextDepth = (depths.get(current) ?? 0) + 1;
    const neighbors = [...(adjacency.get(current) ?? [])]
      .filter((neighbor) => nodeIds.includes(neighbor) && !depths.has(neighbor))
      .sort((a, b) => compareIds(a, b, degrees));

    for (const neighbor of neighbors) {
      depths.set(neighbor, nextDepth);
      queue.push(neighbor);
    }
  }

  for (const nodeId of nodeIds) {
    if (!depths.has(nodeId)) {
      depths.set(nodeId, 0);
    }
  }

  const layerMap = new Map<number, string[]>();
  for (const nodeId of nodeIds) {
    const depth = depths.get(nodeId) ?? 0;
    const layer = layerMap.get(depth) ?? [];
    layer.push(nodeId);
    layerMap.set(depth, layer);
  }

  const layers = [...layerMap.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, layer]) => layer.sort((a, b) => compareIds(a, b, degrees)));

  const positions: Record<string, NodePosition> = {};
  let maxHeight = NODE_MIN_HEIGHT;

  layers.forEach((layer, layerIndex) => {
    let yCursor = 0;

    layer.forEach((nodeId) => {
      positions[nodeId] = {
        x: layerIndex * (NODE_WIDTH + LAYER_GAP),
        y: yCursor,
      };
      yCursor += (nodeHeights.get(nodeId) ?? NODE_MIN_HEIGHT) + NODE_GAP_Y;
    });

    maxHeight = Math.max(maxHeight, Math.max(0, yCursor - NODE_GAP_Y));
  });

  return {
    height: maxHeight,
    positions,
    width:
      layers.length * NODE_WIDTH + Math.max(0, layers.length - 1) * LAYER_GAP,
  };
}

function buildAutoLayoutNodes(data: ERDData): Node<ERDNodeData>[] {
  const adjacency = buildAdjacency(data.tables, data.relationships);
  const nodeHeights = new Map<string, number>();
  const nodeById = new Map<string, ERDData['tables'][number]>();
  const schemaGroups = new Map<string, string[]>();
  const degrees = new Map<string, number>();

  for (const table of data.tables) {
    const id = getTableNodeId(table.schema, table.name);
    nodeHeights.set(id, getTableNodeHeight(table.columns));
    nodeById.set(id, table);
    degrees.set(id, adjacency.get(id)?.size ?? 0);

    const schemaNodes = schemaGroups.get(table.schema) ?? [];
    schemaNodes.push(id);
    schemaGroups.set(table.schema, schemaNodes);
  }

  const positionedNodes: Node<ERDNodeData>[] = [];
  let sectionTop = 32;

  for (const [schema, schemaNodeIds] of [...schemaGroups.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    const components = getConnectedComponents(schemaNodeIds, adjacency, degrees);
    let componentLeft = 32;
    let rowTop = sectionTop;
    let rowHeight = 0;

    for (const component of components) {
      const layout = buildComponentLayout(component, nodeHeights, adjacency, degrees);

      if (componentLeft > 32 && componentLeft + layout.width > MAX_LAYOUT_WIDTH) {
        componentLeft = 32;
        rowTop += rowHeight + COMPONENT_GAP;
        rowHeight = 0;
      }

      component.forEach((nodeId) => {
        const table = nodeById.get(nodeId);
        const position = layout.positions[nodeId];

        if (!table || !position) {
          return;
        }

        positionedNodes.push({
          id: nodeId,
          type: 'table',
          position: {
            x: componentLeft + position.x,
            y: rowTop + position.y,
          },
          data: {
            columns: table.columns,
            schema,
            table: table.name,
          },
        });
      });

      componentLeft += layout.width + COMPONENT_GAP;
      rowHeight = Math.max(rowHeight, layout.height);
    }

    sectionTop = rowTop + rowHeight + SECTION_GAP_Y;
  }

  return positionedNodes;
}

function loadStoredDiagramState(storageKey: string): StoredDiagramState {
  const stored = localStorage.getItem(storageKey);

  if (!stored) {
    return { manualEdges: [], manualPositions: {} };
  }

  try {
    const parsed = JSON.parse(stored) as Partial<StoredDiagramState>;
    return {
      manualEdges: Array.isArray(parsed.manualEdges) ? parsed.manualEdges : [],
      manualPositions:
        parsed.manualPositions && typeof parsed.manualPositions === 'object'
          ? parsed.manualPositions
          : parsed.positions && typeof parsed.positions === 'object'
            ? parsed.positions
            : {},
    };
  } catch {
    return { manualEdges: [], manualPositions: {} };
  }
}

function TableNodeCard({ data }: NodeProps<Node<ERDNodeData>>) {
  return (
    <div className="w-72 rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <Handle type="target" position={Position.Left} className="h-3! w-3! bg-primary!" />
      <Handle type="source" position={Position.Right} className="h-3! w-3! bg-primary!" />

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
  schema,
  serverId,
}: {
  colorMode: 'dark' | 'light';
  data: ERDData;
  database: string;
  flowThemeStyle: FlowThemeStyle;
  schema?: string;
  serverId: string;
}) {
  const storageKey = getDiagramStorageKey(serverId, database, schema);
  const savedState = useMemo(
    () => loadStoredDiagramState(storageKey),
    [storageKey]
  );
  const { fitView } = useReactFlow();

  const autoLayoutNodes = useMemo(() => buildAutoLayoutNodes(data), [data]);
  const [manualPositions, setManualPositions] = useState<Record<string, NodePosition>>(
    savedState.manualPositions
  );
  const [manualEdges, setManualEdges] = useState<Edge[]>(savedState.manualEdges);

  const positionedNodes = useMemo(
    () =>
      autoLayoutNodes.map((node) => ({
        ...node,
        position: manualPositions[node.id] ?? node.position,
      })),
    [autoLayoutNodes, manualPositions]
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

  useEffect(() => {
    setManualPositions(savedState.manualPositions);
  }, [savedState.manualPositions, storageKey]);

  useEffect(() => {
    setManualEdges(savedState.manualEdges);
  }, [savedState.manualEdges, storageKey]);

  useEffect(() => {
    setNodes(positionedNodes);
  }, [positionedNodes]);

  useEffect(() => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        manualEdges,
        manualPositions,
      } satisfies StoredDiagramState)
    );
  }, [manualEdges, manualPositions, storageKey]);

  const onNodesChange = useCallback((changes: NodeChange<Node<ERDNodeData>>[]) => {
    setNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
    setManualPositions((currentPositions) => {
      let nextPositions = currentPositions;

      for (const change of changes) {
        if (change.type === 'remove' && change.id in nextPositions) {
          if (nextPositions === currentPositions) {
            nextPositions = { ...currentPositions };
          }

          delete nextPositions[change.id];
        }

        if (change.type === 'position' && change.position) {
          const existingPosition = nextPositions[change.id];

          if (
            !existingPosition ||
            existingPosition.x !== change.position.x ||
            existingPosition.y !== change.position.y
          ) {
            if (nextPositions === currentPositions) {
              nextPositions = { ...currentPositions };
            }

            nextPositions[change.id] = change.position;
          }
        }
      }

      return nextPositions;
    });
  }, []);

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
    setManualPositions({});
    setNodes(autoLayoutNodes);
    requestAnimationFrame(() => {
      fitView({ duration: 250, padding: 0.16 });
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
            {schema
              ? `Showing ${data.tables.length} tables in schema "${schema}". Drag tables to fine-tune the layout.`
              : `Showing ${data.tables.length} tables across database "${database}". Drag tables to fine-tune the layout.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fitView({ duration: 250, padding: 0.16 })}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Fit View
          </Button>
          <Button variant="outline" size="sm" onClick={handleResetLayout}>
            <Network className="mr-2 h-3.5 w-3.5" />
            Re-run Layout
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

export function ERDTab({ serverId, database, schema }: ERDTabProps) {
  const { resolvedTheme } = useTheme();
  const { data, error, isLoading } = useQuery({
    queryKey: queryKeys.erdData(serverId, database, schema),
    queryFn: () => rpc.getERDData(serverId, database, schema),
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
        {schema
          ? `No tables were found for schema "${schema}".`
          : 'No tables were found for this database.'}
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
        schema={schema}
        serverId={serverId}
      />
    </ReactFlowProvider>
  );
}
