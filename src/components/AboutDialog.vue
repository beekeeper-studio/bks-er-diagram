<template>
  <Dialog :visible="visible" @update:visible="$emit('update:visible', $event)" modal header="About" dismissable-mask
    :draggable="false" :closable="false">
    <p>ER Diagram</p>
    <p>Version {{ version }}</p>
    <p>
      <ExternalLink href="https://github.com/beekeeper-studio/bks-er-diagram">
        View on GitHub
      </ExternalLink>
    </p>
    <p>Beekeeper Studio Team</p>
    <template #footer>
      <button class="btn" @click="$emit('update:visible', false)">Close</button>
    </template>
  </Dialog>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import Dialog from "primevue/dialog";
import manifest from "../../manifest.json";
import ExternalLink from "@/components/ExternalLink.vue";

export default defineComponent({
  props: {
    visible: Boolean,
  },

  components: {
    Dialog,
    ExternalLink,
  },

  emits: ["update:visible"],

  data() {
    return {
      version: manifest.version,
    };
  },
});
</script>
