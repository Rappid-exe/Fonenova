import { CONTACT, COMPANY } from "@/lib/site"

/**
 * Structured data (schema.org JSON-LD) for the homepage.
 *
 * This is what lets Google read FoneNova as a real, located business rather than
 * just a page of text: the name, the Belfast address, the contact points, the
 * area served and the product range. It feeds the brand knowledge panel and is a
 * prerequisite (alongside a Google Business Profile) for showing up as a local
 * wholesaler. It is a single @graph so the Organization, the storefront and the
 * WebSite cross-reference each other by @id.
 *
 * NAP (name, address, phone) is kept identical to the footer on purpose: Google
 * cross-checks these against directory listings, and any drift weakens the local
 * signal. If the address or phone changes, change it in lib/site.ts and the
 * footer and here together.
 *
 * Everything here is already public (the address and company number are in the
 * footer by law; the email and phone are the published contacts). No private
 * data is exposed by serialising this.
 */

const SITE_URL = "https://fonenova.com"
const ORG_ID = `${SITE_URL}/#organization`
const SITE_ID = `${SITE_URL}/#website`

const CATEGORIES = ["Smartphones", "Tablets", "Laptops", "Accessories"] as const

export function buildJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Organization", "WholesaleStore"],
        "@id": ORG_ID,
        name: "FoneNova",
        legalName: COMPANY.legalName,
        url: SITE_URL,
        logo: `${SITE_URL}/icon-128.png`,
        image: `${SITE_URL}/images/og-cover.jpg`,
        description:
          "Belfast-based B2B wholesale supplier of used and graded mobile phones, tablets, laptops and accessories, selling to retailers and resellers only.",
        email: CONTACT.email,
        telephone: CONTACT.phone,
        priceRange: "££",
        currenciesAccepted: "GBP",
        paymentAccepted: "Bank transfer",
        // Companies House number, already published in the footer.
        identifier: {
          "@type": "PropertyValue",
          propertyID: "Companies House",
          value: COMPANY.registrationNumber,
        },
        address: {
          "@type": "PostalAddress",
          streetAddress: "Office G35-G36, Unit 7A-7B Weavers Court, Weavers Business Park",
          addressLocality: "Belfast",
          addressRegion: "Northern Ireland",
          postalCode: "BT12 5GH",
          addressCountry: "GB",
        },
        // Weavers Court Business Park, Belfast. Approximate; refine to the exact
        // unit if a precise pin is ever needed for the map.
        geo: {
          "@type": "GeoCoordinates",
          latitude: 54.5893,
          longitude: -5.9538,
        },
        areaServed: [
          { "@type": "Country", name: "United Kingdom" },
          { "@type": "Country", name: "Ireland" },
          { "@type": "Place", name: "Europe" },
        ],
        knowsAbout: [
          "Wholesale mobile phones",
          "Used and refurbished smartphones",
          "VAT margin scheme",
          "Bulk consumer electronics",
        ],
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Wholesale stock",
          itemListElement: CATEGORIES.map((c) => ({
            "@type": "OfferCatalog",
            name: c,
          })),
        },
      },
      {
        "@type": "WebSite",
        "@id": SITE_ID,
        url: SITE_URL,
        name: "FoneNova",
        publisher: { "@id": ORG_ID },
        inLanguage: "en-GB",
      },
    ],
  }
}
