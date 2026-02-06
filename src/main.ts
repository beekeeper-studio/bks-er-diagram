import "@beekeeperstudio/plugin/dist/eventForwarder";
import { createApp } from "vue";
import "@/assets/styles/main.scss";
import App from "./App.vue";
import {
  openExternal,
} from "@beekeeperstudio/plugin";
import { VueKeyboardTrapDirectivePlugin } from "@pdanpdan/vue-keyboard-trap";
import pluralize from "pluralize";
import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import { useContextMenu } from "./composables/useContextMenu";
import type { MenuItem } from "primevue/menuitem";
import ThemePlugin from "@/plugins/Theme";

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
app.use({
  install(app) {
    app.config.globalProperties.$bks = {
      openMenu(event: MouseEvent, items: MenuItem[]) {
        const contextMenu = useContextMenu();
        contextMenu.openMenu(event, items);
      },
    };
  },
});
app.use(ThemePlugin);
app.config.globalProperties.$pluralize = pluralize;
app.config.globalProperties.$openExternal = openExternal;
app.mount("#app");
