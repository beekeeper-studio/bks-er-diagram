<template>
  <svg class="vue-flow__marker vue-flow__container" :class="{ highlighted }">
    <defs>
      <marker v-if="type === 'one-or-many'" :id="id" class="vue-flow__arrowhead" viewBox="-10 -10 20 20" refX="0"
        refY="0" :markerWidth="18" :markerHeight="18" markerUnits="strokeWidth" orient="auto-start-reverse">
        <!-- <ellipse cx="-5" cy="0" fill="none" rx="4" ry="4" :style="{ -->
        <!--   stroke, -->
        <!--   'stroke-width': strokeWidth, -->
        <!-- }"></ellipse> -->
        <polyline stroke-linecap="round" fill="none" points="8,-4 0,0 8,4" :style="{
          'stroke-width': strokeWidth,
        }"></polyline>
        <line x1="0" y1="0" x2="8" y2="0" stroke-linecap="round" :style="{
          'stroke-width': strokeWidth,
        }" />
        <line x1="0" y1="4" x2="0" y2="-4" stroke-linecap="round" :style="{ 'stroke-width': strokeWidth }" />
        <text v-if="debugUI" x="0" y="10" :style="{ stroke: 'rgb(from red r g b / 0.5)', fontSize: '0.5rem' }">
          {{ debugLabel }}
        </text>
      </marker>
      <marker v-else-if="type === 'one'" :id="id" class="vue-flow__arrowhead" viewBox="-10 -10 20 20" refX="0" refY="0"
        :markerWidth="18" :markerHeight="18" markerUnits="strokeWidth" orient="auto-start-reverse">
        <line x1="0" y1="0" x2="8" y2="0" stroke-linecap="round" :style="{ 'stroke-width': strokeWidth }" />
        <line x1="4" y1="4" x2="4" y2="-4" stroke-linecap="round" :style="{ 'stroke-width': strokeWidth }" />
        <text v-if="debugUI" x="0" y="10" :style="{ stroke: 'rgb(from red r g b / 0.5)', fontSize: '0.5rem' }">
          {{ debugLabel }}
        </text>
      </marker>
      <marker v-else :id="id" class="vue-flow__arrowhead" viewBox="-10 -10 20 20" refX="0" refY="0" :markerWidth="18"
        :markerHeight="18" markerUnits="strokeWidth" orient="auto-start-reverse">
        <line x1="0" y1="0" x2="8" y2="0" stroke-linecap="round" :style="{ stroke, 'stroke-width': strokeWidth }" />
        <text v-if="debugUI" x="0" y="10" :style="{ stroke: 'rgb(from red r g b / 0.5)', fontSize: '0.5rem' }">
          {{ debugLabel }}
        </text>
      </marker>
    </defs>
  </svg>
</template>

<script lang="ts">
import { useDebug } from "@/composables/useDebug";
import { mapGetters } from "pinia";
import { defineComponent, type PropType } from "vue";

export default defineComponent({
  props: {
    id: {
      type: String,
      required: true,
    },
    type: {
      type: String as PropType<"one" | "one-or-many" | "none">,
      required: true,
    },
    debugLabel: String,
    strokeWidth: {
      type: Number,
      required: false,
      default: 1,
    },
    highlighted: Boolean,
  },

  computed: {
    ...mapGetters(useDebug, ["debugUI"]),
  },
});
</script>
