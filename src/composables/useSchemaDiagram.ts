import {
  useVueFlow,
  type Edge,
  type Node,
  getRectOfNodes,
  type GraphNode,
  getTransformForBounds,
  type UpdateNodeDimensionsParams,
  useNode,
} from "@vue-flow/core";
import { defineStore } from "pinia";
import { computed, nextTick, ref, shallowRef, watch, type Ref } from "vue";
import { useLayout } from "./useLayout";
import _ from "lodash";
import mitt from "mitt";
import { toPng } from "html-to-image";
import materialSymbolsFontUrl from "@material-symbols/font-400/material-symbols-outlined.woff2?url";
import { getTheme } from "@/plugins/Theme";

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
}

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
    "node-updated-hidden": GraphNode<EntityStructure>;
  }>();

  // Obtain the ts type
  const nodes: Ref<GraphNode<EntityStructure>[]> = untypedNodes;
  const generatingImage = shallowRef(false);

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

  async function generateImage(options?: GenerateImageOptions): Promise<string> {
    generatingImage.value = true;
    await nextTick();

    // Get bounds of all visible nodes
    const visibleNodes = nodes.value.filter((node) => !node.hidden);
    const rect = getRectOfNodes(visibleNodes);

    const imageWidth = rect.width;
    const imageHeight = rect.height;

    // Calculate transform to fit diagram in the image with padding
    // The transform will center the diagram and scale it appropriately
    const transform = getTransformForBounds(
      rect,
      imageWidth,
      imageHeight,
      0.1, // minZoom
      2, // maxZoom
    );

    const transformPane = viewportRef.value!.querySelector(
      ".vue-flow__transformationpane",
    ) as HTMLElement;

    // Try to load font using XMLHttpRequest which may handle plugin:// protocol
    let fontEmbedCSS = "";
    try {
      const fontBase64 = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", materialSymbolsFontUrl, true);
        xhr.responseType = "arraybuffer";
        xhr.onload = () => {
          if (xhr.status === 200) {
            const bytes = new Uint8Array(xhr.response);
            let binary = "";
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);
            resolve(`data:font/woff2;base64,${base64}`);
          } else {
            reject(new Error(`Failed to load font: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("XHR error"));
        xhr.send();
      });

      fontEmbedCSS = `
        @font-face {
          font-family: "Material Symbols Outlined";
          font-style: normal;
          font-weight: 400;
          font-display: block;
          src: url("${fontBase64}") format("woff2");
        }`;
    } catch (error) {
      console.warn("Failed to embed Material Symbols font:", error);
    }

    try {
      const raw = await toPng(transformPane, {
        backgroundColor: getTheme().diagramBg,
        width: imageWidth,
        height: imageHeight,
        style: {
          width: `${imageWidth}px`,
          height: `${imageHeight}px`,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
        },
        pixelRatio: options?.scale || 1,
        fontEmbedCSS,
      });
      const pngWithSvg = await addSvgBelowPng({
        pngBase64: raw,
        svgString: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" id="Layer_1" x="0px" y="0px" viewBox="0 0 924 146.3" style="enable-background:new 0 0 924 146.3;" xml:space="preserve"><script xmlns=""/>
<style type="text/css">
	.st0{fill:#F9D83C;}
	.st1{fill:#FFFFFF;}
</style>
<g>
	<g>
		<path class="st0" d="M121.3,28.2L77.7,3.1C70.6-1,61.9-1,54.9,3.1L43.5,9.7V39v6.7v27.5c0,8.1,4.3,15.7,11.4,19.8    c3.5,2,7.5,3.1,11.4,3.1s7.9-1,11.4-3.1l0,0c7.1-4.1,11.4-11.6,11.4-19.8c0-8.1-4.3-15.7-11.4-19.8l0,0c-3.5-2-7.5-3.1-11.4-3.1    V36c3.9,0,7.9,1,11.4,3.1l12.4,7.2c7.1,4.1,11.4,11.6,11.4,19.8v14.3c0,8.1-4.3,15.7-11.4,19.8l-12.4,7.2c-3.5,2-7.5,3.1-11.4,3.1    s-7.9-1-11.4-3.1l-12.4-7.2c-7.1-4.1-11.4-11.6-11.4-19.8v-7.2V66V47.5V16.8L11.4,28.2C4.3,32.3,0,39.8,0,48v50.3    c0,8.1,4.3,15.7,11.4,19.8L55,143.2c7.1,4.1,15.8,4.1,22.8,0l43.6-25.1c7.1-4.1,11.4-11.6,11.4-19.8V48    C132.7,39.8,128.3,32.3,121.3,28.2z M52.3,55.2c-1.3,1-2.4,2.1-3.4,3.3v-16l3.4-2V55.2z M61,51c-1.2,0.3-2.3,0.6-3.4,1.1V37.7    c1.1-0.5,2.3-0.8,3.4-1.1V51z"/>
	</g>
	<g>
		<path class="st1" d="M205,90.4c0,3.7-0.9,6.7-2.8,9.2c-1.9,2.5-4.4,4.3-7.6,5.6c-3.2,1.3-6.7,1.9-10.4,1.9h-31.3V42.3h34.7    c3,0,5.7,0.8,7.9,2.4c2.2,1.6,3.9,3.7,5.1,6.2c1.2,2.5,1.8,5.2,1.8,7.9c0,3.1-0.8,6.1-2.4,8.9c-1.6,2.8-3.9,4.9-6.9,6.2    c3.7,1.1,6.6,3.1,8.8,5.9C203.9,82.7,205,86.2,205,90.4z M165.4,53.1v16.3h16.8c1.4,0,2.7-0.3,3.8-1c1.2-0.7,2.1-1.6,2.8-2.8    c0.7-1.2,1-2.7,1-4.4c0-1.6-0.3-3.1-1-4.3c-0.6-1.2-1.5-2.2-2.6-2.8c-1.1-0.7-2.3-1-3.6-1C182.6,53.1,165.4,53.1,165.4,53.1z     M192.3,88c0-1.6-0.3-3.1-1-4.4s-1.6-2.3-2.7-3.1c-1.1-0.8-2.4-1.1-3.9-1.1h-19.3v17.1h18.7c1.5,0,2.9-0.4,4.2-1.1    c1.2-0.8,2.2-1.8,3-3.1C192,90.9,192.3,89.5,192.3,88z"/>
		<path class="st1" d="M235.9,108c-3.8,0-7.3-0.6-10.4-1.9c-3.1-1.3-5.7-3.1-7.9-5.3c-2.2-2.3-3.9-4.8-5.1-7.8    c-1.2-2.9-1.8-6-1.8-9.2c0-4.5,1-8.6,3.1-12.4c2-3.7,5-6.7,8.8-9c3.8-2.3,8.3-3.4,13.5-3.4s9.7,1.1,13.4,3.4s6.6,5.2,8.5,8.9    c2,3.7,3,7.7,3,12c0,0.7,0,1.5-0.1,2.2c-0.1,0.8-0.1,1.4-0.2,1.9h-37c0.2,2.4,1,4.5,2.1,6.2c1.2,1.8,2.7,3.1,4.6,4.1    c1.9,0.9,3.8,1.4,6,1.4c2.4,0,4.7-0.6,6.9-1.8c2.2-1.2,3.6-2.8,4.4-4.7l10.5,2.9c-1.2,2.4-2.8,4.6-5,6.5s-4.7,3.4-7.6,4.4    C242.6,107.5,239.4,108,235.9,108z M223.4,79.6h25c-0.2-2.4-0.9-4.4-2.1-6.2c-1.1-1.8-2.6-3.1-4.4-4.1c-1.8-1-3.9-1.5-6.1-1.5    c-2.2,0-4.2,0.5-6,1.5s-3.3,2.3-4.4,4.1S223.6,77.2,223.4,79.6z"/>
		<path class="st1" d="M290.5,108c-3.8,0-7.3-0.6-10.4-1.9s-5.7-3.1-7.9-5.3c-2.2-2.3-3.9-4.8-5.1-7.8c-1.2-2.9-1.8-6-1.8-9.2    c0-4.5,1-8.6,3.1-12.4c2-3.7,5-6.7,8.8-9c3.8-2.3,8.3-3.4,13.5-3.4s9.7,1.1,13.4,3.4c3.7,2.3,6.6,5.2,8.5,8.9c2,3.7,3,7.7,3,12    c0,0.7,0,1.5-0.1,2.2c-0.1,0.8-0.1,1.4-0.2,1.9h-37c0.2,2.4,1,4.5,2.1,6.2c1.2,1.8,2.7,3.1,4.6,4.1c1.9,0.9,3.8,1.4,6,1.4    c2.4,0,4.7-0.6,6.9-1.8c2.2-1.2,3.6-2.8,4.4-4.7l10.5,2.9c-1.2,2.4-2.8,4.6-5,6.5s-4.7,3.4-7.6,4.4C297.3,107.5,294,108,290.5,108    z M278,79.6h25c-0.2-2.4-0.9-4.4-2.1-6.2c-1.1-1.8-2.6-3.1-4.4-4.1s-3.9-1.5-6.1-1.5s-4.2,0.5-6,1.5s-3.3,2.3-4.4,4.1    S278.3,77.2,278,79.6z"/>
		<path class="st1" d="M355.7,107.1l-14-20.5l-6.5,6.3V107H323V40.5h12.2V81l19.3-21.3h13l-17.8,20.1l19.1,27.3    C368.8,107.1,355.7,107.1,355.7,107.1z"/>
		<path class="st1" d="M393.6,108c-3.8,0-7.3-0.6-10.4-1.9s-5.7-3.1-7.9-5.3c-2.2-2.3-3.9-4.8-5.1-7.8c-1.2-2.9-1.8-6-1.8-9.2    c0-4.5,1-8.6,3.1-12.4c2-3.7,5-6.7,8.8-9c3.8-2.3,8.3-3.4,13.5-3.4s9.7,1.1,13.4,3.4c3.7,2.3,6.6,5.2,8.5,8.9c2,3.7,3,7.7,3,12    c0,0.7,0,1.5-0.1,2.2c-0.1,0.8-0.1,1.4-0.2,1.9h-37c0.2,2.4,1,4.5,2.1,6.2c1.2,1.8,2.7,3.1,4.6,4.1c1.9,0.9,3.8,1.4,6,1.4    c2.4,0,4.7-0.6,6.9-1.8c2.2-1.2,3.6-2.8,4.4-4.7l10.5,2.9c-1.2,2.4-2.8,4.6-5,6.5s-4.7,3.4-7.6,4.4    C400.4,107.5,397.2,108,393.6,108z M381.1,79.6h25c-0.2-2.4-0.9-4.4-2.1-6.2c-1.1-1.8-2.6-3.1-4.4-4.1s-3.9-1.5-6.1-1.5    s-4.2,0.5-6,1.5s-3.3,2.3-4.4,4.1C382.1,75.2,381.4,77.2,381.1,79.6z"/>
		<path class="st1" d="M448.3,108c-3.8,0-7.3-0.6-10.4-1.9s-5.7-3.1-7.9-5.3c-2.2-2.3-3.9-4.8-5.1-7.8c-1.2-2.9-1.8-6-1.8-9.2    c0-4.5,1-8.6,3.1-12.4c2-3.7,5-6.7,8.8-9c3.8-2.3,8.3-3.4,13.5-3.4s9.7,1.1,13.4,3.4c3.7,2.3,6.6,5.2,8.5,8.9c2,3.7,3,7.7,3,12    c0,0.7,0,1.5-0.1,2.2c-0.1,0.8-0.1,1.4-0.2,1.9h-37c0.2,2.4,1,4.5,2.1,6.2c1.2,1.8,2.7,3.1,4.6,4.1c1.9,0.9,3.8,1.4,6,1.4    c2.4,0,4.7-0.6,6.9-1.8c2.2-1.2,3.6-2.8,4.4-4.7l10.5,2.9c-1.2,2.4-2.8,4.6-5,6.5s-4.7,3.4-7.6,4.4C455,107.5,451.8,108,448.3,108    z M435.8,79.6h25c-0.2-2.4-0.9-4.4-2.1-6.2c-1.1-1.8-2.6-3.1-4.4-4.1s-3.9-1.5-6.1-1.5s-4.2,0.5-6,1.5s-3.3,2.3-4.4,4.1    C436.7,75.2,436,77.2,435.8,79.6z"/>
		<path class="st1" d="M509.4,108c-3.7,0-7-0.8-9.8-2.5s-5-3.9-6.6-6.7v27.7h-12.2V59.7h10.7v8.2c1.8-2.8,4.1-4.9,6.9-6.5    s6-2.4,9.6-2.4c3.2,0,6.2,0.6,8.9,1.9c2.7,1.3,5.1,3,7.1,5.3s3.6,4.8,4.7,7.8c1.1,2.9,1.7,6.1,1.7,9.4c0,4.6-0.9,8.7-2.7,12.5    c-1.8,3.7-4.3,6.7-7.4,8.9C517.1,106.9,513.5,108,509.4,108z M505.3,97.6c1.9,0,3.6-0.4,5.1-1.2c1.5-0.8,2.8-1.8,4-3.2    c1.1-1.3,2-2.9,2.6-4.6s0.9-3.5,0.9-5.3c0-2-0.3-3.8-1-5.5c-0.6-1.7-1.6-3.1-2.8-4.4s-2.6-2.3-4.2-3s-3.4-1.1-5.2-1.1    c-1.2,0-2.3,0.2-3.5,0.6s-2.3,0.9-3.4,1.6s-2.1,1.5-2.9,2.5s-1.4,2-1.8,3.1v11.1c0.7,1.7,1.7,3.3,3,4.7c1.2,1.4,2.7,2.5,4.3,3.3    C501.9,97.2,503.6,97.6,505.3,97.6z"/>
		<path class="st1" d="M560.8,108c-3.8,0-7.3-0.6-10.4-1.9c-3.1-1.3-5.7-3.1-7.9-5.3c-2.2-2.3-3.9-4.8-5.1-7.8    c-1.2-2.9-1.8-6-1.8-9.2c0-4.5,1-8.6,3.1-12.4c2-3.7,5-6.7,8.8-9c3.8-2.3,8.3-3.4,13.5-3.4s9.7,1.1,13.4,3.4s6.6,5.2,8.5,8.9    c2,3.7,3,7.7,3,12c0,0.7,0,1.5-0.1,2.2c-0.1,0.8-0.1,1.4-0.2,1.9h-37c0.2,2.4,1,4.5,2.1,6.2c1.2,1.8,2.7,3.1,4.6,4.1    c1.9,0.9,3.8,1.4,6,1.4c2.4,0,4.7-0.6,6.9-1.8c2.2-1.2,3.6-2.8,4.4-4.7l10.5,2.9c-1.2,2.4-2.8,4.6-5,6.5s-4.7,3.4-7.6,4.4    C567.6,107.5,564.3,108,560.8,108z M548.3,79.6h25c-0.2-2.4-0.9-4.4-2.1-6.2c-1.1-1.8-2.6-3.1-4.4-4.1c-1.8-1-3.9-1.5-6.1-1.5    c-2.2,0-4.2,0.5-6,1.5s-3.3,2.3-4.4,4.1C549.2,75.2,548.5,77.2,548.3,79.6z"/>
		<path class="st1" d="M621.8,69.9c-3.7,0-7,0.7-9.9,2.1s-5,3.5-6.3,6.2v28.9h-12.2V59.7h11.2v9.8c1.7-3.3,3.9-5.9,6.5-7.8    c2.6-1.9,5.4-2.9,8.3-3.1c0.7,0,1.2,0,1.6,0c0.4,0,0.7,0,0.9,0.1L621.8,69.9L621.8,69.9z"/>
		<path class="st1" d="M688.3,59.3c-0.4-0.4-1.2-1-2.3-1.7s-2.5-1.4-4.1-2.1c-1.6-0.7-3.4-1.3-5.2-1.8c-1.9-0.5-3.8-0.8-5.7-0.8    c-3.4,0-6,0.6-7.7,1.9c-1.7,1.3-2.6,3.1-2.6,5.4c0,1.8,0.5,3.1,1.6,4.2c1.1,1,2.7,1.9,4.9,2.6s4.9,1.5,8.2,2.4    c4.3,1,8,2.3,11.1,3.8s5.5,3.4,7.2,5.8s2.5,5.6,2.5,9.5c0,3.5-0.6,6.4-1.9,8.9c-1.3,2.5-3,4.4-5.3,5.9s-4.8,2.6-7.7,3.3    c-2.9,0.7-5.9,1-9.1,1c-3.2,0-6.4-0.3-9.7-1c-3.2-0.7-6.3-1.6-9.3-2.9c-3-1.2-5.7-2.8-8.2-4.5l5.6-10.9c0.5,0.5,1.5,1.3,2.9,2.1    c1.4,0.9,3.1,1.8,5.1,2.6c2,0.9,4.2,1.6,6.6,2.2c2.4,0.6,4.8,0.9,7.2,0.9c3.4,0,6-0.6,7.8-1.7s2.6-2.8,2.6-4.9    c0-1.9-0.7-3.5-2.1-4.5c-1.4-1.1-3.3-2-5.8-2.9c-2.5-0.8-5.4-1.7-8.9-2.7c-4.1-1.2-7.5-2.4-10.2-3.9c-2.7-1.4-4.8-3.2-6.1-5.4    c-1.3-2.2-2-4.9-2-8.2c0-4.4,1-8.1,3.1-11.1s4.9-5.3,8.5-6.8s7.6-2.3,12-2.3c3,0,5.9,0.3,8.6,1c2.7,0.7,5.2,1.6,7.6,2.6    s4.5,2.3,6.4,3.6L688.3,59.3z"/>
		<path class="st1" d="M732,104.7c-1,0.4-2.3,0.9-3.7,1.5c-1.5,0.5-3,1-4.7,1.3s-3.4,0.5-5.1,0.5c-2.3,0-4.3-0.4-6.2-1.2    c-1.9-0.8-3.4-2-4.5-3.8c-1.1-1.7-1.7-4-1.7-6.7V69.1h-6.3v-9.4h6.3V44.2h12.2v15.5h10v9.4h-10v23.1c0.1,1.6,0.5,2.8,1.4,3.5    s1.9,1.1,3.2,1.1s2.5-0.2,3.7-0.6s2.2-0.8,2.9-1.1L732,104.7z"/>
		<path class="st1" d="M737.9,89.4V59.7h12.2v27c0,3.6,0.7,6.3,2,8.2c1.3,1.8,3.3,2.7,5.9,2.7c1.6,0,3.1-0.3,4.7-0.9    c1.6-0.6,3-1.6,4.3-2.8c1.3-1.3,2.4-2.8,3.3-4.7V59.7h12.2v33.7c0,1.3,0.2,2.2,0.7,2.7s1.2,0.9,2.2,1v9.9    c-1.2,0.2-2.2,0.3-3.1,0.4c-0.8,0.1-1.6,0.1-2.2,0.1c-2.2,0-4-0.5-5.3-1.5c-1.4-1-2.2-2.4-2.4-4.1l-0.3-3.8    c-2.1,3.2-4.9,5.6-8.2,7.3c-3.3,1.7-7,2.5-11,2.5c-4.9,0-8.7-1.6-11.2-4.7C739.2,100.1,737.9,95.5,737.9,89.4z"/>
		<path class="st1" d="M791.9,83.5c0-4.6,0.9-8.7,2.7-12.4c1.8-3.7,4.3-6.6,7.6-8.8c3.2-2.2,6.9-3.2,11-3.2c3.5,0,6.7,0.9,9.5,2.6    c2.8,1.7,5,3.9,6.6,6.6V40.5h12.2v52.9c0,1.3,0.2,2.2,0.6,2.7c0.4,0.5,1.2,0.9,2.2,1v9.9c-2.1,0.4-3.9,0.6-5.2,0.6    c-2.2,0-4-0.5-5.4-1.6s-2.2-2.5-2.4-4.3l-0.2-3c-1.8,3-4.2,5.3-7.2,6.8c-3,1.6-6.2,2.4-9.4,2.4c-3.3,0-6.3-0.6-9.1-1.9    s-5.2-3-7.2-5.2s-3.6-4.8-4.7-7.8C792.4,90.1,791.9,86.9,791.9,83.5z M829.4,89.7V78.5c-0.6-1.7-1.6-3.3-2.9-4.7    c-1.3-1.4-2.8-2.5-4.5-3.3c-1.6-0.8-3.3-1.2-4.9-1.2c-1.9,0-3.6,0.4-5.1,1.2c-1.5,0.8-2.8,1.8-4,3.1c-1.1,1.3-2,2.8-2.6,4.6    c-0.6,1.7-0.9,3.6-0.9,5.5s0.3,3.7,1,5.4c0.6,1.7,1.6,3.2,2.8,4.4c1.2,1.3,2.6,2.2,4.2,3c1.6,0.7,3.4,1.1,5.2,1.1    c1.2,0,2.3-0.2,3.5-0.6s2.3-0.9,3.4-1.6c1.1-0.7,2-1.5,2.8-2.5C828.3,91.9,828.9,90.9,829.4,89.7z"/>
		<path class="st1" d="M853.6,52.6V40.5h12.2v12.1H853.6z M853.6,107.1V59.3h12.2v47.8H853.6z"/>
		<path class="st1" d="M899,108c-3.9,0-7.4-0.6-10.5-1.9s-5.7-3.1-7.9-5.4s-3.8-4.9-5-7.9c-1.2-2.9-1.7-6-1.7-9.3s0.6-6.4,1.7-9.4    c1.2-2.9,2.8-5.6,5-7.9c2.2-2.3,4.8-4.1,7.9-5.4c3.1-1.3,6.6-1.9,10.5-1.9s7.4,0.6,10.4,1.9c3.1,1.3,5.7,3.1,7.9,5.4    s3.8,4.9,5,7.9c1.1,2.9,1.7,6.1,1.7,9.4c0,3.2-0.6,6.3-1.7,9.3c-1.1,2.9-2.8,5.6-4.9,7.9c-2.2,2.3-4.8,4.1-7.9,5.4    C906.4,107.4,902.9,108,899,108z M886.5,83.5c0,2.7,0.5,5.2,1.6,7.3c1.1,2.1,2.6,3.8,4.5,5s4,1.8,6.4,1.8c2.3,0,4.4-0.6,6.3-1.8    c1.9-1.2,3.4-2.9,4.5-5s1.7-4.5,1.7-7.3c0-2.7-0.6-5.1-1.7-7.3c-1.1-2.1-2.6-3.8-4.5-5s-4-1.8-6.3-1.8c-2.4,0-4.5,0.6-6.4,1.8    c-1.9,1.2-3.4,2.9-4.5,5C887,78.4,886.5,80.8,886.5,83.5z"/>
	</g>
</g>
<script xmlns=""/></svg>`,
        svgAreaHeight: 70,
        bgColor: getTheme().diagramBg,
        padding: 16,
      });
      generatingImage.value = false;
      return pngWithSvg;
    } catch (e) {
      generatingImage.value = false;
      throw e;
    }
  }

  function addSvgBelowPng({
    pngBase64,
    svgString,
    svgAreaHeight,
    bgColor = "#000",
    padding = 0, // new
  }) {
    return new Promise((resolve, reject) => {
      const imgPng = new Image();
      const imgSvg = new Image();

      const normalizePng = (b64) =>
        b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`;

      const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
      const svgDataUrl = `data:image/svg+xml;base64,${svgBase64}`;

      let loaded = 0;
      const onLoad = () => {
        loaded++;
        if (loaded < 2) return;

        const canvasWidth = imgPng.width;
        const canvasHeight = imgPng.height + svgAreaHeight;

        const canvas = document.createElement("canvas");
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext("2d");

        // draw original PNG
        ctx.drawImage(imgPng, 0, 0);

        // draw background strip
        const stripY = imgPng.height;
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, stripY, canvasWidth, svgAreaHeight);

        // intrinsic SVG size
        const svgW = imgSvg.naturalWidth || imgSvg.width;
        const svgH = imgSvg.naturalHeight || imgSvg.height;

        // padded area
        const maxW = canvasWidth - padding * 2;
        const maxH = svgAreaHeight - padding * 2;

        // scale factor: fit into padded area, never upscale
        const scaleW = maxW / svgW;
        const scaleH = maxH / svgH;
        const scale = Math.min(scaleW, scaleH, 1);

        const drawW = svgW * scale;
        const drawH = svgH * scale;

        // center inside padded area
        const x = canvasWidth - drawW - padding;
        const y = stripY + (svgAreaHeight - drawH) / 2;

        ctx.drawImage(imgSvg, x, y, drawW, drawH);

        resolve(canvas.toDataURL("image/png"));
      };

      const onError = (e) => reject(e);

      imgPng.onload = onLoad;
      imgSvg.onload = onLoad;
      imgPng.onerror = onError;
      imgSvg.onerror = onError;

      imgPng.src = normalizePng(pngBase64);
      imgSvg.src = svgDataUrl;
    });
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
