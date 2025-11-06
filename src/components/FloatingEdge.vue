<template>
  <g class="vue-flow__connection" :class="{ highlighted }">
    <path :id="id" class="vue-flow__edge-path edge-path" :d="d" :marker-start="markerStart" :marker-end="markerEnd"
      :style="style" />
  </g>
</template>

<script lang="ts">
import {
  type EdgeProps,
  getSmoothStepPath,
  Position,
  useVueFlow,
} from "@vue-flow/core";
import { getEdgeParams } from "@/utils/floatingEdgeHelpers";
import { defineComponent, type PropType } from "vue";
import type { EdgeData } from "@/composables/useSchemaDiagram";

type Props = EdgeProps<EdgeData>;

export default defineComponent({
  // Avoid vue flow from adding unneeded attributes to the root element
  inheritAttrs: false,

  props: {
    id: {
      type: String as PropType<Props["id"]>,
      required: true,
    },
    source: {
      type: String as PropType<Props["source"]>,
      required: true,
    },
    target: {
      type: String as PropType<Props["target"]>,
      required: true,
    },
    markerStart: {
      type: String as PropType<Props["markerStart"]>,
      required: true,
    },
    markerEnd: {
      type: String as PropType<Props["markerEnd"]>,
      required: true,
    },
    sourceNode: {
      type: Object as PropType<Props["sourceNode"]>,
      required: true,
    },
    targetNode: {
      type: Object as PropType<Props["targetNode"]>,
      required: true,
    },
    data: {
      type: Object as PropType<Props["data"]>,
      required: true,
    },
    style: Object as PropType<Props["style"]>,
  },

  computed: {
    edgeParams() {
      return getEdgeParams(this.sourceNode, this.targetNode, this.data);
    },
    highlighted() {
      return this.sourceNode.selected || this.targetNode.selected;
    },
    d() {
      if (this.edgeParams.sx) {
        let sourceX = this.edgeParams.sx;
        let targetX = this.edgeParams.tx;

        if (
          this.edgeParams.sourcePos === Position.Top ||
          this.edgeParams.sourcePos === Position.Bottom
        ) {
          const edges = this.getEdges.filter(
            (edge) => edge.source === this.source,
          );
          const idx = edges.findIndex((edge) => edge.id === this.id);
          const node = this.findNode(this.source)!;
          const origin = node.position.x;
          const x = (node.dimensions.width * (idx + 1)) / (1 + edges.length);
          sourceX = origin + x;
        }

        if (
          this.edgeParams.targetPos === Position.Top ||
          this.edgeParams.targetPos === Position.Bottom
        ) {
          const edges = this.getEdges.filter(
            (edge) => edge.target === this.target,
          );
          const idx = edges.findIndex((edge) => edge.id === this.id);
          const node = this.findNode(this.target)!;
          const origin = node.position.x;
          const x = (node.dimensions.width * (idx + 1)) / (1 + edges.length);
          targetX = origin + x;
        }

        const [path] = getSmoothStepPath({
          sourceX,
          sourceY: this.edgeParams.sy,
          targetX,
          targetY: this.edgeParams.ty,
          sourcePosition: this.edgeParams.sourcePos,
          targetPosition: this.edgeParams.targetPos,
        });
        return path;
      }

      return "";
    },
  },

  setup() {
    const { getEdges, findNode } = useVueFlow();
    return {
      getEdges,
      findNode,
    };
  },
});
</script>
