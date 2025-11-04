<script setup lang="ts">
import { VueFlow, Panel, Handle, Position, useVueFlow } from "@vue-flow/core";
import ZoomControls from "./ZoomControls.vue";
import { Background } from "@vue-flow/background";
import { useSchemaDiagram } from "@/composables/useSchemaDiagram";
import { ref, useTemplateRef } from "vue";
import { vOnClickOutside } from "@vueuse/components";
import FloatingEdge from "@/components/FloatingEdge.vue";

defineProps({
  disabled: Boolean,
});

const diagram = useSchemaDiagram();
const { nodes } = useVueFlow();
const showMenu = ref(false);

const menuBtn = useTemplateRef<HTMLButtonElement>("menuBtn");

function hideMenu() {
  showMenu.value = false;
}
</script>

<template>
  <div class="schema-diagram">
    <VueFlow class="diagram" :min-zoom="0.01" :nodes-connectable="false" :nodes="diagram.nodes" :edges="diagram.edges">
      <Background variant="dots" pattern-color="var(--bg-pattern-color)" />

      <template #edge-floating="props">
        <FloatingEdge v-bind="props" :nodes="nodes" />
      </template>

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
          <div style="
              font-weight: bold;
              text-align: center;
              margin-bottom: 0.75rem;
              margin-inline: 1rem;
            ">
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
                <span style="margin-right: 0.5rem">
                  {{ column.name }}
                </span>
                <span style="color: var(--text-muted-2)">
                  {{ column.type }}
                </span>
                <template v-if="column.hasReferences">
                  <Handle type="source" :position="Position.Top" :id="`top-${column.handleId}`" :connectable="false" />
                  <Handle type="source" :position="Position.Right" :id="`right-${column.handleId}`"
                    :connectable="false" />
                  <Handle type="source" :position="Position.Bottom" :id="`bottom-${column.handleId}`"
                    :connectable="false" />
                  <Handle type="source" :position="Position.Left" :id="`left-${column.handleId}`"
                    :connectable="false" />
                </template>
              </li>
            </ul>
          </div>
        </div>
      </template>

      <Panel position="top-left">
        <button class="btn btn-fab btn-flat" @click="showMenu = !showMenu" ref="menuBtn">
          <span class="material-symbols-outlined">menu</span>
        </button>
        <div v-if="showMenu" @click="hideMenu" v-on-click-outside="[hideMenu, { ignore: [menuBtn] }]" style="
            margin-top: 0.5rem;
            background-color: color-mix(
              in srgb,
              var(--theme-base) 10%,
              var(--query-editor-bg)
            );
            box-shadow: 0 0 0.5rem var(--query-editor-bg);
            border-radius: 8px;
          ">
          <slot name="menu"></slot>
        </div>
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

      <div class="overlay" v-if="disabled" />
    </VueFlow>
  </div>
</template>
