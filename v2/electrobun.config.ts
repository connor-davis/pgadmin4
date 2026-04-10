import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "pgAdmin 4",
    identifier: "org.pgadmin.pgadmin4",
    version: "0.1.0",
  },
  build: {
    // Electrobun bundles this file and places main.js in views/mainview/
    views: {
      mainview: { entrypoint: "src/bun/views/mainview.ts" },
    },
    // Vite builds to dist/, Electrobun copies it into the app bundle alongside main.js
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
    },
    // Don't watch Vite output in watch mode — HMR handles view rebuilds separately
    watchIgnore: ["dist/**"],
    mac: {
      bundleCEF: false,
    },
    linux: {
      bundleCEF: false,
    },
    win: {
      bundleCEF: false,
    },
  },
} satisfies ElectrobunConfig;
