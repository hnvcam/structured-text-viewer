import type { ElectrobunConfig } from "electrobun";

// The CLI honours build.watchIgnore (see node_modules/electrobun/src/cli/index.ts)
// but the published ElectrobunConfig type doesn't declare it yet.
type Config = ElectrobunConfig & { build?: { watchIgnore?: string[] } };

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
    mac: {
      // Local, unsigned build. Set both to true (with Apple Developer
      // credentials in env) to produce a distributable signed app.
      codesign: false,
      notarize: false,
      bundleCEF: false,
      defaultRenderer: "native",
    },
    linux: {
      defaultRenderer: "cef",
      bundleCEF: true,
    },
  },
  scripts: {
    postBuild: "./scripts/post-build.ts",
  },
} satisfies Config;
