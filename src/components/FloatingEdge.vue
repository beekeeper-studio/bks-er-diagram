<script setup lang="ts">
import { type EdgeProps, getSmoothStepPath } from "@vue-flow/core";
import { getEdgeParams } from "@/utils/floatingEdgeHelpers";
import { computed } from "vue";

const props = defineProps<EdgeProps>();
const edgeParams = computed(() =>
  getEdgeParams(props.sourceNode, props.targetNode),
);

const d = computed(
  () =>
    (edgeParams.value.sx &&
      getSmoothStepPath({
        sourceX: edgeParams.value.sx,
        sourceY: edgeParams.value.sy,
        targetX: edgeParams.value.tx,
        targetY: edgeParams.value.ty,
        sourcePosition: edgeParams.value.sourcePos,
        targetPosition: edgeParams.value.targetPos,
      })[0]) ||
    "",
);
</script>

<template>
  <g class="vue-flow__connection">
    <path :id="props.id" class="vue-flow__edge-path" :d="d" :marker-start="props.markerStart"
      :marker-end="props.markerEnd" :style="props.style" />
  </g>
</template>
