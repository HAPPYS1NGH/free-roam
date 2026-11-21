import { StrictMode } from "react"
import { createRoot, hydrateRoot } from "react-dom/client"
import { LandingPage } from "./LandingPage"
import "./page.css"
import "./hero.css"

const root = document.getElementById("root")!
const page = <StrictMode><LandingPage /></StrictMode>
if (root.hasChildNodes()) hydrateRoot(root, page)
else createRoot(root).render(page)
