import { defineConfig, loadEnv } from "vite";
import fs from "fs";
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
import pkg from "./package.json";

// https://vitejs.dev/config/
export default ({ mode }) => {
  const isEnvDevelopment = mode === "development";
  const isEnvProduction = mode === "production";

  const env = loadEnv(mode, process.cwd(), "");

  fs.rmSync("build/electron", { recursive: true, force: true });

  return defineConfig({
    server: {
      host: env.HOST || "127.0.0.1",
      port: env.PORT || 5173,
    },
    plugins: [
      vue(),
      vueJsx(),
      electron({
        entry: "src/entrys/main.js",
        onstart(options) {
          options.startup();
        },
        vite: {
          build: {
            sourcemap: isEnvDevelopment,
            minify: isEnvProduction,
            outDir: "build/electron",
            rollupOptions:
              Object.keys(pkg).indexOf("dependencies") !== -1
                ? pkg.dependencies
                : {},
          },
        },
      }),
      renderer(),
    ],
    clearScreen: false,
  });
};
