<template>
  <!-- horizontal scrollbar -->
  <div class="scrollbar-h" style="
      position: absolute;
      left: 4px;
      right: 12px;
      bottom: 4px;
      height: 12px;
      background-color: var(--theme-scrollbar-track);
      user-select: none;
    " v-show="showHorizontalScrollbar">
    <div class="thumb" :style="hThumbStyle" @mousedown="startHDrag" style="
        position: absolute;
        background-color: var(--theme-scrollbar-thumb);
        border-radius: 3px;
        cursor: pointer;
        height: 100%;
      "></div>
  </div>

  <!-- vertical scrollbar -->
  <div class="scrollbar-v" style="
      position: absolute;
      top: 4px;
      bottom: 12px;
      right: 4px;
      width: 12px;
      background-color: var(--theme-scrollbar-track);
      user-select: none;
    " v-show="showVerticalScrollbar">
    <div class="thumb" :style="vThumbStyle" @mousedown="startVDrag" style="
        position: absolute;
        background-color: var(--theme-scrollbar-thumb);
        border-radius: 3px;
        cursor: pointer;
        width: 100%;
      "></div>
  </div>
</template>

<script lang="ts">
import { useSchemaDiagram } from '@/composables/useSchemaDiagram';
import { mapActions, mapGetters } from 'pinia';
import { defineComponent } from 'vue';

