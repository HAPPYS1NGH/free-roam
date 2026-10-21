import { mockPlaylists, type Playlist } from "./stations"

export type Library = { playlists: Playlist[]; source: "library" | "mock" }

// Prefers the playlists exported by `npm run library` and falls back to mock
// data when nothing has been exported.
export async function loadLibrary(): Promise<Library> {
  try {
    const response = await fetch("/library/library.json")
    // Vite answers unknown paths with index.html, so check what came back.
    if (!response.ok || !response.headers.get("content-type")?.includes("json")) {
      throw new Error("no exported library")
    }
    const { playlists } = (await response.json()) as { playlists: Playlist[] }
    await preloadCovers(playlists)
    return { playlists, source: "library" }
  } catch (error) {
    console.info(`Using mock playlists (${(error as Error).message}). Run \`npm run library\` to use yours.`)
    return { playlists: mockPlaylists, source: "mock" }
  }
}

// Decode every cover up front so the wheel never opens with blank logos.
function preloadCovers(playlists: Playlist[]) {
  const covers = playlists.flatMap((playlist) => playlist.covers)
  return Promise.all(
    covers.map((src) => {
      const image = new Image()
      image.src = src
      return image.decode().catch(() => console.warn(`Cover failed to load: ${src}`))
    }),
  )
}
