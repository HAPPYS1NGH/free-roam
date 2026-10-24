import { slotsFor, type Playlist } from "../stations"
import catalog from "./catalog.json"

// Curated from Apple's public catalog, never from the user's Music export.
export const demoPlaylists: Playlist[] = catalog.map(({ id, name, tracks, covers }) => ({ id, name, tracks, covers }))
export const demoSlots = slotsFor(demoPlaylists)
export const catalogSources = catalog.map(({ id, album, sourceUrl }) => ({ id, album, sourceUrl }))
