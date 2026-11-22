import type { PostHog, Properties } from "posthog-js"
import { downloadUrl } from "./content"

// Landing page analytics only; the Mac app sends nothing.
// Nothing is stored on the visitor's device (no cookies or storage), so no consent banner
// is needed. The cost: each page load counts as a new visitor. PostHog keeps the IP for
// country and city. Requests go through /ingest (see vercel.json) so the page only talks
// to its own origin.
const projectKey = "phc_oMzhikPNHQHGAsntp3T4Y8joheNAemYNLPTXxbA9h8Bx"

let posthog: PostHog | null = null
// Events from before the SDK finishes loading. null means analytics is off for this visit.
let pending: [string, Properties | undefined][] | null = null

export function track(event: string, properties?: Properties) {
  if (posthog) posthog.capture(event, properties)
  else pending?.push([event, properties])
}

function visitorOptedOut() {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  return nav.globalPrivacyControl === true
}

// Sections are named by their heading id, so rewording the copy doesn't rename them.
const sectionNames: Record<string, string> = {
  "ta-title": "hero",
  "mac-title": "on-your-mac",
  "dial-title": "stations",
  "how-title": "how-it-works",
  "faq-title": "faq",
  "ta-closing-title": "closing",
  "nudge-title": "nudge",
}

export function sectionName(element: Element | null) {
  if (!element) return "other"
  if (element.tagName === "HEADER") return "nav"
  if (element.tagName === "FOOTER") return "footer"
  const heading = element.getAttribute("aria-labelledby") ?? ""
  return sectionNames[heading] ?? (heading || "other")
}

function watchPage() {
  document.addEventListener("click", (event) => {
    // Off a Mac the links point at the release page and send the link instead; DownloadLink tracks those.
    const link = (event.target as Element).closest(`a[href="${downloadUrl}"]`)
    if (link) track("download_clicked", { placement: sectionName(link.closest("header, footer, section")) })
  })

  // toggle doesn't bubble, so listen in the capture phase.
  document.addEventListener("toggle", (event) => {
    const details = event.target
    if (!(details instanceof HTMLDetailsElement) || !details.open) return
    const question = details.querySelector("summary")?.firstChild?.textContent ?? "unknown"
    track("faq_opened", { question })
  }, true)

  // How far down the page people get, by section, for the drop-off funnel.
  const seen = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      track("section_viewed", { section: sectionName(entry.target) })
      seen.unobserve(entry.target)
    }
  }, { threshold: 0.4 })
  document.querySelectorAll("main section").forEach((section) => seen.observe(section))
}

export function startAnalytics() {
  if (!import.meta.env.PROD || location.hostname === "localhost" || visitorOptedOut()) return
  pending = []
  watchPage()

  // Loaded after the page renders so analytics never delays it.
  import("posthog-js").then(({ default: client }) => {
    client.init(projectKey, {
      api_host: "/ingest",
      ui_host: "https://us.posthog.com",
      persistence: "memory",
      person_profiles: "identified_only",
      respect_dnt: true,
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: true,
      capture_dead_clicks: true,
      enable_heatmaps: true,
      capture_performance: { web_vitals: true, network_timing: true },
      capture_exceptions: true,
      disable_session_recording: true,
      disable_surveys: true,
      disable_product_tours: true,
      disable_web_experiments: true,
    })
    posthog = client
    for (const [event, properties] of pending ?? []) client.capture(event, properties)
    pending = []
  }).catch((error: unknown) => console.warn("Analytics didn't load.", error))
}
