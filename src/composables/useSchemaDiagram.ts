import { useVueFlow, type Edge, type Node } from "@vue-flow/core";
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { useLayout } from "./useLayout";

export type Entity = {
  name: string;
  schema?: string;
};

export type Column = {
  entity: Entity;
  name: string;
};

export type ColumnStructure = Column & {
  type?: string;
  handleId: string;
  hasReferences: boolean;
};

export type EntityStructure = Entity & {
  type: "table";
  columns: ColumnStructure[];
};

export type ColumnReference = {
  from: Column;
  to: Column;
};

export type NodeData = EntityStructure;

export type EdgeData = ColumnReference;

function getNodeId(entity: Entity): string {
  return entity.schema ? `${entity.schema}.${entity.name}` : entity.name;
}

function getEdgeId({
  from: fromColumn,
  to: toColumn,
}: ColumnReference): string {
  if (fromColumn.entity.schema) {
    return `${fromColumn.entity.schema}.${fromColumn.entity.name}.${fromColumn.name}->${toColumn.entity.schema}.${toColumn.entity.name}.${toColumn.name}`;
  }
  return `${fromColumn.entity.name}.${fromColumn.name}->${toColumn.entity.name}.${toColumn.name}`;
}

export function getHandleId(column: Column): string {
  if (column.entity.schema) {
    return `${column.entity.schema}.${column.entity.name}.${column.name}`;
  }
  return `${column.entity.name}.${column.name}`;
}

function generateNodes(entities: EntityStructure[]): Node<NodeData>[] {
  return entities.map((entity) => {
    return {
      id: getNodeId(entity),
      type: "table",
      data: entity,
      position: { x: 0, y: 0 },
    };
  });
}

function generateEdges(references: ColumnReference[]): Edge<EdgeData>[] {
  return references.map((reference) => {
    return {
      id: getEdgeId(reference),
      source: getNodeId(reference.from.entity),
      target: getNodeId(reference.to.entity),
      data: reference,
      // sourceHandle: `source-${getHandleId(reference.from)}`,
      // targetHandle: `target-${getHandleId(reference.to)}`,
      type: "floating",
    };
  });
}

export const useSchemaDiagram = defineStore("schema-diagram", () => {
  const {
    $reset: $resetVueFlow,
    addNodes,
    setNodes,
    nodes,
    addEdges,
    edges,
    fitView,
    viewport,
    zoomIn,
    zoomOut,
    zoomTo: vueFlowZoomTo,
    getNodes,
  } = useVueFlow();

  const { layout: layoutLayout } = useLayout();

  /**
   * Since we do some calculations when updating the entities, it is
   * recommended to use this as a readonly ref and use `add` to modify it.
   **/
  const entitiesRef = ref<EntityStructure[]>([]);

  /**
   * Add entities to the diagram. Use `await` or `.then()` to wait for the
   * nodes to be added.
   **/
  async function addEntities(entities: EntityStructure | EntityStructure[]) {
    if (!Array.isArray(entities)) {
      entities = [entities];
    }
    entitiesRef.value.push(...entities);
    const nodes = generateNodes(entities);
    addNodes(nodes);
  }

  async function addKeys(references: ColumnReference | ColumnReference[]) {
    if (!Array.isArray(references)) {
      references = [references];
    }
    addEdges(generateEdges(references));
  }

  function $reset() {
    entitiesRef.value = [];
    $resetVueFlow();
  }

  const zoomLevel = computed<string>(
    () => Math.round(viewport.value.zoom * 100) + "%",
  );

  function zoomTo(zoom: number) {
    vueFlowZoomTo(zoom / 100);
  }

  function layout() {
    setNodes(layoutLayout(nodes.value, edges.value, "LR"));
  }

  return {
    entities: entitiesRef,
    nodes,
    edges,
    addEntities,
    addKeys,
    $reset,
    fitView,
    zoomLevel,
    zoomIn,
    zoomOut,
    zoomTo,
    layout,
    getNodes,
  };
});
