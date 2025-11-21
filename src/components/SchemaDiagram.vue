<template>
  <div class="schema-diagram" :style="{
    '--thickness-multipler': generatingImage ? 1 : thicknessMultipler,
  }">
    <VueFlow class="diagram">
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
        <slot name="panel-top-right-start"></slot>
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
        <button class="btn btn-fab btn-flat" @click="toggleHiddenEntitiesPopover" v-show="hiddenEntities.length > 0">
          <span class="material-symbols-outlined"
            style="font-variation-settings: &quot;FILL&quot; 1">visibility_off</span>
        </button>
        <Popover ref="hiddenEntitiesPopover">
          <Menu class="hidden-entities-menu" :model="hiddenEntitiesAsMenuItems">
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
        </Popover>

        <ZoomControls />

        <slot name="panel-bottom-right-end"></slot>
      </Panel>
    </VueFlow>
  </div>
</template>

<script lang="ts">
import { VueFlow, Panel } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import Menu from "primevue/menu";
import type { MenuItem } from "primevue/menuitem";
import Tree from "primevue/tree";
import Popover from "primevue/popover";
import { mapActions, mapGetters } from "pinia";
import ZoomControls from "./ZoomControls.vue";
import { getNodeId, useSchemaDiagram } from "@/composables/useSchemaDiagram";
import { defineComponent, type PropType } from "vue";
import FloatingEdge from "@/components/FloatingEdge.vue";
import TableNode from "@/components/TableNode.vue";
import SchemaNode from "./SchemaNode.vue";

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
    Popover,
  },

  props: {
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
    ...mapGetters(useSchemaDiagram, ["generatingImage", "hiddenEntities", "thicknessMultipler"]),
    hiddenEntitiesAsMenuItems(): MenuItem[] {
      return this.hiddenEntities
        .filter((entity) => entity.type !== "schema")
        .map((entity) => ({
          label:
            entity.type === "table"
              ? entity.schema
                ? `${entity.schema}.${entity.name}`
                : entity.name
              : entity.name,
          icon: entity.type === "table" ? "grid_on" : "folder",
          class: entity.type === "table" ? "table" : "schema",
          command: async () => {
            await this.toggleHideEntity(entity, false);
            this.selectEntity(entity);
            // @ts-expect-error
            this.$refs.hiddenEntitiesPopover.alignOverlay();
          },
        }));
    },
  },

  watch: {
    hiddenEntities() {
      if (this.hiddenEntities.length === 0) {
        // @ts-expect-error
        this.$refs.hiddenEntitiesPopover.hide();
      }
    },
  },

  methods: {
    ...mapActions(useSchemaDiagram, ['toggleHideEntity', 'selectEntity']),
    getNodeId,
    toggleMenu(event: MouseEvent) {
      // @ts-expect-error
      this.$refs.menu.toggle(event);
    },
    toggleHiddenEntitiesPopover(event: MouseEvent) {
      // @ts-expect-error
      this.$refs.hiddenEntitiesPopover.toggle(event);
    },
  },
});
</script>
