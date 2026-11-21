// The desktop picture copied by `npm run wallpaper`, so the wheel can be
// judged over what's really on your screen. Resolves to null when nothing has
// been copied, and the stand-in desktop stays.
const WALLPAPER_URL = "/wallpaper/wallpaper.jpg"

export async function loadWallpaper(): Promise<string | null> {
  const image = new Image()
  image.src = WALLPAPER_URL
  try {
    // Decoded up front so it doesn't paint in after the desktop. Vite answers
    // a missing file with index.html, which fails to decode.
    await image.decode()
    return WALLPAPER_URL
  } catch {
    console.info("No wallpaper copied. Run `npm run wallpaper` to judge the wheel over yours.")
    return null
  }
}
