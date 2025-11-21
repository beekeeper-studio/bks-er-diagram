<template>
  <div class="table-node" :class="{ highlighted, selected }" @contextmenu="handleContextMenu">
    <Handle type="source" :position="Position.Top" :connectable="false" />
    <Handle type="source" :position="Position.Bottom" :connectable="false" />
    <div class="table-name">
      <span class="material-symbols-outlined table-icon"> grid_on </span>
      <span>
        {{ data.name }}
      </span>
    </div>
    <!-- <button class="btn btn-fab btn-flat" style="margin-left: auto; margin-right: 0.5rem"> -->
    <!--   <span class="material-symbols-outlined">more_vert</span> -->
    <!-- </button> -->
    <div>
      <ul class="columns">
        <Columns :columns="referencedColumns" />
        <Columns v-if="showAllColumns" :columns="normalColumns" />
      </ul>
    </div>
  </div>
</template>

<script lang="ts">
import { useSchemaDiagram } from "@/composables/useSchemaDiagram";
import type { TableEntityStructure, ColumnStructure } from "@/utils/schema";
import {
  Handle,
  Position,
  useNode,
  useVueFlow,
  type NodeProps,
} from "@vue-flow/core";
import { mapActions, mapGetters } from "pinia";
import { defineComponent, type PropType } from "vue";
import Columns from "@/components/Columns.vue";

type Props = NodeProps<TableEntityStructure>;

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
    ...mapGetters(useSchemaDiagram, [ "showAllColumns" ]),
    columns() {
      return this.data.columns.sort(
        (a, b) => a.ordinalPosition - b.ordinalPosition,
      );
    },
    referencedColumns() {
      return this.columns.filter(this.isReferencedColumn);
    },
    normalColumns() {
      return this.columns.filter((column) => !this.isReferencedColumn(column));
    },
    connectedEdges() {
      return this.getConnectedEdges(this.id);
    },
    connectedNodes(): string[] {
      return this.connectedEdges.map((edge) => {
        if (edge.source === this.id) {
          return edge.target;
        }
        return edge.source;
      });
    },
    highlighted() {
      if (this.selected) {
        return false;
      }
      if (
        this.connectedNodes.some(
          (node) => this.selectedNodes.find((n) => n.id === node) && node !== this.id,
        )
      ) {
        return true;
      }
      if (this.connectedEdges.some((edge) => edge.selected)) {
        return true;
      }
      return false;
    },
  },

  methods: {
    ...mapActions(useSchemaDiagram, ["toggleHideSelectedEntities"]),
    handleContextMenu(event: MouseEvent) {
      // event.preventDefault();
      if (!this.selected) {
        this.addSelectedNodes([this.node]);
      }
      this.$bks.openMenu(event, [
        {
          label:
            this.selectedNodes.length > 1
              ? "Hide selected entities"
              : `Hide ${this.data.name}`,
          command: () => {
            this.toggleHideSelectedEntities(true);
          },
        },
      ]);
    },
    isReferencedColumn(column: ColumnStructure) {
      return column.hasReferences || column.primaryKey || column.foreignKey;
    },
  },

  setup() {
    const { getConnectedEdges, addSelectedNodes, getSelectedNodes } = useVueFlow();
    const { node } = useNode<TableEntityStructure>();
    return {
      Position,
      getConnectedEdges,
      addSelectedNodes,
      selectedNodes: getSelectedNodes,
      node,
    };
  },
});
</script>
