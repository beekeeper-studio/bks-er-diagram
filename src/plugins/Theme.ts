import {
  addNotificationListener,
  getAppInfo,
  type AppTheme,
} from "@beekeeperstudio/plugin";
import tinycolor from "tinycolor2";
import { ref, type Plugin } from "vue";

export type Theme = {
  edgeStroke: string;
  highlightedEdgeStroke: string;
  selectedEdgeStroke: string;
  diagramBg: string;
  appTheme: AppTheme;
};

/** The generated colors are used for SVGs since html-to-image cannot pickup
 * the colors from the CSS variables. */
const theme = ref<Theme>({
  edgeStroke: "#000",
  highlightedEdgeStroke: "#000",
  selectedEdgeStroke: "#000",
  diagramBg: "#000",
  appTheme: {} as AppTheme,
});

function calculateTheme(theme: AppTheme) {
  const edgeStroke = tinycolor
    .mix(theme.palette.themeBase || "#000", theme.palette.themeBg || "#fff", 90)
    .toHexString();
  const highlightedEdgeStroke = tinycolor
    .mix(theme.palette.themeBase || "#000", theme.palette.themeBg || "#fff", 45)
    .toHexString();
  const selectedEdgeStroke = tinycolor
    .mix(theme.palette.themePrimary || "#0000ff", theme.palette.themeBg || "#fff", 30)
    .toHexString();
  const diagramBg = theme.palette.queryEditorBg || "#fff";

  return {
    edgeStroke,
    highlightedEdgeStroke,
    selectedEdgeStroke,
    diagramBg,
  };
}

// Initialize theme
getAppInfo().then((app) => applyTheme(app.theme));

// Sync with app theme
addNotificationListener("themeChanged", (theme) => applyTheme(theme));

function applyTheme(appTheme: AppTheme) {
  document.querySelector("#app-theme")!.textContent =
    `:root { ${appTheme.cssString} }`;
  theme.value = {
    ...calculateTheme(appTheme),
    appTheme,
  }
}

export function getTheme() {
  return theme.value;
}

const ThemePlugin: Plugin = {
  install(app) {
    app.provide("theme", theme);
  },
};
export default ThemePlugin;
