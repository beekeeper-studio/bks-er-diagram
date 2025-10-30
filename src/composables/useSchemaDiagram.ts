import { useVueFlow, type Edge, type Node } from "@vue-flow/core";
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { useLayout } from "./useLayout";

export type EntityIdentifier = {
  name: string;
  schema?: string;
};

export type ColumnReferenceIdentifier = {
  entity: EntityIdentifier;
  column: {
    name: string;
  };
};

export type EntitySchema = EntityIdentifier & {
  type: "table";
  columns: {
    name: string;
    type?: string;
    handleId: string;
  }[];
};

export type ColumnReference = {
  from: ColumnReferenceIdentifier;
  to: ColumnReferenceIdentifier;
};

function getNodeId(entity: EntityIdentifier): string {
  return entity.schema ? `${entity.schema}.${entity.name}` : entity.name;
}

function getEdgeId({ from, to }: ColumnReference): string {
  if (from.entity.schema) {
    return `${from.entity.schema}.${from.entity.name}.${from.column.name} -> ${to.entity.schema}.${to.entity.name}.${to.column.name}`;
  }
  return `${from.entity.name}.${from.column.name} -> ${to.entity.name}.${to.column.name}`;
}

export function getHandleId(column: ColumnReferenceIdentifier): string {
  if (column.entity.schema) {
    return `${column.entity.schema}.${column.entity.name}.${column.column.name}`;
  }
  return `${column.entity.name}.${column.column.name}`;
}

function generateNodes(entities: EntitySchema[]): Node<EntitySchema>[] {
  return entities.map((entity) => {
    return {
      id: getNodeId(entity),
      type: "table",
      data: entity,
      position: { x: 0, y: 0 },
    };
  });
}

function generateEdges(references: ColumnReference[]): Edge[] {
  return references.map((reference) => {
    return {
      id: getEdgeId(reference),
      source: getNodeId(reference.from.entity),
      target: getNodeId(reference.to.entity),
      sourceHandle: `source-${getHandleId(reference.from)}`,
      targetHandle: `target-${getHandleId(reference.to)}`,
      type: "smoothstep",
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
    onNodesChange,
    onEdgesChange,
    onError,
  } = useVueFlow();

  const { layout: layoutLayout } = useLayout();

  /**
   * Since we do some calculations when updating the entities, it is
   * recommended to use this as a readonly ref and use `add` to modify it.
   **/
  const entitiesRef = ref<EntitySchema[]>([]);

  /**
   * Add entities to the diagram. Use `await` or `.then()` to wait for the
   * nodes to be added.
   **/
  async function addEntities(entities: EntitySchema | EntitySchema[]) {
    if (!Array.isArray(entities)) {
      entities = [entities];
    }
    entitiesRef.value.push(...entities);
    const nodes = generateNodes(entities);
    addNodes(nodes);
    await waitForNodesChange();
  }

  async function addReferences(
    references: ColumnReference | ColumnReference[],
  ) {
    if (!Array.isArray(references)) {
      references = [references];
    }
    addEdges(generateEdges(references));
  }

  function waitForNodesChange() {
    return new Promise<void>((resolve, reject) => {
      let changeWatcher: { off: () => void } | null = null;
      let errorWatcher: { off: () => void } | null = null;

      const cleanup = () => {
        changeWatcher?.off();
        changeWatcher = null;
        errorWatcher?.off();
        errorWatcher = null;
      };

      changeWatcher = onNodesChange(() => {
        cleanup();
        resolve();
      });

      errorWatcher = onError((err: unknown) => {
        cleanup();
        reject(err ?? new Error("Unknown error"));
      });
    });
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
    addReferences,
    $reset,
    fitView,
    zoomLevel,
    zoomIn,
    zoomOut,
    zoomTo,
    layout,
  };
});
