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
        <button class="btn btn-fab btn-flat" @click="toggleMenu" ref="menuBtn">
          <span class="material-symbols-outlined">menu</span>
        </button>
        <Menu :model="menuItems" :popup="true" ref="menu">
          <template #itemicon="{item}">
            <span class="material-symbols-outlined menu-icon" >{{ item.icon }}</span>
          </template>
        </Menu>
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

<script lang="ts">
import { VueFlow, Panel } from "@vue-flow/core";
import ZoomControls from "./ZoomControls.vue";
import { Background } from "@vue-flow/background";
import { useSchemaDiagram } from "@/composables/useSchemaDiagram";
import { defineComponent, type PropType } from "vue";
import FloatingEdge from "@/components/FloatingEdge.vue";
import EntityNode from "@/components/EntityNode.vue";
import Menu from "primevue/menu";
import { type MenuItem } from "primevue/menuitem";

export default defineComponent({
  components: {
    VueFlow,
    Panel,
    ZoomControls,
    Background,
    FloatingEdge,
    EntityNode,
    Menu,
  },

  props: {
    disabled: Boolean,
    menuItems: {
      type: Array as PropType<MenuItem[]>,
      default: () => [],
    },
  },

  data() {
    return {
      showMenu: false,
    };
  },

  methods: {
    toggleMenu(event) {
      this.$refs.menu.toggle(event);
    },
  },

  setup() {
    const diagram = useSchemaDiagram();
    return {
      diagram,
    };
  },
});
</script>
