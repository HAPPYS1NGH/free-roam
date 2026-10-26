import { slotsFor, type Playlist } from "../stations"
import catalog from "./catalog.json"

// Only the four requested playlists and curated public selections are included.
export const demoPlaylists: Playlist[] = catalog.map(({ id, name, tracks, covers }) => ({ id, name, tracks, covers }))
export const demoSlots = slotsFor(demoPlaylists)
export const catalogSources = catalog.flatMap(({ id, album, sourceUrl }) => album && sourceUrl ? [{ id, album, sourceUrl }] : [])
