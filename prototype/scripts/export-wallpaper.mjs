// Copies your desktop picture into public/wallpaper/ so the prototype can
// show the wheel over it. The folder is gitignored, so the picture never ends
// up in the repo. Run `npm run wallpaper`; macOS asks once to allow your
// terminal to control System Events. To use another picture, pass its path:
// `npm run wallpaper -- ~/Pictures/clouds.heic`.
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "wallpaper")

const firstLine = (error) => (error.stderr?.toString().trim() || error.message).split("\n")[0]

function currentWallpaper() {
  try {
    return execFileSync("osascript", ["-e", 'tell application "System Events" to get picture of current desktop'], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim()
  } catch (error) {
    console.error(`Couldn't ask System Events for your desktop picture: ${firstLine(error)}`)
    console.error("Allow your terminal in System Settings > Privacy & Security > Automation,")
    console.error("or pass the picture's path: npm run wallpaper -- /path/to/picture.jpg")
    process.exit(1)
  }
}

const source = process.argv[2] ?? currentWallpaper()
if (!existsSync(source)) {
  console.error(`${source} doesn't exist.`)
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })

// Always through sips, so HEIC, PNG and TIFF pictures come out as a JPEG
// every browser shows. A failed run leaves the last copy in place.
try {
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "best", source, "--out", join(outDir, "wallpaper.jpg")], {
    stdio: ["ignore", "ignore", "pipe"],
  })
} catch (error) {
  console.error(`Couldn't convert ${source}: ${firstLine(error)}`)
  console.error("Pass the path of a still picture (dynamic and aerial wallpapers aren't),")
  console.error("or allow your terminal to read the folder it's in.")
  process.exit(1)
}
console.log(`Copied ${source} to ${outDir}`)
