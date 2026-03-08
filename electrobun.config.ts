import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "Structured Text Viewer",
    identifier: "com.structured-text-viewer.app",
    version: "1.0.0",
    description: "A beautiful local Markdown & Mermaid file explorer and viewer",
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts",
    },
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
    },
    watchIgnore: ["dist/**"],
    win: {
      defaultRenderer: "native",
    },
  },
} satisfies ElectrobunConfig;
