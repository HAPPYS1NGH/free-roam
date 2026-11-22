import type { CSSProperties } from "react"
import { Details, HowItWorks } from "./Details"
import { Hero } from "./Hero"
import { OnYourMac } from "./OnYourMac"
import { RadioProvider, useRadio } from "./RadioProvider"
import { SendNudge } from "./SendNudge"
import { Stations } from "./Stations"

export function LandingPage() {
  return <RadioProvider>
    <a className="skip-link" href="#stations">Skip to stations</a>
    <Page />
  </RadioProvider>
}

// The page's accent follows the playing station's cover colour (see --station in page.css).
function Page() {
  const { stationRgb } = useRadio()
  return <main className="p-page ta" id="top" style={stationRgb ? { "--station": stationRgb } as CSSProperties : undefined}>
    <Hero />
    <OnYourMac />
    <HowItWorks />
    <Stations />
    <Details />
    <SendNudge />
  </main>
}
