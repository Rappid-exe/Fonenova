import { ShieldCheck, Zap, BadgePoundSterling, Truck, PackageCheck, Handshake } from "lucide-react"

const features = [
  {
    icon: BadgePoundSterling,
    title: "Competitive Pricing",
    description: "Best-in-market wholesale rates with volume discounts. The more you order, the more you save.",
  },
  {
    icon: ShieldCheck,
    title: "Quality Guaranteed",
    description: "Every product is inspected and graded. We stand behind the quality of everything we sell.",
  },
  {
    icon: Zap,
    title: "Fast Turnaround",
    description: "Orders processed and dispatched within 24 hours. No waiting weeks for your stock.",
  },
  {
    icon: Truck,
    title: "UK-Wide Delivery",
    description: "Reliable, tracked shipping across the UK. Next-day delivery options available.",
  },
  {
    icon: PackageCheck,
    title: "Bulk & Custom Orders",
    description: "From 10 units to 10,000. We handle orders of any size and can source specific models on request.",
  },
  {
    icon: Handshake,
    title: "Dedicated Support",
    description: "A real person you can call or email. Build a relationship with a supplier who understands your business.",
  },
]

export function WhyUs() {
  return (
    <section id="why-us" className="py-24 lg:py-32 bg-secondary/50">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col items-center text-center gap-4 max-w-2xl mx-auto mb-16">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">Why Fonenova</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground font-mono text-balance">
            Built for serious resellers
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            We know what retailers need: reliable stock, fair prices, and a supplier you can count on.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-8 hover:border-primary/30 transition-colors duration-300"
            >
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 border border-primary/20">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground font-mono">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
