<template>
  <div class="schema-node" :class="{ selected }" @contextmenu="handleContextMenu" :style="{
    width: `${dimensions.width}px`,
    height: `${dimensions.height}px`,
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
  type EntityStructure,
  type SchemaEntityStructure,
} from "@/composables/useSchemaDiagram";
import {
  Handle,
  Position,
  useVueFlow,
  type Node,
  type Dimensions,
  type GraphNode,
  type NodeProps,
  type NodeDragEvent,
} from "@vue-flow/core";
import { defineComponent, type PropType } from "vue";
import { mapActions, mapGetters } from "pinia";

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
  },

  data() {
    return {
      unsubscribe: undefined as Function | undefined,
    };
  },

  computed: {
    ...mapGetters(useSchemaDiagram, ["emitter"]),
    children() {
      const nodes: GraphNode<EntityStructure>[] = [];
      for (const entity of this.data.entities) {
        const node = this.getNode(getNodeId("table", entity)!)!;
        if (!node.hidden) {
          nodes.push(node);
        }
      }
      return nodes;
    },
    node() {
      return this.getNode(this.id)!;
    },
  },

  methods: {
    ...mapActions(useSchemaDiagram, ["toggleHideEntity"]),
    calculateDimensions(): Dimensions {
      const offset = 42;
      let minWidth = Infinity;
      let maxX = -Infinity;
      let minHeight = Infinity;
      let maxY = -Infinity;
      for (const child of this.children) {
        if (!child) continue;
        if (child.computedPosition.x + child.dimensions.width < minWidth)
          minWidth = child.computedPosition.x + child.dimensions.width;
        if (child.computedPosition.x + child.dimensions.width > maxX)
          maxX = child.computedPosition.x + child.dimensions.width;
        if (child.computedPosition.y + child.dimensions.height < minHeight)
          minHeight = child.computedPosition.y + child.dimensions.height;
        if (child.computedPosition.y + child.dimensions.height > maxY)
          maxY = child.computedPosition.y + child.dimensions.height;
      }
      return {
        width: maxX - this.position.x + offset,
        height: maxY - this.position.y + offset,
      };
    },
    recalculate() {
      this.applyNodeChanges([
        {
          id: this.id,
          type: "dimensions",
          dimensions: this.calculateDimensions(),
        },
      ]);
    },
    handleContextMenu(event: MouseEvent) {
      return;

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
    recalculateIfNodeIsChild(node: Node<EntityStructure>) {
      if (node.parentNode === this.id) {
        this.recalculate();
      }
    },
  },

  mounted() {
    this.emitter.on("force-recalculate", this.recalculate);
    this.emitter.on("node-updated-hidden", this.recalculateIfNodeIsChild);
    const { off } = this.onNodeDragStop((event) =>
      this.recalculateIfNodeIsChild(event.node),
    );
    this.unsubscribe = off;
  },

  beforeUnmount() {
    this.emitter.off("force-recalculate", this.recalculate);
    this.emitter.off("node-updated-hidden", this.recalculateIfNodeIsChild);
    this.unsubscribe?.();
  },

  setup() {
    const { addSelectedNodes, getNode, applyNodeChanges, onNodeDragStop } =
      useVueFlow();

    return {
      Position,
      addSelectedNodes,
      getNode,
      applyNodeChanges,
      onNodeDragStop,
    };
  },
});
</script>
