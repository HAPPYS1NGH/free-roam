import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig(({ command, mode }) => ({
  plugins: [react()],
  // Personal exports are available only in the explicitly requested local studio.
  publicDir: command === "serve" && mode === "studio" ? "public" : ".site-public",
  // The studio imports the wheel's sounds straight from assets/sounds/.
  server: { fs: { allow: [".", "../assets/sounds"] } },
  build: {
    rollupOptions: {
      input: { site: "index.html" },
    },
  },
}))
