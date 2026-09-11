import { Mail, FileText, Truck, ArrowRight } from "lucide-react"
import Link from "next/link"

const steps = [
  {
    number: "01",
    icon: Mail,
    title: "Get in Touch",
    description: "Send us an email with what you need. Tell us the models, quantities, and any specific requirements.",
  },
  {
    number: "02",
    icon: FileText,
    title: "Receive Your Quote",
    description: "We'll respond with competitive pricing, availability, and estimated delivery within hours.",
  },
  {
    number: "03",
    icon: Truck,
    title: "Stock Delivered",
    description: "Confirm your order and we'll dispatch within 24 hours. Tracked, insured, and delivered to your door.",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col items-center text-center gap-4 max-w-2xl mx-auto mb-16">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">How It Works</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground font-mono text-balance">
            Three steps to stock your shelves
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div key={step.number} className="relative flex flex-col items-center text-center gap-6 rounded-2xl border border-border bg-card p-8">
              <div className="relative">
                <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20">
                  <step.icon className="h-7 w-7 text-primary" />
                </div>
                <span className="absolute -top-2 -right-2 flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold font-mono">
                  {step.number}
                </span>
              </div>
              <h3 className="text-xl font-bold text-foreground font-mono">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-center mt-16">
          <Link
            href="#quote"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-10 py-4 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Start Your Order
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
