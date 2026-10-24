import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { wheel: "index.html", freeRoam: "free-roam/index.html" },
    },
  },
})
