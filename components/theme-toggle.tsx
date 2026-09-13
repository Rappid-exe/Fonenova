"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"

/** Keeps the browser chrome on mobile matching the page, now that neither follows the OS. */
function syncThemeColor(isDark: boolean) {
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", isDark ? "#0a0a0a" : "#fcfcfc")
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const isDark = document.documentElement.classList.contains("dark")
    setDark(isDark)
    // Also on mount, not just on toggle: the pre-paint script restores a stored dark
    // theme before React runs, and the meta tag ships with the light value.
    syncThemeColor(isDark)
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
    syncThemeColor(next)
    try {
      localStorage.setItem("theme", next ? "dark" : "light")
    } catch {
      /* private browsing, non-fatal */
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors ${className}`}
    >
      {mounted && dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
