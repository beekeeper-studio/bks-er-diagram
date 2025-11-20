import darkSvg from "@/assets/images/bks-wordmark-dark.svg?inline";
import lightSvg from "@/assets/images/bks-wordmark-light.svg?inline";
import { getTheme } from "@/plugins/Theme";
import materialSymbols from "@material-symbols/font-400/material-symbols-outlined.woff2?inline";
import { toPng } from "html-to-image";

export type AddSvgBelowPngOptions = {
  pngBase64: string;
  svgBase64: string;
  svgAreaHeight: number;
  bgColor?: string;
  padding?: number;
}

export type GenerateImageFromElementOptions = {
  element: HTMLElement;
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
  scale: number;
}

const fontEmbedCSS = `
  @font-face {
    font-family: "Material Symbols Outlined";
    font-style: normal;
    font-weight: 400;
    font-display: block;
    src: url("${materialSymbols}") format("woff2");
  }
`;

export async function generateImageFromElement(options: GenerateImageFromElementOptions) {
  const raw = await toPng(options.element, {
    backgroundColor: getTheme().diagramBg,
    width: options.width,
    height: options.height,
    style: {
      width: `${options.width}px`,
      height: `${options.height}px`,
      transform: `translate(${options.x}px, ${options.y}px) scale(${options.zoom})`,
    },
    pixelRatio: options.scale,
    fontEmbedCSS,
  });
  return await addSvgBelowPng({
    pngBase64: raw,
    svgBase64: getTheme().appTheme.type === "dark" ? darkSvg : lightSvg,
    svgAreaHeight: 70,
    bgColor: getTheme().diagramBg,
    padding: 16,
  });
}

export function addSvgBelowPng(options: AddSvgBelowPngOptions): Promise<string> {
  const padding = options.padding ?? 0;
  const bgColor = options.bgColor || "#ffffff";
  return new Promise((resolve, reject) => {
    const imgPng = new Image();
    const imgSvg = new Image();

    const normalizePng = (b64: string) =>
      b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`;

    const svgBase64 = btoa(unescape(encodeURIComponent(options.svgBase64)));
    const svgDataUrl = `data:image/svg+xml;base64,${svgBase64}`;

    let loaded = 0;
    const onLoad = () => {
      loaded++;
      if (loaded < 2) return;

      const canvasWidth = imgPng.width;
      const canvasHeight = imgPng.height + options.svgAreaHeight;

      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext("2d")!;

      // draw original PNG
      ctx.drawImage(imgPng, 0, 0);

      // draw background strip
      const stripY = imgPng.height;
      ctx.fillStyle = bgColor || "#fff";
      ctx.fillRect(0, stripY, canvasWidth, options.svgAreaHeight);

      // intrinsic SVG size
      const svgW = imgSvg.naturalWidth || imgSvg.width;
      const svgH = imgSvg.naturalHeight || imgSvg.height;

      // padded area
      const maxW = canvasWidth - padding * 2;
      const maxH = options.svgAreaHeight - padding * 2;

      // scale factor: fit into padded area, never upscale
      const scaleW = maxW / svgW;
      const scaleH = maxH / svgH;
      const scale = Math.min(scaleW, scaleH, 1);

      const drawW = svgW * scale;
      const drawH = svgH * scale;

      // center inside padded area
      const x = canvasWidth - drawW - padding;
      const y = stripY + (options.svgAreaHeight - drawH) / 2;

      ctx.drawImage(imgSvg, x, y, drawW, drawH);

      resolve(canvas.toDataURL("image/png"));
    };

    const onError = (e: unknown) => reject(e);

    imgPng.onload = onLoad;
    imgSvg.onload = onLoad;
    imgPng.onerror = onError;
    imgSvg.onerror = onError;

    imgPng.src = normalizePng(options.pngBase64);
    imgSvg.src = svgDataUrl;
  });
}

