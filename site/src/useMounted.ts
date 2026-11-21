import { useEffect, useState } from "react"

// False in the prerender and the hydrating render, true after. For markup that
// depends on the visitor's browser, such as their time zone or document.body.
export function useMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}
