<template>
  <g :class="{ highlighted }">
    <g class="vue-flow__connection">
      <path :id="id" class="vue-flow__edge-path edge-path" :d="d" :marker-start="`url(#${markerStartId})`"
        :marker-end="`url(#${markerEndId})`" :style="style" />
    </g>

    <CrowsFootMarker :id="markerStartId" :type="markerStartType" :width="18" :height="18" :stroke="'var(--edge-stroke)'"
      debug-label="F" />
    <CrowsFootMarker :id="markerEndId" :type="markerEndType" debug-label="T" :width="18" :height="18"
      :stroke="'var(--edge-stroke)'" />
  </g>
</template>

<script lang="ts">
import {
  type EdgeProps,
  getBezierPath,
  Position,
  useVueFlow,
} from "@vue-flow/core";
import { getEdgeParams } from "@/utils/floatingEdgeHelpers";
import { defineComponent, type PropType } from "vue";
import { getHandleId, type EdgeData } from "@/composables/useSchemaDiagram";
import { useSchema } from "@/composables/useSchema";
import {
  type Column,
  type ColumnStructure,
  type ColumnReference,
} from "@/composables/useSchemaDiagram";
import { mapActions } from "pinia";
import CrowsFootMarker from "@/components/CrowsFootMarker.vue";

type Props = EdgeProps<EdgeData>;

export default defineComponent({
  // Avoid vue flow from adding unneeded attributes to the root element
  inheritAttrs: false,

  components: { CrowsFootMarker },

  props: {
    id: {
      type: String as PropType<Props["id"]>,
      required: true,
    },
    source: {
      type: String as PropType<Props["source"]>,
      required: true,
    },
    target: {
      type: String as PropType<Props["target"]>,
      required: true,
    },
    sourceNode: {
      type: Object as PropType<Props["sourceNode"]>,
      required: true,
    },
    targetNode: {
      type: Object as PropType<Props["targetNode"]>,
      required: true,
    },
    data: {
      type: Object as PropType<Props["data"]>,
      required: true,
    },
    style: Object as PropType<Props["style"]>,
  },

  computed: {
    edgeParams() {
      const params = getEdgeParams(this.sourceNode, this.targetNode, this.data);

      // Add some padding
      const padding = 18;
      switch (params.sourcePos) {
        case Position.Left:
          params.sx -= padding;
          break;
        case Position.Right:
          params.sx += padding;
          break;
        case Position.Top:
          params.sy -= padding;
          break;
        case Position.Bottom:
          params.sy += padding;
          break;
      }
      switch (params.targetPos) {
        case Position.Left:
          params.tx -= padding;
          break;
        case Position.Right:
          params.tx += padding;
          break;
        case Position.Top:
          params.ty -= padding;
          break;
        case Position.Bottom:
          params.ty += padding;
          break;
      }

      return params;
    },
    sourceHandleId() {
      const position = this.edgeParams.sourcePos;
      if (position === Position.Left || position === Position.Right) {
        return `${position}-${getHandleId(this.data.from)}`;
      }
      return "";
    },
    targetHandleId() {
      const position = this.edgeParams.targetPos;
      if (position === Position.Left || position === Position.Right) {
        return `${position}-${getHandleId(this.data.to)}`;
      }
      return "";
    },
    highlighted() {
      return this.sourceNode.selected || this.targetNode.selected;
    },
    d() {
      if (this.edgeParams.sx) {
        let sourceX = this.edgeParams.sx;
        let targetX = this.edgeParams.tx;

        if (
          this.edgeParams.sourcePos === Position.Top ||
          this.edgeParams.sourcePos === Position.Bottom
        ) {
          const edges = this.getEdges.filter(
            (edge) => edge.source === this.source,
          );
          const idx = edges.findIndex((edge) => edge.id === this.id);
          const node = this.findNode(this.source)!;
          const origin = node.position.x;
          const x = (node.dimensions.width * (idx + 1)) / (1 + edges.length);
          sourceX = origin + x;
        }

        if (
          this.edgeParams.targetPos === Position.Top ||
          this.edgeParams.targetPos === Position.Bottom
        ) {
          const edges = this.getEdges.filter(
            (edge) => edge.target === this.target,
          );
          const idx = edges.findIndex((edge) => edge.id === this.id);
          const node = this.findNode(this.target)!;
          const origin = node.position.x;
          const x = (node.dimensions.width * (idx + 1)) / (1 + edges.length);
          targetX = origin + x;
        }

        const [path] = getBezierPath({
          sourceX,
          sourceY: this.edgeParams.sy,
          targetX,
          targetY: this.edgeParams.ty,
          sourcePosition: this.edgeParams.sourcePos,
          targetPosition: this.edgeParams.targetPos,
        });

        if (this.source === this.target) {
          // FIXME we don't need to use getBezierPath for self referential
          // relations like this
          let [i, j, k, l] = path.split(" ") as [
            `M${string}`,
            `C${string}`,
            string,
            string,
          ];

          let [j0, j1] = j.split(",");
          j0 = (Number(j0!.slice(1)) + 50).toString();
          j = `C${j0},${j1}`;

          let [k0, k1] = k!.split(",");
          k0 = (Number(k0!) + 50).toString();
          k = `${k0},${k1}`;

          return `${i} ${j} ${k} ${l}`;
        }
        return path;
      }

      return "";
    },
    markerStartId() {
      return `${this.id}-marker-start`;
    },
    markerEndId() {
      return `${this.id}-marker-end`;
    },
    markerStartType() {
      return this.cardinality.from;
    },
    markerEndType() {
      return this.cardinality.to;
    },
    cardinality(): {
      from: "none" | "one" | "one-or-many";
      to: "none" | "one" | "one-or-many";
    } {
      const fromEntity = this.findColumnStructuresByEntity(
        this.data.from.entity,
      );

      const fromColumn = this.findColumnStrucuture(this.data.from);

      if (!fromEntity || !fromColumn) {
        return {
          from: "none",
          to: "none",
        };
      }

      if (fromEntity.isComposite && fromColumn.foreignKey) {
        return {
          from: "one-or-many",
          to: "one",
        };
      }

      if (fromColumn.foreignKey && fromColumn.primaryKey) {
        return {
          from: "one",
          to: "one",
        };
      }

      if (fromColumn.foreignKey) {
        return {
          from: "one-or-many",
          to: "one",
        };
      }

      return {
        from: "none",
        to: "none",
      };
    },
  },

  methods: {
    ...mapActions(useSchema, [
      "findColumnStrucuture",
      "findColumnStructuresByEntity",
    ]),
  },

  setup() {
    const { getEdges, findNode } = useVueFlow();
    return {
      getEdges,
      findNode,
    };
  },
});
</script>
