"use client"

import { useState } from "react"
import { Mail, Send } from "lucide-react"

const PRODUCT_OPTIONS = ["Smartphones", "Tablets", "Laptops", "Accessories", "Mixed / Not sure yet"]

export function QuoteForm() {
  const [status, setStatus] = useState<"idle" | "sent">("idle")

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const name = data.get("name")?.toString().trim() ?? ""
    const company = data.get("company")?.toString().trim() ?? ""
    const email = data.get("email")?.toString().trim() ?? ""
    const phone = data.get("phone")?.toString().trim() ?? ""
    const category = data.get("category")?.toString().trim() ?? ""
    const quantity = data.get("quantity")?.toString().trim() ?? ""
    const message = data.get("message")?.toString().trim() ?? ""

    const subject = `Wholesale Quote Request${company ? ` — ${company}` : ""}`
    const bodyLines = [
      `Name: ${name}`,
      `Company: ${company}`,
      `Email: ${email}`,
      phone && `Phone: ${phone}`,
      `Product category: ${category}`,
      `Approx. quantity: ${quantity}`,
      "",
      "Details:",
      message,
    ].filter(Boolean)

    const mailto = `mailto:fonenovaltd@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      bodyLines.join("\n"),
    )}`

    window.location.href = mailto
    setStatus("sent")
  }

  return (
    <section id="quote" className="py-20 lg:py-28 border-t border-border">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <div className="flex flex-col gap-3 mb-10 text-center">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">Get a Quote</p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground font-mono text-balance">
            Tell us what you need
          </h2>
          <p className="text-muted-foreground text-lg">
            Fill this in and it opens a pre-filled email to our team. We reply with pricing and availability, usually
            within hours.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4 rounded-2xl border border-border bg-card p-6 lg:p-8">
          <Field label="Full name" name="name" required />
          <Field label="Company name" name="company" required />
          <Field label="Email" name="email" type="email" required />
          <Field label="Phone (optional)" name="phone" type="tel" />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="category" className="text-sm font-medium text-foreground">
              Product category
            </label>
            <select
              id="category"
              name="category"
              required
              defaultValue=""
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="" disabled>
                Select a category
              </option>
              {PRODUCT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <Field label="Approx. quantity" name="quantity" placeholder="e.g. 200 units" required />

          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label htmlFor="message" className="text-sm font-medium text-foreground">
              Details
            </label>
            <textarea
              id="message"
              name="message"
              rows={4}
              placeholder="Models, condition/grade, timeline, delivery location..."
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div className="sm:col-span-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Send className="h-4 w-4" />
              Send Enquiry
            </button>
            <a
              href="mailto:fonenovaltd@gmail.com"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Mail className="h-4 w-4" />
              or email us directly
            </a>
          </div>

          {status === "sent" && (
            <p className="sm:col-span-2 text-sm text-primary">
              Opening your email client with these details pre-filled — send it to reach us.
            </p>
          )}
        </form>
      </div>
    </section>
  )
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  )
}
