<script setup lang="ts">
import { VueFlow, Panel, useVueFlow } from "@vue-flow/core";
import ZoomControls from "./ZoomControls.vue";
import { Background } from "@vue-flow/background";
import { useSchemaDiagram } from "@/composables/useSchemaDiagram";
import { ref, useTemplateRef } from "vue";
import { vOnClickOutside } from "@vueuse/components";
import FloatingEdge from "@/components/FloatingEdge.vue";
import EntityNode from "@/components/EntityNode.vue";

defineProps({
  disabled: Boolean,
});

const diagram = useSchemaDiagram();
const showMenu = ref(false);

const menuBtn = useTemplateRef<HTMLButtonElement>("menuBtn");

function hideMenu() {
  showMenu.value = false;
}
</script>

<template>
  <div class="schema-diagram" :style="{
    '--thickness-multipler': diagram.thicknessMultipler,
  }">
    <VueFlow class="diagram" :min-zoom="0.01" :nodes="diagram.nodes" :edges="diagram.edges">
      <Background variant="dots" pattern-color="var(--bg-pattern-color)" />

      <template #edge-floating="props">
        <FloatingEdge v-bind="props" />
      </template>

      <template #node-table="table">
        <EntityNode v-bind="table" />
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
      <Panel position="bottom-right" class="panel">
        <ZoomControls />
        <button class="btn btn-fab btn-flat">
          <span class="material-symbols-outlined">help</span>
          <span class="title-popup">Help</span>
        </button>
      </Panel>

      <div class="overlay" v-if="disabled" />
    </VueFlow>
  </div>
</template>
