"use client"

import { useState } from "react"
import { Menu, X } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { motion, useScroll, useMotionValueEvent } from "motion/react"
import { ThemeToggle } from "@/components/theme-toggle"

const LINKS = [
  { href: "#products", label: "Products" },
  { href: "#why-us", label: "Why us" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#contact", label: "Contact" },
]

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { scrollY } = useScroll()

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24))

  return (
    <motion.nav
      initial={{ y: -72 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-xl transition-all duration-300 ${
        scrolled
          ? "bg-background/85 border-border shadow-[0_1px_20px_-8px_rgba(0,0,0,0.25)]"
          : "bg-background/55 border-border/50"
      }`}
    >
      {/* thin brand rule: gives the bar a defined top edge instead of floating */}
      <div aria-hidden className="h-[3px] w-full bg-primary" />
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div
          className={`flex items-center justify-between transition-all duration-300 ${scrolled ? "h-16" : "h-20"}`}
        >
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/logo-light.png"
              alt="Fonenova logo"
              width={440}
              height={296}
              priority
              className={`w-auto object-contain transition-all duration-300 dark:hidden ${scrolled ? "h-10" : "h-12"}`}
            />
            <Image
              src="/images/logo-dark.png"
              alt="Fonenova logo"
              width={440}
              height={296}
              priority
              className={`w-auto object-contain transition-all duration-300 hidden dark:block ${scrolled ? "h-10" : "h-12"}`}
            />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[15px] font-medium text-foreground/70 hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <ThemeToggle />
            <Link
              href="#quote"
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
            >
              Get a Quote
            </Link>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground"
              aria-label={isOpen ? "Close menu" : "Open menu"}
              aria-expanded={isOpen}
            >
              {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl overflow-hidden"
        >
          <div className="px-6 py-4 flex flex-col gap-3">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="text-[15px] font-medium text-foreground/70 hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="#quote"
              onClick={() => setIsOpen(false)}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground text-center hover:opacity-90 transition-opacity"
            >
              Get a Quote
            </Link>
          </div>
        </motion.div>
      )}
    </motion.nav>
  )
}
