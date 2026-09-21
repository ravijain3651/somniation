/**
 * Issuer details printed on the invoice PDF header.
 * TODO(owner): replace these placeholders with the real company details and confirm the currency.
 */
export const INVOICE_ISSUER = {
  name: 'Somniation LLC',
  addressLines: ['[Street address]', '[City, State ZIP]'],
  contactLines: ['[billing email]', '[phone]'],
  paymentInfo: ['[Payment instructions: bank / remit-to details]'],
  currency: 'USD',
  locale: 'en-US',
  logoPath: 'images/brand/logo.png',
} as const;

export const PAYMENT_TERMS = [15, 30, 45] as const;
