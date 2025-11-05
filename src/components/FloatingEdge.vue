<script setup lang="ts">
import {
  type EdgeProps,
  getSmoothStepPath,
  Position,
  useVueFlow,
} from "@vue-flow/core";
import { getEdgeParams } from "@/utils/floatingEdgeHelpers";
import { computed } from "vue";
import type { EdgeData } from "@/composables/useSchemaDiagram";

// Avoid vue flow from adding unneeded attributes to the root element
defineOptions({
  inheritAttrs: false,
});

const props = defineProps<EdgeProps<EdgeData>>();
const edgeParams = computed(() =>
  getEdgeParams(props.sourceNode, props.targetNode, props.data),
);
const { getEdges, findNode } = useVueFlow();

const d = computed(() => {
  if (edgeParams.value.sx) {
    let sourceX = edgeParams.value.sx;

    if (
      edgeParams.value.sourcePos === Position.Top ||
      edgeParams.value.sourcePos === Position.Bottom
    ) {
      const edges = getEdges.value.filter(
        (edge) => edge.source === props.source,
      );
      const idx = edges.findIndex((edge) => edge.id === props.id);
      const node = findNode(props.source)!;
      const origin = node.position.x;
      const x = (node.dimensions.width * (idx + 1)) / (1 + edges.length);
      sourceX = origin + x;
    }

    const [path] = getSmoothStepPath({
      sourceX,
      sourceY: edgeParams.value.sy,
      targetX: edgeParams.value.tx,
      targetY: edgeParams.value.ty,
      sourcePosition: edgeParams.value.sourcePos,
      targetPosition: edgeParams.value.targetPos,
    });
    return path;
  }

  return "";
});
</script>

<template>
  <g class="vue-flow__connection">
    <path :id="props.id" class="vue-flow__edge-path edge-path" :d="d" :marker-start="props.markerStart"
      :marker-end="props.markerEnd" :style="props.style" />
  </g>
</template>
