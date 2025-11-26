import {
  useVueFlow,
  type Edge,
  type Node,
  getRectOfNodes,
  type GraphNode,
  getTransformForBounds,
} from "@vue-flow/core";
import { defineStore } from "pinia";
import { computed, nextTick, ref, shallowRef, type Ref } from "vue";
import { useLayout } from "./useLayout";
import _ from "lodash";
import mitt from "mitt";
import { generateImageFromElement } from "@/utils/image";
import type { Column, ColumnReference, Entity, EntityStructure, SchemaEntity, TableEntity, TableEntityStructure, ColumnStructure } from "@/utils/schema";

export type { ColumnStructure };

export type DiagramState = {
  version: 1;
  entities: {
    id: string;
    position: {
      x: number;
      y: number;
    };
    hidden: boolean;
  }[];
}

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
    nodes: untypedNodes,
    edges,
    getSelectedNodes,
    viewport,
    viewportRef,
    panOnDrag,
    elevateEdgesOnSelect,
    panOnScroll,
    zoomOnPinch,

    addNodes,
    setNodes,
    addEdges,
    addSelectedNodes,
    zoomIn,
    zoomOut,
    zoomTo: vueFlowZoomTo,
    setMinZoom,
    setViewport,
    fitView,
    findNode,

    onNodeDragStop,
    $reset: $resetVueFlow,
  } = useVueFlow();

  const emitter = mitt<{
    "force-recalculate-schemas": void;
    "nodes-updated-hidden": GraphNode<EntityStructure>[];
    "position-changed": void;
  }>();

  // Obtain the ts type
  const nodes: Ref<GraphNode<EntityStructure>[]> = untypedNodes;
  const generatingImage = shallowRef(false);

  const { layout: layoutGenerator } = useLayout();

  /** Using this outside the store is readonly! */
  const entitiesRef = ref<EntityStructure[]>([]);
  const showAllColumns = shallowRef(
    localStorage.getItem("show-all-columns") === "true",
  );

  /**
   * Add entities to the diagram. Use `await` or `.then()` to wait for the
   * nodes to be added.
   **/
  function addEntities(entities: EntityStructure | EntityStructure[]) {
    if (!Array.isArray(entities)) {
      entities = [entities];
    }
    entitiesRef.value.push(...entities);
    const nodes = generateNodes(entities);
    addNodes(nodes);
  }

  function addKeys(references: ColumnReference | ColumnReference[]) {
    if (!Array.isArray(references)) {
      references = [references];
    }
    addEdges(generateEdges(references));
  }

  function getDiagramState(): DiagramState {
    const entities: DiagramState['entities'] = [];

    for (const entity of entitiesRef.value) {
      const id = entity.type === "schema"
        ? getNodeId("schema", entity as SchemaEntity)
        : getNodeId("table", entity as TableEntity);
      const node = findNode(id);
      if (node) {
        entities.push({
          id,
          hidden: node.hidden ?? false,
          position: {
            x: node.position.x,
            y: node.position.y,
          },
        });
      }
    }

    return {
      version: 1,
      entities,
    }
  }

  function setDiagramState(state: DiagramState) {
    setNodes((nodes) => {
      return nodes.map((node) => {
        const entity = state.entities.find((e) => e.id === node.id)

        if (!entity) {
          return node;
        }

        return {
          ...node,
          position: {
            x: entity.position.x,
            y: entity.position.y,
          },
          hidden: entity.hidden,
        }
      })
    })

    nextTick(() => emitter.emit("force-recalculate-schemas"));
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

  function layoutSchema() {
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

  async function toggleHideSelectedEntities(hide?: boolean) {
    await toggleHideEntity(
      getSelectedNodes.value.map(node => node.data),
      hide
    );
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

    const selectedNodes = entities.map((e) => getNodeId("table", e));

    setNodes((nodes) => {
      return nodes.map((node) => {
        // Dont modify if it's a parent node (a.k.a schema entity).
        if (node.isParent) {
          return node;
        }

        // Dont modify if it's not the currently selected node.
        if (!selectedNodes.includes(node.id)) {
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
          // Deselect node if hidden
          selected: shouldHide ? false : node.selected,
        };
      });
    });

    // Loop again for hiding/showing schemas if needed
    setNodes((nodes) => {
      return nodes.map((node) => {
        // Schema is always parent
        if (node.isParent) {
          const shouldHide = !shouldShowSchema.has(node.id);
          return {
            ...node,
            hidden: shouldHide,
            // Deselect node if hidden
            selected: shouldHide ? false : node.selected,
          };
        }
        return node;
      });
    });

    if (affectedNodes.length > 0) {
      await nextTick();
      emitter.emit("nodes-updated-hidden", affectedNodes);
    }
  }

  function selectEntity(entity: EntityStructure) {
    const id = entity.type === "schema"
      ? getNodeId("schema", entity as SchemaEntity)
      : getNodeId("table", entity as TableEntity);
    const node = nodes.value.find((n) => n.id === id)
    if (node) {
      addSelectedNodes([node]);
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
    $resetVueFlow();
    initialize();
  }

  let unsubscribe: Function | undefined;

  function initialize() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = undefined;
    }

    entitiesRef.value = [];
    panOnDrag.value = [1, 2];
    elevateEdgesOnSelect.value = true;
    panOnScroll.value = true;
    zoomOnPinch.value = true;
    setMinZoom(0.01);

    const { off } = onNodeDragStop(() => {
      emitter.emit("position-changed");
    });
    unsubscribe = off;
  }

  async function toggleShowAllColumns(showAll?: boolean) {
    showAllColumns.value = showAll ?? !showAllColumns.value;

    localStorage.setItem("show-all-columns", showAllColumns.value.toString());

    // Wait for Vue to update the DOM before measuring
    await nextTick();

    // First, reset the sizes in the DOM
    setNodes((nodes) =>
      nodes.map((node) => {
        if (!node.hidden && node.data.type === "table") {
          return {
            ...node,
            style: { width: 'auto', height: 'auto' },
          };
        }
        return node;
      }),
    );

    await nextTick();

    // Second, get the actual sizes from the DOM and persist
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

            return {
              ...node,
              style: {
                width: `${width}px`,
                height: `${height}px`,
              },
              dimensions: { width, height },
            };
          }
        }
        return node;
      }),
    );

    emitter.emit("force-recalculate-schemas");
  }

  return {
    entities: computed(() => entitiesRef.value),
    hiddenEntities: computed(() => {
      const ret = [];
      for (const node of nodes.value as GraphNode<EntityStructure>[]) {
        if (node.hidden) {
          ret.push(node.data);
        }
      }
      return ret;
    }),
    showAllColumns: computed(() => showAllColumns.value),
    generatingImage: computed(() => generatingImage.value),
    viewport: computed(() => viewport.value),
    rectOfDiagram: computed(() => getRectOfNodes(nodes.value)),
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
    thicknessMultipler: computed(() => {
      // https://www.desmos.com/calculator/yyzftehsmc
      //
      // x = 1/y - 1/2 + 0.95
      //
      // where:
      // x = multiplier
      // y = zoom
      return 1 / viewport.value.zoom - 1 / 2 + 0.95;
    }),
    nodes,
    emitter,

    initialize,
    addEntities,
    selectEntity,
    setDiagramState,
    addKeys,
    toggleHideEntity,
    toggleHideSelectedEntities,
    toggleShowAllColumns,
    zoomIn,
    zoomOut,
    zoomTo,
    layout,
    layoutSchema,
    generateImage,
    setViewport,
    fitView,
    getDiagramState,
    $reset,
  };
});
