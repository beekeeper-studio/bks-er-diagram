import {
  useVueFlow,
  type Edge,
  type Node,
  getRectOfNodes,
  type GraphNode,
  getTransformForBounds,
} from "@vue-flow/core";
import { defineStore } from "pinia";
import { computed, nextTick, ref, shallowRef, watch, type Ref } from "vue";
import { useLayout } from "./useLayout";
import _ from "lodash";
import mitt from "mitt";
import { generateImageFromElement } from "@/utils/image";

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

export type GenerateImageOptions = {
  /** The scale of the image. Defaults to 1. */
  scale?: number;
};

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
    viewportRef,
  } = useVueFlow();

  const emitter = mitt<{
    "force-recalculate-schemas": void;
    "nodes-updated-hidden": GraphNode<EntityStructure>[];
  }>();

  // Obtain the ts type
  const nodes: Ref<GraphNode<EntityStructure>[]> = untypedNodes;
  const generatingImage = shallowRef(false);

  const { layout: layoutGenerator } = useLayout();

  /**
   * Since we do some calculations when updating the entities, it is
   * recommended to use this as a readonly ref and the utility functions.
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
    emitter.emit("force-recalculate-schemas");
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

  async function toggleHideEntity(
    entities: TableEntity[] | TableEntity,
    hide?: boolean,
  ) {
    if (!Array.isArray(entities)) {
      entities = [entities];
    }

    const affectedNodes: GraphNode<TableEntityStructure>[] = [];
    const shouldShowSchema = new Set<string>();

    for (const entity of entities) {
      const selectedNode = nodes.value.find(
        (n) => n.id === getNodeId("table", entity),
      ) as GraphNode<TableEntityStructure>;

      if (!selectedNode) {
        continue;
      }

      setNodes((nodes) => {
        return nodes.map((node) => {
          // Dont modify if it's a parent node (a.k.a schema entity).
          if (node.isParent) {
            return node;
          }

          // Dont modify if it's not the currently selected node.
          if (node.id !== selectedNode.id) {
            // But if this node is not hidden, the parent should not be
            // hidden too.
            if (node.parentNode && !node.hidden) {
              shouldShowSchema.add(node.parentNode);
            }
            return node;
          }

          // It's the currently selected node from here onwards.

          const shouldHide =
            typeof hide === "boolean" ? hide : !node.hidden;

          if (node.parentNode && !shouldHide) {
            shouldShowSchema.add(node.parentNode);
          }

          affectedNodes.push(node);

          return {
            ...node,
            hidden: shouldHide,
            selected: false,
          };
        });
      });
    }

    // Loop again for hiding/showing schemas if needed
    setNodes((nodes) => {
      return nodes.map((node) => {
        // Schema is always parent
        if (node.isParent) {
          return {
            ...node,
            hidden: !shouldShowSchema.has(node.id),
            selected: false,
          };
        }
        return node;
      });
    });

    if (affectedNodes.length > 0) {
      nextTick(() => {
        emitter.emit("nodes-updated-hidden", affectedNodes);
      });
    }
  }

  async function generateImage(
    options?: GenerateImageOptions,
  ): Promise<string> {
    generatingImage.value = true;
    await nextTick();

    // Get bounds of all visible nodes
    const visibleNodes = nodes.value.filter((node) => !node.hidden);
    const rect = getRectOfNodes(visibleNodes);

    const width = rect.width;
    const height = rect.height;

    // Calculate transform to fit diagram in the image with padding
    // The transform will center the diagram and scale it appropriately
    const transform = getTransformForBounds(
      rect,
      width,
      height,
      0.1, // minZoom
      2, // maxZoom
    );

    const transformPane = viewportRef.value!.querySelector(
      ".vue-flow__transformationpane",
    ) as HTMLElement;

    try {
      const pngWithSvg = await generateImageFromElement({
        element: transformPane,
        x: transform.x,
        y: transform.y,
        zoom: transform.zoom,
        width,
        height,
        scale: options?.scale || 1,
      });
      generatingImage.value = false;
      return pngWithSvg;
    } catch (e) {
      generatingImage.value = false;
      throw e;
    }
  }

  function $reset() {
    entitiesRef.value = [];
    $resetVueFlow();
  }

  watch(showAllColumns, async () => {
    localStorage.setItem("show-all-columns", showAllColumns.value.toString());
    // Wait for Vue to update the DOM before measuring
    await nextTick();

    // Update node dimensions when showAllColumns changes
    setNodes((nodes) =>
      nodes.map((node) => {
        if (!node.hidden && node.data.type === "table") {
          const nodeElement = viewportRef.value?.querySelector(
            `.vue-flow__node[data-id="${node.id}"] > div`,
          ) as HTMLElement;

          if (nodeElement) {
            // Measure the new size from DOM
            const width = nodeElement.offsetWidth;
            const height = nodeElement.offsetHeight;

            // Update both node.width/height (for inline styles) and node.dimensions (for calculations)
            return {
              ...node,
              width,
              height,
              dimensions: {
                width,
                height,
              },
            };
          }
        }
        return node;
      }),
    );

    emitter.emit("force-recalculate-schemas");
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
    generatePng: generateImage,
    generatingImage: computed(() => generatingImage.value),
  };
});
