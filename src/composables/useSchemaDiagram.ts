import {
  useVueFlow,
  type Edge,
  type Node,
  getRectOfNodes,
} from "@vue-flow/core";
import { defineStore } from "pinia";
import { computed, ref, shallowRef, watch } from "vue";
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
  primaryKey: boolean;
  foreignKey: boolean;
  uniqueKey: boolean;
  nullable: boolean;
  ordinalPosition: number;
};

export type EntityStructure = Entity & {
  type: "table";
  columns: ColumnStructure[];
  isComposite: boolean;
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
      type: "floating",
    };
  });
}
// public.payment.customer_id->public.customer.customer_id

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
    setViewport,
    zoomIn,
    zoomOut,
    zoomTo: vueFlowZoomTo,
    getNodes,
    getSelectedNodes,
  } = useVueFlow();

  const { layout: layoutLayout } = useLayout();

  /**
   * Since we do some calculations when updating the entities, it is
   * recommended to use this as a readonly ref and use `add` to modify it.
   **/
  const entitiesRef = ref<EntityStructure[]>([]);
  const showAllColumns = shallowRef(
    localStorage.getItem("show-all-columns") === "true",
  );

  watch(showAllColumns, () => {
    localStorage.setItem("show-all-columns", showAllColumns.value.toString());
  });

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

  const zoomValue = computed(() => viewport.value.zoom);

  function zoomTo(zoom: number) {
    vueFlowZoomTo(zoom / 100);
  }

  function layout() {
    setNodes(layoutLayout(nodes.value, edges.value, "LR"));
  }

  const selectedNodes = computed<string[]>(() =>
    getSelectedNodes.value.map((node) => node.id),
  );

  const selectedEntities = computed<EntityStructure[]>(() =>
    getSelectedNodes.value.map((node) => node.data),
  );

  /**
   * You can make things thicker when user zooms out with this multipler. To
   * use, multiply the desired thickness with this multiplier.
   *
   * @example
   *
   * - My border is 2px thick
   * - But when zoomed out, it's hardly visible
   *
   * No worries!
   *
   * ```html
   * <div class="node" :style="{ 'border-width': 'calc(2px * ${thicknessMultipler})' }"></div>
   * ```
   */
  const thicknessMultipler = computed(() => {
    // https://www.desmos.com/calculator/yyzftehsmc
    //
    // x = 1/y - 1/2 + 0.95
    //
    // where:
    // x = multiplier
    // y = zoom
    return 1 / viewport.value.zoom - 1 / 2 + 0.95;
  });

  const rectOfDiagram = computed(() => getRectOfNodes(nodes.value));

  return {
    entities: entitiesRef,
    nodes,
    edges,
    addEntities,
    addKeys,
    $reset,
    fitView,
    zoomValue,
    zoomLevel,
    zoomIn,
    zoomOut,
    zoomTo,
    layout,
    getNodes,
    selectedNodes,
    selectedEntities,
    thicknessMultipler,
    showAllColumns,
    viewport: computed(() => viewport.value),
    rectOfDiagram,
    setViewport,
  };
});
