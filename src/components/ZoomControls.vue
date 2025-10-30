<script setup lang="ts">
import { Panel } from "@vue-flow/core";
import _ from "lodash";
import { useSchemaDiagram } from "@/composables/useSchemaDiagram";

const diagram = useSchemaDiagram();

function handleChangeZoomLevel(e: Event) {
  const el = e.target as HTMLInputElement;
  const value = Math.abs(_.toNumber(el.value.replace("%", "")));
  if (_.isNaN(value)) {
    return;
  }
  diagram.zoomTo(value);
}
</script>

<template>
  <Panel position="bottom-right" class="zoom-controls">
    <button class="btn btn-fab btn-flat" @click="diagram.zoomOut()">
      <span class="material-symbols-outlined">remove</span>
      <span class="title-popup">Zoom out</span>
    </button>
    <input type="text" class="zoom-input" :value="diagram.zoomLevel" @change="handleChangeZoomLevel"
      @keydown.enter="handleChangeZoomLevel" />
    <button class="btn btn-fab btn-flat" @click="diagram.zoomIn()">
      <span class="material-symbols-outlined">add</span>
      <span class="title-popup">Zoom in</span>
    </button>
    <button class="btn btn-fab btn-flat">
      <span class="material-symbols-outlined">help</span>
      <span class="title-popup">Help</span>
    </button>
  </Panel>
</template>
