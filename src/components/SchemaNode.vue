<template>
  <div class="schema-node" :class="{ selected }" @contextmenu="handleContextMenu" :style="{
    // '--min-width': `${minDimensions.width}px`,
    // '--min-height': `${minDimensions.height}px`,
  }">
    <div class="schema-name">
      <span class="material-symbols-outlined schema-icon"> folder </span>
      <span>
        {{ data.name }}
      </span>
    </div>
  </div>
</template>

<script lang="ts">
import {
  getNodeId,
  useSchemaDiagram,
  type SchemaEntityStructure,
} from "@/composables/useSchemaDiagram";
import { Handle, Position, useVueFlow, type NodeProps } from "@vue-flow/core";
import { defineComponent, type PropType } from "vue";
import Columns from "@/components/Columns.vue";
import { mapActions } from "pinia";

type Props = NodeProps<SchemaEntityStructure>;

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
    position: {
      type: Object as PropType<Props["position"]>,
      required: true,
    },
    dimensions: {
      type: Object as PropType<Props["dimensions"]>,
      required: true,
    },
  },

  components: {
    Handle,
    Columns,
  },

  computed: {
    children() {
      return this.data.entities.map((e) =>
        this.getNode(getNodeId("table", e)!),
      );
    },
    node() {
      return this.getNode(this.id)!;
    },
    minDimensions() {
      let minWidth = Infinity;
      let maxX = 0;
      let minHeight = Infinity;
      let maxY = 0;
      for (const child of this.children) {
        if (!child) continue;
        if (child.position.x + child.dimensions.width < minWidth)
          minWidth = child.position.x + child.dimensions.width;
        if (child.position.x + child.dimensions.width > maxX)
          maxX = child.position.x + child.dimensions.width;
        if (child.position.y + child.dimensions.height < minHeight)
          minHeight = child.position.y + child.dimensions.height;
        if (child.position.y + child.dimensions.height > maxY)
          maxY = child.position.y + child.dimensions.height;
      }
      return {
        width: maxX - this.position.x,
        height: maxY - this.position.y,
      };
    },
  },

  methods: {
    ...mapActions(useSchemaDiagram, ["toggleHideEntity"]),
    handleContextMenu(event: MouseEvent) {
      return;

      event.preventDefault();
      this.addSelectedNodes([this.node]);

      // TODO support hide schema
      this.$bks.openMenu(event, [
        {
          label: `Hide ${this.data.name}`,
          command: () => {
            this.toggleHideEntity(this.data, true);
          },
        },
      ]);
    },
  },

  async mounted() {
    await this.$nextTick();
  },

  setup() {
    const { addSelectedNodes, getNode, applyNodeChanges } = useVueFlow();
    return {
      Position,
      addSelectedNodes,
      getNode,
      applyNodeChanges,
    };
  },
});
</script>
