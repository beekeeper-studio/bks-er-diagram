import "@beekeeperstudio/plugin/dist/eventForwarder.js";
import { createApp } from "vue";
import "@/assets/styles/main.scss";
import App from "./App.vue";
import {
  addNotificationListener,
  getAppInfo,
  getViewContext,
  log,
  openExternal,
  type AppTheme,
} from "@beekeeperstudio/plugin";
import { VueKeyboardTrapDirectivePlugin } from "@pdanpdan/vue-keyboard-trap";
import pluralize from "pluralize";
import { createPinia } from "pinia";
import PrimeVue from 'primevue/config';

function applyTheme(theme: AppTheme) {
  document.querySelector("#app-theme")!.textContent =
    `:root { ${theme.cssString} }`;
}

// Initialize theme
getAppInfo().then((app) => applyTheme(app.theme));

// Sync with app theme
addNotificationListener("themeChanged", (theme) => applyTheme(theme));

if (import.meta.env.DEV) {
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "r") {
      window.location.reload();
    }
  });
}

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(PrimeVue);
app.use(VueKeyboardTrapDirectivePlugin, {});
app.config.globalProperties.$pluralize = pluralize;
app.config.globalProperties.$openExternal = openExternal;
app.mount("#app");
