<template>
  <svg class="vue-flow__marker vue-flow__container">
    <defs>
      <marker v-if="type === 'zero-or-many'" :id="id" class="vue-flow__arrowhead" viewBox="-10 -10 20 20" refX="0"
        refY="0" :markerWidth="width" :markerHeight="height" markerUnits="strokeWidth" orient="auto-start-reverse">
        <ellipse cx="-5" cy="0" fill="none" rx="4" ry="4" :style="{
          stroke,
          'stroke-width': strokeWidth,
        }"></ellipse>
        <polyline stroke-linecap="round" fill="none" points="8,-4 0,0 8,4" :style="{
          stroke,
          'stroke-width': strokeWidth,
        }"></polyline>
        <line x1="0" y1="0" x2="8" y2="0" stroke-linecap="round" :style="{
          stroke,
          'stroke-width': strokeWidth,
        }" />
      </marker>
      <marker v-else-if="type === 'one'" :id="id" class="vue-flow__arrowhead" viewBox="-10 -10 20 20" refX="0" refY="0"
        :markerWidth="width" :markerHeight="height" markerUnits="strokeWidth" orient="auto-start-reverse">
        <line x1="0" y1="0" x2="8" y2="0" stroke-linecap="round" :style="{ stroke, 'stroke-width': strokeWidth }" />
        <line x1="4" y1="4" x2="4" y2="-4" stroke-linecap="round" :style="{ stroke, 'stroke-width': strokeWidth }" />
      </marker>
      <marker v-else :id="id" class="vue-flow__arrowhead" viewBox="-10 -10 20 20" refX="0" refY="0"
      </marker>
    </defs>
  </svg>
</template>

<script lang="ts">
import { defineComponent, type PropType } from "vue";

export default defineComponent({
  props: {
    id: {
      type: String,
      required: true,
    },
    type: {
      type: String as PropType<"one" | "zero-or-many" | "none">,
      required: true,
    },
    stroke: {
      type: String,
      required: false,
      default: "#b1b1b7",
    },
    fill: {
      type: String,
      required: false,
      default: "#b1b1b7",
    },
    strokeWidth: {
      type: Number,
      required: false,
      default: 1,
    },
    width: {
      type: Number,
      required: false,
      default: 12.5,
    },
    height: {
      type: Number,
      required: false,
      default: 12.5,
    },
  },
});
</script>