export default defineComponent({
  props: {
    containerWidth: {
      type: Number,
      required: true,
    },
    containerHeight: {
      type: Number,
      required: true,
    },
  },

  data() {

    return {
      // drag state for horizontal
      dragH: {
        active: false,
        startX: 0,
        startFrac: 0,
        startMax: 0,
        startMin: 0,
      },
      // drag state for vertical
      dragV: {
        active: false,
        startY: 0,
        startFrac: 0,
        startMax: 0,
        startMin: 0,
      },
    }
  },


  computed: {
    ...mapGetters(useSchemaDiagram, [
      'rectOfDiagram',
      'viewport'
    ]),

    /* =========================================================
       HORIZONTAL SCROLLBAR (elastic)
       ========================================================= */
    worldWidthScreen() { return this.rectOfDiagram.width * this.viewport.zoom },
    rectLeftScreen() {
      return this.rectOfDiagram.x * this.viewport.zoom
    },
    maxScrollScreenX() {
      return Math.max(0, this.worldWidthScreen - this.containerWidth)
    },
    baseMaxViewportX() {
      return this.rectLeftScreen;
    },
    baseMinViewportX() {
      return this.rectLeftScreen - this.maxScrollScreenX;
    },
    dynamicMaxViewportX() {
      return Math.max(this.baseMaxViewportX, this.viewport.x);
    },
    dynamicMinViewportX() {
      return Math.min(this.baseMinViewportX, this.viewport.x);
    },
    scrollRangeScreenX() {
      const range = this.dynamicMaxViewportX - this.dynamicMinViewportX;
      return range <= 0 ? this.containerWidth || 1 : range;
    },
    scrolledScreenX() {
      return this.dynamicMaxViewportX - this.viewport.x
    },
    scrollFracX() {
      return this.scrolledScreenX / this.scrollRangeScreenX
    },
    hThumbStyle() {
      const total = this.scrollRangeScreenX;
      const visible = this.containerWidth || 1;
      let thumbPercent = (visible / total) * 100;
      thumbPercent = Math.max(5, Math.min(thumbPercent, 100));
      const leftPercent = this.scrollFracX * (100 - thumbPercent);
      return {
        width: thumbPercent + "%",
        left: leftPercent + "%",
      };
    },

    /* =========================================================
       VERTICAL SCROLLBAR (elastic) — same idea
       ========================================================= */
    // world height in SCREEN px
    worldHeightScreen() {
      return this.rectOfDiagram.height * this.viewport.zoom
    },
    // const containerHeightScreen = containerHeight;
    // top of diagram in SCREEN px
    rectTopScreen() {
      return this.rectOfDiagram.y * this.viewport.zoom
    },
    // how much we can scroll normally (SCREEN px)
    maxScrollScreenY() {
      return Math.max(0, this.worldHeightScreen- this.containerHeight)
    },
    // base range
    baseMaxViewportY() {
      return this.rectTopScreen; // topmost
    },
    baseMinViewportY() {
      return this.rectTopScreen- this.maxScrollScreenY// bottom-most (likely negative)
    },
    // extend to include overshoot
    dynamicMaxViewportY() {
      return Math.max(this.baseMaxViewportY, this.viewport.y);
    },
    dynamicMinViewportY() {
      return Math.min(this.baseMinViewportY, this.viewport.y);
    },
    // total range
    scrollRangeScreenY() {
      const range = this.dynamicMaxViewportY - this.dynamicMinViewportY;
      return range <= 0 ? this.containerHeight|| 1 : range;
    },
    // how far we’ve scrolled down, in SCREEN px
    scrolledScreenY() {
      return this.dynamicMaxViewportY- this.viewport.y;
    },
    // fraction
    scrollFracY() {
      return this.scrolledScreenY/ this.scrollRangeScreenY;
    },
    // thumb style
    vThumbStyle() {
      const total = this.scrollRangeScreenY;
      const visible = this.containerHeight || 1;
      let thumbPercent = (visible / total) * 100;
      thumbPercent = Math.max(5, Math.min(thumbPercent, 100));
      const topPercent = this.scrollFracY * (100 - thumbPercent);
      return {
        height: thumbPercent + "%",
        top: topPercent + "%",
      };
    },
    showVerticalScrollbar() {
      const total = this.scrollRangeScreenY;
      const visible = this.containerHeight || 1;
      return total > visible;
    },
    showHorizontalScrollbar() {
      const total = this.scrollRangeScreenX;
      const visible = this.containerWidth || 1;
      return total > visible;
    },
  },

  methods: {
    ...mapActions(useSchemaDiagram, ['setViewport']),


    /* =========================================================
       HORIZONTAL SCROLLBAR (elastic)
       ========================================================= */
    startHDrag(e: MouseEvent) {
      this.dragH.active = true;
      this.dragH.startX = e.clientX;
      this.dragH.startFrac = this.scrollFracX;
      this.dragH.startMax = this.dynamicMaxViewportX;
      this.dragH.startMin = this.dynamicMinViewportX;
      window.addEventListener("mousemove", this.onHDrag);
      window.addEventListener("mouseup", this.stopHDrag);
    },
    onHDrag(e: MouseEvent) {
      if (!this.dragH.active) return;
      const trackPx = this.containerWidth;
      if (!trackPx) return;
      const range = this.dragH.startMax - this.dragH.startMin;
      const effectiveRange = range <= 0 ? trackPx : range;

      const ratio = Math.min(1, trackPx / effectiveRange);
      const thumbPx = trackPx * ratio;
      const movablePx = trackPx - thumbPx;
      if (movablePx <= 0) return;

      const dx = e.clientX - this.dragH.startX;
      let nextFrac = this.dragH.startFrac + dx / movablePx;
      nextFrac = Math.max(0, Math.min(1, nextFrac));

      const nextScrolledScreenX = nextFrac * effectiveRange;
      const nextViewportX = this.dragH.startMax - nextScrolledScreenX;

      this.setViewport({ ...this.viewport, x: nextViewportX });
      this.viewport.x = nextViewportX;
    },
    stopHDrag() {
      this.dragH.active = false;
      window.removeEventListener("mousemove", this.onHDrag);
      window.removeEventListener("mouseup", this.stopHDrag);
    },

    /* =========================================================
       VERTICAL SCROLLBAR (elastic) — same idea
       ========================================================= */
    startVDrag(e: MouseEvent) {
      this.dragV.active = true;
      this.dragV.startY = e.clientY;
      this.dragV.startFrac = this.scrollFracY;
      this.dragV.startMax = this.dynamicMaxViewportY;
      this.dragV.startMin = this.dynamicMinViewportY;
      window.addEventListener("mousemove", this.onVDrag);
      window.addEventListener("mouseup", this.stopVDrag);
    },
    onVDrag(e: MouseEvent) {
      if (!this.dragV.active) return;
      const trackPx = this.containerHeight;
      if (!trackPx) return;
      const range = this.dragV.startMax - this.dragV.startMin;
      const effectiveRange = range <= 0 ? trackPx : range;

      const ratio = Math.min(1, trackPx / effectiveRange);
      const thumbPx = trackPx * ratio;
      const movablePx = trackPx - thumbPx;
      if (movablePx <= 0) return;

      const dy = e.clientY - this.dragV.startY;
      let nextFrac = this.dragV.startFrac + dy / movablePx;
      nextFrac = Math.max(0, Math.min(1, nextFrac));

      const nextScrolledScreenY = nextFrac * effectiveRange;
      const nextViewportY = this.dragV.startMax - nextScrolledScreenY;

      this.setViewport({ ...this.viewport, y: nextViewportY });
      this.viewport.y = nextViewportY;
    },
    stopVDrag() {
      this.dragV.active = false;
      window.removeEventListener("mousemove", this.onVDrag);
      window.removeEventListener("mouseup", this.stopVDrag);
    },
  },

  beforeUnmount() {
    this.stopHDrag();
    this.stopVDrag();
  },
})
</script>
