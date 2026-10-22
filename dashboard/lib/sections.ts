'use client'
import { useEffect, useState } from 'react'

export const SECTIONS = ['overview', 'orders', 'matching', 'customers', 'suppliers', 'credit-notes', 'exceptions', 'expenses', 'settings'] as const
export type Section = (typeof SECTIONS)[number]

const parse = (hash: string): Section => {
  const s = hash.replace(/^#/, '') as Section
  return SECTIONS.includes(s) ? s : 'overview'
}

/**
 * The page shown, kept in the address (#orders). The whole dashboard is one page, so the
 * period, customer and currency you picked stay put as you move between sections, and the
 * browser's back button works.
 */
export function useSection(): [Section, (s: Section) => void] {
  const [section, setSection] = useState<Section>('overview')
  useEffect(() => {
    const sync = () => setSection(parse(window.location.hash))
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  const go = (s: Section) => {
    if (s === section) return
    window.location.hash = s === 'overview' ? '' : s
    window.scrollTo({ top: 0 })
  }
  return [section, go]
}
