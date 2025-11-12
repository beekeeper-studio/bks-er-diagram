<template>
  <div class="schema-diagram" :style="{
    '--thickness-multipler': diagram.thicknessMultipler,
  }">
    <VueFlow class="diagram" :min-zoom="0.01" :nodes="diagram.nodes" :edges="diagram.edges" elevate-edges-on-select>
      <Background variant="dots" pattern-color="var(--bg-pattern-color)" />

      <template #edge-floating="props">
        <FloatingEdge v-bind="props" />
      </template>

      <template #node-table="props">
        <TableNode v-bind="props" />
      </template>

      <template #node-schema="props">
        <SchemaNode v-bind="props" />
      </template>

      <Panel position="top-right" class="panel">
        <button class="btn btn-fab btn-flat">
          <span class="material-symbols-outlined">file_export</span>
          <span class="title-popup">Export</span>
        </button>
        <button class="btn btn-fab btn-flat" @click="toggleMenu">
          <span class="material-symbols-outlined">more_vert</span>
        </button>
        <Menu :model="menuItems" :popup="true" ref="menu">
          <template #itemicon="{ item }">
            <span class="material-symbols-outlined menu-icon">{{
              item.icon
              }}</span>
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
        <button class="btn btn-fab btn-flat" @click="toggleHiddenEntitiesMenu"
          v-show="diagram.hiddenEntities.length > 0">
          <span class="material-symbols-outlined"
            style="font-variation-settings: &quot;FILL&quot; 1">visibility_off</span>
        </button>
        <Menu class="hidden-entities-menu" :model="hiddenEntitiesAsMenuItems" popup ref="hiddenEntitiesMenu">
          <template #start>
            <div style="margin: 0.5rem; margin-bottom: 0.25rem">
              <h2 style="
                  margin: 0;
                  font-size: 1em;
                  margin-bottom: 0.25rem;
                  font-weight: normal;
                ">
                Hidden entities
              </h2>
              <span style="color: var(--text-muted); font-style: italic">Click to unhide entity</span>
            </div>
          </template>
          <template #itemicon="{ item }">
            <span class="material-symbols-outlined menu-icon">{{
              item.icon
              }}</span>
          </template>
        </Menu>

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
import { getNodeId, useSchemaDiagram } from "@/composables/useSchemaDiagram";
import { defineComponent, type PropType } from "vue";
import FloatingEdge from "@/components/FloatingEdge.vue";
import TableNode from "@/components/TableNode.vue";
import Menu from "primevue/menu";
import { type MenuItem } from "primevue/menuitem";
import SchemaNode from "./SchemaNode.vue";
import Tree from "primevue/tree";

export default defineComponent({
  components: {
    VueFlow,
    Panel,
    ZoomControls,
    Background,
    FloatingEdge,
    TableNode,
    SchemaNode,
    Menu,
    Tree,
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
      showHiddenEntitiesMenu: false,
    };
  },

  computed: {
    hiddenEntitiesAsMenuItems(): MenuItem[] {
      return this.diagram.hiddenEntities.map((entity) => ({
        label:
          entity.type === "table"
            ? entity.schema
              ? `${entity.schema}.${entity.name}`
              : entity.name
            : entity.name,
        icon: entity.type === "table" ? "grid_on" : "folder",
        class: entity.type === "table" ? "table" : "schema",
        command: () => {
          this.diagram.toggleHideEntity(entity, false);
        },
      }));
    },
  },

  methods: {
    getNodeId,
    toggleMenu(event) {
      this.$refs.menu.toggle(event);
    },
    toggleHiddenEntitiesMenu(event) {
      this.$refs.hiddenEntitiesMenu.toggle(event);
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
