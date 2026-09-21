import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { addDays, parseIsoDate } from './dates';
import { INVOICE_ISSUER } from './invoice-config';
import { Timesheet } from './timesheet.model';

export interface InvoiceInput {
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  terms: number; // days
  hourlyRate: number;
  employeeEmail: string;
  sheets: Timesheet[];
}

export interface InvoiceLine {
  weekEnding: string;
  hours: number;
  amountCents: number;
}

export function rateToCents(rate: number): number {
  return Math.round(rate * 100);
}

/** Amounts are computed in integer cents to avoid floating-point drift. */
export function buildLines(sheets: Timesheet[], hourlyRate: number): InvoiceLine[] {
  const rateCents = rateToCents(hourlyRate);
  return [...sheets]
    .sort((a, b) => a.weekEnding.localeCompare(b.weekEnding))
    .map((s) => ({
      weekEnding: s.weekEnding,
      hours: s.totalHours,
      amountCents: Math.round(s.totalHours * rateCents),
    }));
}

export function totalCents(lines: InvoiceLine[]): number {
  return lines.reduce((sum, l) => sum + l.amountCents, 0);
}

export function dueDate(invoiceDate: string, terms: number): Date {
  return addDays(parseIsoDate(invoiceDate), terms);
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat(INVOICE_ISSUER.locale, {
    style: 'currency',
    currency: INVOICE_ISSUER.currency,
  }).format(cents / 100);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(INVOICE_ISSUER.locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

async function loadLogo(): Promise<string | null> {
  try {
    const blob = await (await fetch(INVOICE_ISSUER.logoPath)).blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null; // invoice still renders without the logo
  }
}

/** Builds the invoice entirely in the browser and triggers the download. */
export async function downloadInvoicePdf(input: InvoiceInput): Promise<void> {
  const [pdfMakeModule, vfsModule, logo] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
    loadLogo(),
  ]);
  const pdfMake: any = (pdfMakeModule as any).default ?? pdfMakeModule;
  pdfMake.addVirtualFileSystem((vfsModule as any).default ?? vfsModule);

  const lines = buildLines(input.sheets, input.hourlyRate);
  const total = totalCents(lines);
  const totalHours = lines.reduce((sum, l) => sum + l.hours, 0);
  const due = dueDate(input.invoiceDate, input.terms);
  const issuer = INVOICE_ISSUER;

  const header: Content = {
    columns: [
      logo ? { image: logo, width: 120 } : { text: issuer.name, style: 'h1' },
      {
        width: '*',
        alignment: 'right',
        stack: [
          { text: 'INVOICE', style: 'h1' },
          { text: `# ${input.invoiceNumber}`, margin: [0, 2, 0, 0] },
        ],
      },
    ],
  };

  const doc: TDocumentDefinitions = {
    pageSize: 'LETTER',
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { fontSize: 10 },
    styles: {
      h1: { fontSize: 20, bold: true },
      label: { bold: true, color: '#555555', fontSize: 9 },
      th: { bold: true, fillColor: '#eeeeee' },
    },
    content: [
      header,
      {
        margin: [0, 24, 0, 0],
        columns: [
          {
            stack: [
              { text: 'From', style: 'label' },
              { text: issuer.name, bold: true },
              ...issuer.addressLines,
              ...issuer.contactLines,
            ],
          },
          {
            stack: [
              { text: 'Billed for', style: 'label' },
              { text: input.employeeEmail, bold: true },
            ],
          },
          {
            alignment: 'right',
            stack: [
              { text: `Invoice date: ${formatDate(parseIsoDate(input.invoiceDate))}` },
              { text: `Terms: Net ${input.terms}` },
              { text: `Due date: ${formatDate(due)}`, bold: true },
            ],
          },
        ],
      },
      {
        margin: [0, 24, 0, 0],
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'Week ending', style: 'th' },
              { text: 'Hours', style: 'th', alignment: 'right' },
              { text: 'Rate', style: 'th', alignment: 'right' },
              { text: 'Amount', style: 'th', alignment: 'right' },
            ],
            ...lines.map((l) => [
              formatDate(parseIsoDate(l.weekEnding)),
              { text: String(l.hours), alignment: 'right' as const },
              { text: formatMoney(rateToCents(input.hourlyRate)), alignment: 'right' as const },
              { text: formatMoney(l.amountCents), alignment: 'right' as const },
            ]),
            [
              { text: 'Total', bold: true },
              { text: String(totalHours), bold: true, alignment: 'right' },
              '',
              { text: formatMoney(total), bold: true, alignment: 'right' },
            ],
          ],
        },
        layout: 'lightHorizontalLines',
      },
      {
        margin: [0, 24, 0, 0],
        stack: [{ text: 'Payment information', style: 'label' }, ...issuer.paymentInfo],
      },
    ],
  };

  pdfMake.createPdf(doc).download(`${input.invoiceNumber}.pdf`);
}
