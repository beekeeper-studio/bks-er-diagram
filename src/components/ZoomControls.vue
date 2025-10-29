<script setup lang="ts">
import { Panel, useVueFlow } from "@vue-flow/core";
import { computed } from "vue";
import _ from "lodash";

const { viewport, zoomIn, zoomOut, zoomTo } = useVueFlow("main-diagram");

const zoomLevel = computed(() => Math.round(viewport.value.zoom * 100) + "%");

function handleChangeZoomLevel(e: Event) {
  const el = e.target as HTMLInputElement;
  const value = Math.abs(_.toNumber(el.value.replace("%", "")) / 100);
  if (_.isNaN(value)) {
    return;
  }
  zoomTo(value);
}
</script>

<template>
  <Panel position="bottom-right" class="zoom-controls">
    <button class="btn btn-fab btn-flat-2" @click="zoomOut()">
      <span class="material-symbols-outlined">remove</span>
      <span class="title-popup">Zoom out</span>
    </button>
    <input type="text" class="zoom-input" :value="zoomLevel" @change="handleChangeZoomLevel"
      @keydown.enter="handleChangeZoomLevel" />
    <button class="btn btn-fab btn-flat-2" @click="zoomIn()">
      <span class="material-symbols-outlined">add</span>
      <span class="title-popup">Zoom in</span>
    </button>
    <button class="btn btn-fab btn-flat-2">
      <span class="material-symbols-outlined">help</span>
      <span class="title-popup">Help</span>
    </button>
  </Panel>
</template>
