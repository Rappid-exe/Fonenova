import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

export function Hero() {
  return (
    <section className="pt-24 pb-16 lg:pt-32 lg:pb-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="flex flex-col gap-4">
            <div className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
              <span className="text-foreground">Fone</span><span className="text-primary">Nova</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1] text-balance">
              Wholesale tech,{" "}
              <span className="text-primary">delivered.</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
              Bulk mobile phones, tablets, and consumer electronics at competitive wholesale prices. Built for retailers and resellers.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href="mailto:fonenovaltd@gmail.com"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:opacity-90 hover:shadow-md active:scale-[0.97]"
              >
                Request Pricing
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="#products"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-7 py-3 text-sm font-semibold text-foreground transition-all duration-200 hover:bg-secondary active:scale-[0.97]"
              >
                View Products
              </Link>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_40%,var(--color-primary)/15,transparent_70%)] blur-2xl"
            />
            <div className="rounded-2xl overflow-hidden bg-white p-6 lg:p-10 border border-border shadow-[0_24px_60px_-24px_rgba(0,0,0,0.18)]">
              <Image
                src="/images/hero-phones.png"
                alt="Premium smartphones available for wholesale"
                width={600}
                height={450}
                className="drop-shadow-lg"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
