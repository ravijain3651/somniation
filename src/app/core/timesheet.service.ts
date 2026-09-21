import { Injectable } from '@angular/core';
import { Timesheet, RECEIPT_TYPES } from './timesheet.model';

/** Firestore/Storage access for timesheets. SDK modules are imported lazily (browser only). */
@Injectable({ providedIn: 'root' })
export class TimesheetService {
  private async fs() {
    const [{ getFirebase }, firestore] = await Promise.all([
      import('./firebase/client'),
      import('firebase/firestore'),
    ]);
    return { db: getFirebase().db, ...firestore };
  }

  static docId(userId: string, weekEnding: string): string {
    return `${userId}_${weekEnding}`;
  }

  async get(userId: string, weekEnding: string): Promise<Timesheet | null> {
    const { db, doc, getDoc } = await this.fs();
    const snap = await getDoc(doc(db, 'timesheets', TimesheetService.docId(userId, weekEnding)));
    return snap.exists() ? (snap.data() as Timesheet) : null;
  }

  /** Uploads the receipt (if a new one was chosen) and writes the timesheet doc. */
  async save(
    ts: Omit<Timesheet, 'receiptUrl' | 'invoiced' | 'invoiceNumber'>,
    receipt: File | null,
    existingReceiptUrl: string,
    isNew: boolean,
  ): Promise<void> {
    let receiptUrl = existingReceiptUrl;
    if (receipt) {
      const ext = RECEIPT_TYPES[receipt.type];
      const [{ getFirebase }, storage] = await Promise.all([
        import('./firebase/client'),
        import('firebase/storage'),
      ]);
      const ref = storage.ref(getFirebase().storage, `receipts/${ts.userId}/${ts.weekEnding}.${ext}`);
      await storage.uploadBytes(ref, receipt, { contentType: receipt.type });
      receiptUrl = await storage.getDownloadURL(ref);
    }
    const { db, doc, setDoc, serverTimestamp } = await this.fs();
    const data = {
      ...ts,
      receiptUrl,
      invoiced: false,
      invoiceNumber: null,
      updatedAt: serverTimestamp(),
      ...(isNew ? { createdAt: serverTimestamp() } : {}),
    };
    // merge keeps createdAt on resubmission
    await setDoc(doc(db, 'timesheets', TimesheetService.docId(ts.userId, ts.weekEnding)), data, {
      merge: true,
    });
  }

  /** Admin: all timesheets, newest week first. */
  async listAll(): Promise<Timesheet[]> {
    const { db, collection, getDocs, query, orderBy } = await this.fs();
    const snap = await getDocs(query(collection(db, 'timesheets'), orderBy('weekEnding', 'desc')));
    return snap.docs.map((d) => d.data() as Timesheet);
  }

  /** Admin: lock the given weeks under an invoice number. */
  async markInvoiced(sheets: Timesheet[], invoiceNumber: string): Promise<void> {
    const { db, doc, writeBatch, serverTimestamp } = await this.fs();
    const batch = writeBatch(db);
    for (const s of sheets) {
      batch.update(doc(db, 'timesheets', TimesheetService.docId(s.userId, s.weekEnding)), {
        invoiced: true,
        invoiceNumber,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }
}
