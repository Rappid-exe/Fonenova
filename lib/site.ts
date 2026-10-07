/** Contact details, kept in one place so the navbar, footer and quote form cannot drift apart. */
export const CONTACT = {
  email: "info@fonenova.com",
  /** Display form. */
  phone: "+44 7949 922872",
  /** Dial form: no spaces, so mobile browsers parse it reliably. */
  phoneHref: "tel:+447949922872",
  /**
   * WhatsApp click-to-chat. wa.me wants digits only (country code, no plus, no spaces),
   * and the text is what the chat opens pre-filled with: the visitor can edit it, and it
   * tells us a message came from the website.
   */
  whatsappHref: `https://wa.me/447949922872?text=${encodeURIComponent("Hi FoneNova, I'd like a wholesale quote.")}`,
} as const

/**
 * Registered particulars. The Companies (Trading Disclosures) Regulations require a
 * company's registered name, number, place of registration and office address to appear
 * on its website, so the number is a legal requirement rather than a nicety.
 *
 * The VAT number is deliberately absent. It is required on VAT invoices, not on a
 * website, and the owner does not want it published here. Do not add it back: anything
 * in this file ships to the browser whether or not a component renders it.
 */
export const COMPANY = {
  legalName: "FoneNova Ltd",
  registrationNumber: "NI737184",
  placeOfRegistration: "Northern Ireland",
} as const
