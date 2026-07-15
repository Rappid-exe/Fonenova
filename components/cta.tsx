import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function CTA() {
  return (
    <section className="py-24 lg:py-32 bg-muted/50">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="relative rounded-3xl bg-foreground overflow-hidden">
          <div className="relative flex flex-col items-center text-center gap-8 px-8 py-20 lg:py-28">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider">Ready to Partner?</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-background font-mono text-balance max-w-3xl">
              Let&apos;s grow your business together
            </h2>
            <p className="text-lg text-background/70 max-w-xl leading-relaxed">
              Whether you need 10 units or 10,000, we have the stock, the prices, and the service to keep your business moving.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="mailto:fonenovaltd@gmail.com"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-10 py-4 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Get a Quote Today
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#contact"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-background/20 px-10 py-4 text-sm font-semibold text-background hover:bg-background/10 transition-colors"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
