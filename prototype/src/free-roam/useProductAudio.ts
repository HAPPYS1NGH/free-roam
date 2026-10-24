import { useEffect, useState } from "react"
import tokens from "../../tokens.json"
import { playSound, preloadProductSounds, SILENT_DB, unlockAudio } from "../sound"

export function useProductAudio() {
  const [enabled, setEnabled] = useState(true)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void preloadProductSounds().then(() => {
      if (active) { setLoading(false); setError(false) }
    }).catch(() => {
      if (active) { setLoading(false); setError(true) }
    })
    return () => { active = false }
  }, [])

  const toggle = async () => {
    if (enabled && !error) { setEnabled(false); return }
    unlockAudio()
    setLoading(true)
    try {
      await preloadProductSounds()
      setError(false)
      setEnabled(true)
      playSound("open", tokens.behaviour.uiVolumeDb, "Product")
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return {
    enabled, error, loading, toggle,
    sounds: {
      pack: "Product" as const,
      retuneTake: "retune" as const,
      retuneVolumeDb: enabled ? tokens.behaviour.retuneVolumeDb : SILENT_DB,
      uiVolumeDb: enabled ? tokens.behaviour.uiVolumeDb : SILENT_DB,
      hoverVolumeDb: enabled ? tokens.behaviour.hoverVolumeDb : SILENT_DB,
    },
  }
}
