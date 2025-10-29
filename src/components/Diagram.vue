<script setup lang="ts">
import { VueFlow, Panel, useVueFlow } from "@vue-flow/core";
import ZoomControls from "./ZoomControls.vue";
import { Background } from "@vue-flow/background";

const {} = useVueFlow("main-diagram");

</script>

<template>
  <VueFlow class="diagram" id="main-diagram">
    <Background variant="dots" pattern-color="var(--bg-pattern-color)"/>
    <Panel position="top-left">
      <button class="btn btn-fab btn-flat-2">
        <span class="material-symbols-outlined">menu</span>
        <span class="title-popup" data-position="bottom">Menu</span>
      </button>
    </Panel>
    <Panel position="bottom-left">
      <button class="btn btn-fab btn-flat-2">
        <span class="material-symbols-outlined">undo</span>
        <span class="title-popup">Undo</span>
      </button>
      <button class="btn btn-fab btn-flat-2">
        <span class="material-symbols-outlined">redo</span>
        <span class="title-popup">Redo</span>
      </button>
    </Panel>
    <ZoomControls />
  </VueFlow>
</template>
