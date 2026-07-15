"use client"

import { useState } from "react"
import { Menu, X } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-b border-border">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/logo.png"
              alt="Fonenova logo"
              width={200}
              height={80}
              className="h-14 w-auto object-contain"
            />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link href="#products" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Products
            </Link>
            <Link href="#contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Contact
            </Link>
            <Link
              href="mailto:fonenovaltd@gmail.com"
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Get a Quote
            </Link>
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-foreground"
            aria-label={isOpen ? "Close menu" : "Open menu"}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-md">
          <div className="px-6 py-4 flex flex-col gap-3">
            <Link
              href="#products"
              onClick={() => setIsOpen(false)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Products
            </Link>
            <Link
              href="#contact"
              onClick={() => setIsOpen(false)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Contact
            </Link>
            <Link
              href="mailto:fonenovaltd@gmail.com"
              onClick={() => setIsOpen(false)}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground text-center hover:opacity-90 transition-opacity"
            >
              Get a Quote
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
