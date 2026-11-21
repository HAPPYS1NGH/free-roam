import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig(({ command, mode }) => ({
  plugins: [react()],
  // Personal exports are available only in the explicitly requested local studio.
  publicDir: command === "serve" && mode === "studio" ? "public" : ".site-public",
  // The studio imports the wheel's sounds straight from assets/sounds/.
  server: { fs: { allow: [".", "../assets/sounds"] } },
  build: {
    // The coast drive's lazy chunk (three.js) is about 650 kB; only capable
    // desktops load it, after the page has painted.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: { site: "index.html", notFound: "404.html" },
    },
  },
}))
