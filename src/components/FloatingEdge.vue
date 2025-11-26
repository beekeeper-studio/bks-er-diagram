<template>
  <path :id="id" class="edge-path" :class="{ highlighted }" :d="d" :marker-start="`url(#${markerStartId})`"
    :marker-end="`url(#${markerEndId})`" fill="none" stroke-width="2" :stroke="stroke" />
  <path fill="none" class="vue-flow__edge-interaction" :d="d" stroke-opacity="0" stroke-width="30" />
  <CrowsFootMarker :id="markerStartId" :highlighted="highlighted" :type="markerStartType" :stroke="stroke"
    debug-label="F" />
  <CrowsFootMarker :id="markerEndId" :highlighted="highlighted" :type="markerEndType" :stroke="stroke"
    debug-label="T" />
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
import { mapActions } from "pinia";
import CrowsFootMarker from "@/components/CrowsFootMarker.vue";
import type { Theme } from "@/plugins/Theme";

type Props = EdgeProps<EdgeData>;

export default defineComponent({
  // Avoid vue flow from adding unneeded attributes to the root element
  inheritAttrs: false,

  components: { CrowsFootMarker },

  inject: {
    theme: {
      from: "theme",
      default: () => ({
        edgeStroke: "#000",
        highlightedEdgeStroke: "#000",
        selectedEdgeStroke: "#000",
        diagramBg: "#000",
        appTheme: {},
      }) as Theme,
    }
  },

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
    selected: Boolean as PropType<Props["selected"]>,
    style: Object as PropType<Props["style"]>,
  },

  computed: {
    // To make html-to-image work, many of these svg's props are not styled
    // from css directly
    stroke() {
      const theme = this.theme as Theme;
      if (this.selected) {
        return theme.selectedEdgeStroke;
      }
      if (this.highlighted) {
        return theme.highlightedEdgeStroke;
      }
      return theme.edgeStroke;
    },

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
      const selfReferential = this.source === this.target;

      if (selfReferential) {
        const handle1 = this.sourceNode.handleBounds.source!.find(
          (h) => h.id === `${Position.Right}-${getHandleId(this.data.from)}`,
        );

        if (!handle1) return "";

        const handle2 = this.targetNode.handleBounds.source!.find(
          (h) => h.id === `${Position.Right}-${getHandleId(this.data.to)}`,
        );

        if (!handle2) return "";

        let offsetX = handle1.width + 18;
        const offsetY1 = handle1.height / 2;
        const offsetY2 = handle2.height / 2;

        const x = this.sourceNode.computedPosition.x + handle1.x + offsetX;
        const y1 = this.sourceNode.computedPosition.y + handle1.y + offsetY1;
        const y2 = this.targetNode.computedPosition.y + handle2.y + offsetY2;

        return `M ${x} ${y1} C ${x + 50} ${y1}, ${x + 50} ${y2}, ${x} ${y2}`;
      }

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
          const origin = node.computedPosition.x;
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
          const origin = node.computedPosition.x;
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
      const fromEntity = this.findEntityStructure(
        "table",
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
    ...mapActions(useSchema, ["findColumnStrucuture", "findEntityStructure"]),
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
