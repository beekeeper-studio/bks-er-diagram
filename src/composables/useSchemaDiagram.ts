import {
  useVueFlow,
  type Edge,
  type Node,
  getRectOfNodes,
  type GraphNode,
} from "@vue-flow/core";
import { defineStore } from "pinia";
import { computed, ref, shallowRef, watch, type Ref } from "vue";
import { useLayout } from "./useLayout";
import _ from "lodash";
import mitt from "mitt";

export type TableEntity = {
  name: string;
  schema?: string;
};

export type SchemaEntity = {
  name: string;
};

export type Entity = TableEntity | SchemaEntity;

export type Column = {
  entity: TableEntity;
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

export type EntityStructure = TableEntityStructure | SchemaEntityStructure;

export type TableEntityStructure = TableEntity & {
  type: "table";
  columns: ColumnStructure[];
  isComposite: boolean;
};

export type SchemaEntityStructure = SchemaEntity & {
  type: "schema";
  entities: EntityStructure[];
};

export type ColumnReference = {
  from: Column;
  to: Column;
};

export type NodeData = EntityStructure;

export type EdgeData = ColumnReference;

export function getNodeId(type: "schema", entity: SchemaEntity): string;
export function getNodeId(type: "table", entity: TableEntity): string;
export function getNodeId(type: "table" | "schema", entity: Entity): string {
  if (type === "schema") {
    return entity.name;
  }
  // @ts-expect-error incorrect type
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
      // @ts-expect-error
      id: getNodeId(entity.type, entity),
      type: entity.type,
      data: entity,
      position: { x: 0, y: 0 },
      // Schema is hidden by default
      // hidden: entity.type === "schema" ? true : false,
      expandParent: true,
      parentNode:
        entity.type === "table" && entity.schema
          ? getNodeId("schema", { name: entity.schema })
          : undefined,
      parentNodeId:
        entity.type === "table" && entity.schema
          ? getNodeId("schema", { name: entity.schema })
          : undefined,
      parentId:
        entity.type === "table" && entity.schema
          ? getNodeId("schema", { name: entity.schema })
          : undefined,
    };
  });
}

function generateEdges(references: ColumnReference[]): Edge<EdgeData>[] {
  return references.map((reference) => {
    return {
      id: getEdgeId(reference),
      source: getNodeId("table", reference.from.entity),
      target: getNodeId("table", reference.to.entity),
      data: reference,
      type: "floating",
    };
  });
}

export const useSchemaDiagram = defineStore("schema-diagram", () => {
  const {
    $reset: $resetVueFlow,
    addNodes,
    setNodes,
    nodes: untypedNodes,
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

  const emitter = mitt<{
    "force-recalculate": void;
    "node-updated-hidden": GraphNode<EntityStructure>;
  }>();

  // Obtain the ts type
  const nodes: Ref<GraphNode<EntityStructure>[]> = untypedNodes;

  const { layout: layoutGenerator } = useLayout();

  /**
   * Since we do some calculations when updating the entities, it is
   * recommended to use this as a readonly ref and use `addEntities` to modify it.
   **/
  const entitiesRef = ref<EntityStructure[]>([]);
  const showAllColumns = shallowRef(
    localStorage.getItem("show-all-columns") === "true",
  );

  const selectedNodes = computed<string[]>(() =>
    getSelectedNodes.value.map((node) => node.id),
  );

  const selectedEntities = computed<EntityStructure[]>(() =>
    getSelectedNodes.value.map((node) => node.data),
  );

  /**
   * You can make things thicker when user zooms out with this multipler. To
   * use it, multiply the desired thickness with this multiplier.
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

  const hiddenEntities = computed(() => {
    const ret = [];
    for (const node of nodes.value as GraphNode<EntityStructure>[]) {
      if (node.hidden) {
        ret.push(node.data);
      }
    }
    return ret;
  });

  const zoomLevel = computed<string>(
    () => Math.round(viewport.value.zoom * 100) + "%",
  );

  const zoomValue = computed(() => viewport.value.zoom);

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

  function zoomTo(zoom: number) {
    vueFlowZoomTo(zoom / 100);
  }

  function layout() {
    const groupedEntities = _.groupBy(
      nodes.value.filter(
        (node): node is GraphNode<TableEntityStructure> =>
          node.data.type === "table",
      ),
      (node) => node.data.schema || "default",
    );
    const nodeMap = new Map<string, Node<TableEntityStructure>>();
    for (const [, nodes] of Object.entries(groupedEntities)) {
      const getPositionedNode = layoutGenerator(nodes, edges.value, "LR");
      for (const node of nodes) {
        nodeMap.set(node.id, getPositionedNode(node));
      }
    }
    setNodes((nodes) => {
      return nodes.map((node) => {
        if (nodeMap.has(node.id)) {
          return nodeMap.get(node.id)!;
        }
        return node;
      });
    });
  }

  async function layoutSchema() {
    emitter.emit("force-recalculate");
    setNodes((nodes) => {
      let offset = 0;
      return nodes.map((node) => {
        if (node.data.type === "schema") {
          node.position = {
            x: offset,
            y: 0,
          };
          offset += node.dimensions.width + 100;
        }
        return node;
      });
    });
  }

  function toggleHideEntity(entity: Entity, hide?: boolean) {
    const node = nodes.value.find(
      // @ts-expect-error
      (n) => n.id === getNodeId(entity.type, entity),
    );
    if (node) {
      let affectedNode: GraphNode<EntityStructure> | undefined;
      setNodes((nodes) => {
        return nodes.map((n) => {
          if (n.id === node.id) {
            const shouldHide = typeof hide === "boolean" ? hide : !n.hidden;
            n.hidden = shouldHide;
            n.selected = false;
            affectedNode = n;
          }
          return n;
        });
      });
      if (affectedNode) {
        emitter.emit("node-updated-hidden", affectedNode);
      }
    }
  }

  function $reset() {
    entitiesRef.value = [];
    $resetVueFlow();
  }

  watch(showAllColumns, () => {
    localStorage.setItem("show-all-columns", showAllColumns.value.toString());
  });

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
    layoutSchema,
    getNodes,
    selectedNodes,
    selectedEntities,
    thicknessMultipler,
    showAllColumns,
    viewport: computed(() => viewport.value),
    rectOfDiagram,
    setViewport,
    hiddenEntities,
    toggleHideEntity,
    emitter,
  };
});
