<template>
  <div class="zoom-controls">
    <button class="btn btn-fab btn-flat" @click="zoomOut()">
      <span class="material-symbols-outlined">remove</span>
      <span class="title-popup">Zoom out</span>
    </button>
    <input type="text" class="zoom-input" :value="zoomLevel" @change="handleChangeZoomLevel"
      @keydown.enter="handleChangeZoomLevel" />
    <button class="btn btn-fab btn-flat" @click="zoomIn()">
      <span class="material-symbols-outlined">add</span>
      <span class="title-popup">Zoom in</span>
    </button>
  </div>
</template>

<script lang="ts">
import _ from "lodash";
import { useSchemaDiagram } from "@/composables/useSchemaDiagram";
import { defineComponent } from "vue";
import { mapActions, mapGetters } from "pinia";

export default defineComponent({
  computed: {
    ...mapGetters(useSchemaDiagram, ["zoomLevel"]),
  },
  methods: {
    ...mapActions(useSchemaDiagram, ["zoomTo", "zoomOut", "zoomIn"]),
    handleChangeZoomLevel(e: Event) {
      const el = e.target as HTMLInputElement;
      const value = Math.abs(_.toNumber(el.value.replace("%", "")));
      if (_.isNaN(value)) {
        return;
      }
      this.zoomTo(value);
    },
  },
});
</script>
