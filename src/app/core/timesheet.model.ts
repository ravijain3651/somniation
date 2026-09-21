export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type Day = (typeof DAYS)[number];

export interface Timesheet {
  userId: string;
  userEmail: string;
  weekEnding: string; // YYYY-MM-DD (the Sunday)
  hours: Record<Day, number>;
  totalHours: number;
  receiptUrl: string;
  invoiced: boolean;
  invoiceNumber: string | null;
}

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
export const RECEIPT_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg' };
