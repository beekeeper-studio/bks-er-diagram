<script setup lang="ts">
import { VueFlow, Panel, Handle, Position } from "@vue-flow/core";
import ZoomControls from "./ZoomControls.vue";
import { Background } from "@vue-flow/background";
import { useSchemaDiagram } from "@/composables/useSchemaDiagram";

const diagram = useSchemaDiagram();
</script>

<template>
  <VueFlow class="diagram" :min-zoom="0.01" :snap-to-grid="true" :nodes-connectable="false" :nodes-draggable="false"
    :nodes="diagram.nodes" :edges="diagram.edges">
    <Background variant="dots" pattern-color="var(--bg-pattern-color)" />

    <template #node-table="table">
      <div style="
          background-color: color-mix(
            in srgb,
            var(--theme-base) 10%,
            var(--query-editor-bg)
          );
          color: var(--text);
          border-radius: 6px;
          padding-block: 1rem;
        ">
        <div style="font-weight: bold; text-align: center; margin-bottom: 0.75rem">
          {{ table.data.name }}
        </div>
        <div>
          <ul style="margin: 0; padding: 0; list-style: none">
            <li v-for="column in table.data.columns" :key="column.name" style="
                position: relative;
                display: flex;
                justify-content: space-between;
                margin: 0;
                padding: 0;
                line-height: 2;
                padding-inline: 1rem;
              ">
              <span style="font-weight: bold; margin-right: 0.5rem">
                {{ column.name }}
              </span>
              <span>
                {{ column.type }}
              </span>
              <Handle type="target" :position="Position.Left" :id="`target-${column.handleId}`" :connectable="false" />
              <Handle type="source" :position="Position.Right" :id="`source-${column.handleId}`" :connectable="false" />
            </li>
          </ul>
        </div>
      </div>
    </template>

    <Panel position="top-left">
      <button class="btn btn-fab btn-flat">
        <span class="material-symbols-outlined">menu</span>
        <span class="title-popup" data-position="bottom">Menu</span>
      </button>
    </Panel>
    <Panel position="bottom-left" v-show="false">
      <button class="btn btn-fab btn-flat">
        <span class="material-symbols-outlined">undo</span>
        <span class="title-popup">Undo</span>
      </button>
      <button class="btn btn-fab btn-flat">
        <span class="material-symbols-outlined">redo</span>
        <span class="title-popup">Redo</span>
      </button>
    </Panel>
    <ZoomControls />
  </VueFlow>
</template>
