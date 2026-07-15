import { Navbar } from "@/components/navbar"
import { Hero } from "@/components/hero"
import { Products } from "@/components/products"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <Hero />
      <Products />
      <Footer />
    </main>
  )
}
