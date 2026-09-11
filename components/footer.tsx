import Link from "next/link"
import Image from "next/image"
import { Mail, MapPin } from "lucide-react"

export function Footer() {
  return (
    <footer id="contact" className="border-t border-border">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-3 gap-12">
          <div className="flex flex-col gap-4">
            <Image
              src="/images/logo-light.png"
              alt="Fonenova logo"
              width={440}
              height={296}
              className="h-16 w-auto object-contain object-left dark:hidden"
            />
            <Image
              src="/images/logo-dark.png"
              alt="Fonenova logo"
              width={440}
              height={296}
              className="h-16 w-auto object-contain object-left hidden dark:block"
            />
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Wholesale mobile phones and consumer electronics for retailers and resellers.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Links</h3>
            <div className="flex flex-col gap-2">
              <Link href="#products" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Products
              </Link>
              <Link href="#quote" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Get a Quote
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Contact</h3>
            <div className="flex flex-col gap-3">
              <Link
                href="mailto:fonenovaltd@gmail.com"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Mail className="h-4 w-4 shrink-0 text-primary" />
                fonenovaltd@gmail.com
              </Link>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <address className="not-italic leading-relaxed">
                  FoneNova Ltd<br />
                  Office: G35-G36<br />
                  Unit 7A-7B Weavers Court,<br />
                  Weavers Business Park,<br />
                  Belfast, Northern Ireland,<br />
                  BT12 5GH
                </address>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Terms, Conditions & Privacy</h3>
            <div className="text-xs text-muted-foreground leading-relaxed max-w-4xl flex flex-col gap-2">
              <p>
                FoneNova Ltd is a B2B wholesaler only &mdash; we do not sell to individual consumers. All buyers must be registered businesses and may be asked to provide proof of registration or a VAT number. Orders are subject to minimum order quantities (MOQs), which vary by product and will be confirmed at quotation.
              </p>
              <p>
                Payment is by bank transfer in advance unless otherwise agreed in writing. Goods are dispatched once payment has cleared. Risk passes to the buyer upon dispatch; buyers should arrange adequate insurance. Returns require prior written authorisation and goods must be in original condition. Devices are graded (A/B/C) at the point of sale. Warranty is limited to the terms agreed at purchase; FoneNova Ltd is not liable for indirect or consequential losses.
              </p>
              <p>
                When you contact us, we may collect your name, email, phone number, and business details solely to process enquiries and orders. We do not sell or share your data for marketing. Data is stored securely with access restricted to authorised staff. Under GDPR, you may request access to, correction of, or deletion of your data by emailing fonenovaltd@gmail.com.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} FoneNova Ltd. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
