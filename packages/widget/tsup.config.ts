import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    vanilla: "src/vanilla.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  minify: true,
  sourcemap: true,
  splitting: false,
  external: ["react", "react-dom"],
  injectStyle: false,
});
