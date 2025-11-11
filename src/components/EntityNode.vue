<template>
  <div class="entity-node" :class="{ highlighted }" @contextmenu="handleContextMenu">
    <Handle type="source" :position="Position.Top" :connectable="false" />
    <Handle type="source" :position="Position.Bottom" :connectable="false" />
    <div class="entity-name">
      <span class="material-symbols-outlined entity-icon"> grid_on </span>
      <span>
        {{ data.name }}
      </span>
    </div>
    <!-- <button class="btn btn-fab btn-flat" style="margin-left: auto; margin-right: 0.5rem"> -->
    <!--   <span class="material-symbols-outlined">more_vert</span> -->
    <!-- </button> -->
    <div>
      <Columns :columns="referencedColumns" />
      <Columns v-if="showAllColumns" :columns="normalColumns" />
    </div>
  </div>
</template>

<script lang="ts">
import {
  useSchemaDiagram,
  type EntityStructure,
} from "@/composables/useSchemaDiagram";
import { Handle, Position, useVueFlow, type NodeProps } from "@vue-flow/core";
import { mapGetters } from "pinia";
import { defineComponent, type PropType } from "vue";
import Columns from "@/components/Columns.vue";

type Props = NodeProps<EntityStructure>;

export default defineComponent({
  // Avoid vue flow from adding unneeded attributes to the root element
  inheritAttrs: false,

  props: {
    id: {
      type: String as PropType<Props["id"]>,
      required: true,
    },
    selected: {
      type: Boolean as PropType<Props["selected"]>,
      required: true,
    },
    data: {
      type: Object as PropType<Props["data"]>,
      required: true,
    },
  },

  components: {
    Handle,
    Columns,
  },

  computed: {
    ...mapGetters(useSchemaDiagram, ["selectedNodes", "showAllColumns"]),
    columns() {
      return this.data.columns.sort(
        (a, b) => a.ordinalPosition - b.ordinalPosition,
      );
    },
    referencedColumns() {
      return this.columns.filter((column) => column.hasReferences);
    },
    normalColumns() {
      return this.columns.filter((column) => !column.hasReferences);
    },
    connectedNodes(): string[] {
      return this.getConnectedEdges(this.id).map((edge) => {
        if (edge.source === this.id) {
          return edge.target;
        }
        return edge.source;
      });
    },
    highlighted() {
      return this.connectedNodes.some((node) =>
        this.selectedNodes.includes(node),
      );
    },
  },

  methods: {
    handleContextMenu(event: MouseEvent) {
      event.preventDefault();
      this.addSelectedNodes([this.getNode(this.id)!]);
      this.$bks.openMenu(event, [{ label: "Show all columns" }]);
    },
  },

  setup() {
    const { getConnectedEdges, addSelectedNodes, getNode } = useVueFlow();
    return {
      Position,
      getConnectedEdges,
      addSelectedNodes,
      getNode,
    };
  },
});
</script>
