<template>
  <div class="er-diagram-visualizer">
    <div class="group-btn menubar">
      <button class="btn btn-fab btn-flat-2">
        <span class="material-symbols-outlined">menu</span>
        <span class="title-popup" data-position="bottom">Menu</span>
      </button>
    </div>
    <div class="group-btn group-history">
      <button class="btn btn-fab btn-flat-2">
        <span class="material-symbols-outlined">undo</span>
        <span class="title-popup">Undo</span>
      </button>
      <button class="btn btn-fab btn-flat-2">
        <span class="material-symbols-outlined">redo</span>
        <span class="title-popup">Redo</span>
      </button>
    </div>
    <div class="group-btn group-navigation">
      <button class="btn btn-fab btn-flat-2">
        <span class="material-symbols-outlined">remove</span>
        <span class="title-popup">Zoom out</span>
      </button>
      <span>100%</span>
      <button class="btn btn-fab btn-flat-2">
        <span class="material-symbols-outlined">add</span>
        <span class="title-popup">Zoom in</span>
      </button>
      <button class="btn btn-fab btn-flat-2">
        <span class="material-symbols-outlined">help</span>
        <span class="title-popup">Help</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts"></script>
