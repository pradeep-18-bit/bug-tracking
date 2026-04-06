import path from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["recharts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
