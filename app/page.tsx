import { Navbar } from "@/components/navbar"
import { Hero } from "@/components/hero"
import { BrandMarquee } from "@/components/brand-marquee"
import { LineupScroll } from "@/components/lineup-scroll"
import { DarkLineup } from "@/components/dark-lineup"
import { Products } from "@/components/products"
import { WhyUs } from "@/components/why-us"
import { HowItWorks } from "@/components/how-it-works"
import { QuoteForm } from "@/components/quote-form"
import { CTA } from "@/components/cta"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <Hero />
      <BrandMarquee />
      <LineupScroll />
      <DarkLineup />
      <Products />
      <WhyUs />
      <HowItWorks />
      <QuoteForm />
      <CTA />
      <Footer />
    </main>
  )
}
