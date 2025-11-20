<template>
  <Dialog :visible="visible" @update:visible="$emit('update:visible', $event)" modal header="Export Diagram"
    dismissable-mask :draggable="false" :closable="false" class="export-diagram-dialog">
    <section>
      <div style="margin-bottom: 0.5rem">Preview</div>
      <div class="preview">
        <!-- THIS SHOULD NOT APPEAR BUT JUST IN CASE -->
        <button class="btn btn-primary" v-if="state === 'idle'" @click="initialize">
          Generate image
        </button>
        <ProgressSpinner v-else-if="state === 'generating'" />
        <img v-else="pngUrl" :src="nonscaledImage" />
      </div>
    </section>
    <section>
      <div class="option-group">
        <div>
          <label class="option-label" id="export-image-scale">Scale</label>
          <div class="helper" id="export-image-scale-hint">
            Adjust the size of the exported image
          </div>
        </div>
        <SelectButton v-model="scale" :options="scaleOptions" option-label="label" option-value="value"
          aria-labelledby="export-image-scale" aria-describedby="export-image-scale-hint" />
      </div>
    </section>
    <div class="alert alert-danger" v-text="error" v-if="error" />
    <template #footer>
      <button class="btn" @click="$emit('update:visible', false)">Close</button>
      <button class="btn btn-primary" @click="copyToClipboard" :disabled="copyState === 'copying'"
        :data-state="copyState">
        <span class="material-symbols-outlined">content_copy</span>
        <template v-if="copyState === 'copying'">Copying...</template>
        <template v-else>Copy to clipboard</template>
      </button>
      <button class="btn btn-primary" @click="downloadPng" :disabled="downloadState === 'downloading'"
        :data-state="downloadState">
        <span class="material-symbols-outlined">download</span>
        Export as PNG
      </button>
    </template>
  </Dialog>
</template>

<script lang="ts">
import { useSchemaDiagram } from "@/composables/useSchemaDiagram";
import { request } from "@beekeeperstudio/plugin";
import { mapActions } from "pinia";
import { defineComponent } from "vue";
import Dialog from "primevue/dialog";
import ProgressSpinner from "primevue/progressspinner";
import SelectButton from "primevue/selectbutton";

export default defineComponent({
  props: {
    visible: Boolean,
  },

  emits: ["update:visible"],

  components: {
    Dialog,
    ProgressSpinner,
    SelectButton,
  },

  data() {
    return {
      nonscaledImage: "",
      state: "idle" as "idle" | "generating" | "ready",
      downloadState: "idle" as "idle" | "downloading" | "downloaded",
      copyState: "idle" as "idle" | "copying" | "copied",
      scale: 1,
      scaleOptions: [
        { label: "1x", value: 1 },
        { label: "2x", value: 2 },
        { label: "4x", value: 4 },
      ],
      downloaded: false,
      error: "",
    };
  },

  watch: {
    visible(visible) {
      if (visible) {
        this.initialize();
      }
    },
  },

  methods: {
    ...mapActions(useSchemaDiagram, ["generatePng"]),
    async initialize() {
      this.nonscaledImage = "";
      this.state = "generating";
      try {
        const png = await this.generatePng({
          scale: 1,
        });
        this.nonscaledImage = png;
        this.state = "ready";
      } catch (e) {
        this.error = e.message || e.toString();
        console.error(e);
        this.state = "idle";
      }
    },

    async getImageAtScale() {
      // If scale is 1x, use the preview
      if (this.scale === 1) {
        return this.nonscaledImage;
      }
      // Otherwise generate at the selected scale
      return await this.generatePng({ scale: this.scale });
    },

    async copyToClipboard() {
      this.copyState = "copying";

      try {
        const dataUrl = await this.getImageAtScale();
        await request({
          name: "clipboard.writeImage",
          args: {
            data: dataUrl,
          },
        });
      } catch (e) {
        this.error = e.message || e.toString();
      }

      this.copyState = "copied";
      setTimeout(() => {
        this.copyState = "idle";
      }, 1000);
    },

    async downloadPng() {
      this.downloadState = "downloading";

      try {
        const dataUrl = await this.getImageAtScale();
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
        await request({
          name: "requestFileSave",
          args: {
            data: base64,
            fileName: "schema-diagram.png",
            encoding: "base64",
            filters: [
              { name: "PNG", extensions: ["png"] },
              { name: "All Files", extensions: ["*"] },
            ],
          },
        });
      } catch (e) {
        this.error = e.message || e.toString();
      }

      this.downloadState = "downloaded";
      setTimeout(() => {
        this.downloadState = "idle";
      }, 1000);
    },
  },
});
</script>
