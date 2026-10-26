import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { FullDemo } from "./free-roam/FullDemo"
import "./free-roam/styles.css"

createRoot(document.getElementById("root")!).render(<StrictMode><FullDemo /></StrictMode>)
