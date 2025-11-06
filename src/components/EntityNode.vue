<template>
  <div class="entity-node" :class="{ highlighted }">
    <Handle type="source" :position="Position.Top" :connectable="false" />
    <Handle type="source" :position="Position.Bottom" :connectable="false" />
    <div style="height: 2.5rem; width: 100%; display: flex; align-items: center">
      <div style="
          font-weight: bold;
          text-align: center;
          display: flex;
          padding-left: 0.75rem;
        ">
        <span class="material-symbols-outlined" style="
            font-size: 1.25em;
            margin-right: 0.5rem;
            color: var(--theme-primary);
          ">
          grid_on
        </span>
        <span>
          {{ data.name }}
        </span>
      </div>
      <button class="btn btn-fab btn-flat" style="margin-left: auto; margin-right: 0.5rem">
        <span class="material-symbols-outlined">more_vert</span>
      </button>
    </div>
    <div>
      <ul style="margin: 0; padding: 0; list-style: none">
        <li v-for="column in columns" :key="column.name" style="position: relative; margin: 0; padding: 0" :class="{
          'primary-key': column.primaryKey,
          'foreign-key': column.foreignKey,
        }">
          <div style="
              display: flex;
              align-items: center;
              height: 2.75rem;
              padding-left: 0.75rem;
              padding-right: 1rem;
            ">
            <span style="
                --icon-size: 1.25em;
                display: inline-flex;
                width: var(--icon-size);
                margin-right: 0.5rem;
              ">
              <span v-if="column.primaryKey || column.foreignKey" class="material-symbols-outlined key-icon" style="
                  font-size: var(--icon-size);
                  font-variation-settings: &quot;FILL&quot; 1;
                ">
                vpn_key
              </span>
            </span>
            <span style="margin-right: 0.5rem">
              {{ column.name }}
            </span>
            <span style="margin-left: auto; color: var(--text-muted-2)">
              {{ column.type }}
            </span>
          </div>
          <template v-if="column.hasReferences">
            <Handle type="source" :position="Position.Right" :id="`${Position.Right}-${column.handleId}`"
              :connectable="false" />
            <Handle type="source" :position="Position.Left" :id="`${Position.Left}-${column.handleId}`"
              :connectable="false" />
          </template>
        </li>
      </ul>
    </div>
  </div>
</template>

<script lang="ts">
import {
  useSchemaDiagram,
  type EntityStructure,
} from "@/composables/useSchemaDiagram";
import {
  Handle,
  Position,
  useVueFlow,
  type EdgeUpdateEvent,
  type NodeProps,
} from "@vue-flow/core";
import { mapGetters } from "pinia";
import {
  computed,
  defineComponent,
  onMounted,
  onUnmounted,
  type PropType,
} from "vue";

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
  },

  data() {
    return {
      unmountedCallbacks: [] as Function[],
    };
  },

  computed: {
    ...mapGetters(useSchemaDiagram, ["selectedNodes"]),
    columns() {
      return this.data.columns.sort(
        (a, b) => a.ordinalPosition - b.ordinalPosition,
      );
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

  setup() {
    const { getConnectedEdges } = useVueFlow();
    return {
      Position,
      getConnectedEdges,
    };
  },
});
</script>
