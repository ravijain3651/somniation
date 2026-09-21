import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toIsoDate } from '../../core/dates';
import { PAYMENT_TERMS } from '../../core/invoice-config';
import {
  buildLines,
  downloadInvoicePdf,
  dueDate,
  formatMoney,
  totalCents,
} from '../../core/invoice-pdf';
import { Timesheet } from '../../core/timesheet.model';
import { TimesheetService } from '../../core/timesheet.service';

type InvoicedFilter = 'all' | 'open' | 'invoiced';

@Component({
  selector: 'app-admin',
  imports: [ReactiveFormsModule],
  templateUrl: './admin.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Admin {
  private readonly service = inject(TimesheetService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly terms = PAYMENT_TERMS;
  protected readonly money = formatMoney;

  protected readonly sheets = signal<Timesheet[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly message = signal('');

  // Dashboard filters
  protected readonly employeeFilter = signal('');
  protected readonly statusFilter = signal<InvoicedFilter>('all');

  // Invoice form
  protected readonly invoiceEmployee = signal('');
  protected readonly selectedWeeks = signal<ReadonlySet<string>>(new Set());
  protected readonly generated = signal<{ number: string; sheets: Timesheet[] } | null>(null);
  protected readonly busy = signal(false);

  protected readonly form = this.fb.group({
    invoiceNumber: ['', Validators.required],
    invoiceDate: [toIsoDate(new Date()), Validators.required],
    terms: [30, Validators.required],
    hourlyRate: [0, [Validators.required, Validators.min(0.01)]],
  });

  protected readonly employees = computed(() =>
    [...new Set(this.sheets().map((s) => s.userEmail))].sort(),
  );

  protected readonly visible = computed(() =>
    this.sheets().filter(
      (s) =>
        (!this.employeeFilter() || s.userEmail === this.employeeFilter()) &&
        (this.statusFilter() === 'all' ||
          (this.statusFilter() === 'invoiced') === s.invoiced),
    ),
  );

  protected readonly openWeeks = computed(() =>
    this.sheets()
      .filter((s) => s.userEmail === this.invoiceEmployee() && !s.invoiced)
      .sort((a, b) => a.weekEnding.localeCompare(b.weekEnding)),
  );

  private readonly rate = signal(0);
  protected readonly pickedSheets = computed(() =>
    this.openWeeks().filter((s) => this.selectedWeeks().has(s.weekEnding)),
  );
  protected readonly total = computed(() =>
    totalCents(buildLines(this.pickedSheets(), this.rate())),
  );

  constructor() {
    this.form.controls.hourlyRate.valueChanges.subscribe((v) => this.rate.set(Number(v) || 0));
    this.form.controls.invoiceDate.valueChanges.subscribe(() => this.suggestNumber());
    this.suggestNumber();
    void this.load();
  }

  protected dueLabel(): string {
    const { invoiceDate, terms } = this.form.getRawValue();
    return invoiceDate ? toIsoDate(dueDate(invoiceDate, Number(terms))) : '';
  }

  protected setEmployee(email: string): void {
    this.invoiceEmployee.set(email);
    this.selectedWeeks.set(new Set());
    this.generated.set(null);
  }

  protected toggleWeek(week: string, checked: boolean): void {
    const next = new Set(this.selectedWeeks());
    checked ? next.add(week) : next.delete(week);
    this.selectedWeeks.set(next);
    this.generated.set(null);
  }

  protected async generate(): Promise<void> {
    this.form.markAllAsTouched();
    const sheets = this.pickedSheets();
    if (this.form.invalid || !sheets.length || this.busy()) return;
    const v = this.form.getRawValue();
    this.busy.set(true);
    this.error.set('');
    try {
      await downloadInvoicePdf({
        invoiceNumber: v.invoiceNumber,
        invoiceDate: v.invoiceDate,
        terms: Number(v.terms),
        hourlyRate: Number(v.hourlyRate),
        employeeEmail: this.invoiceEmployee(),
        sheets,
      });
      this.generated.set({ number: v.invoiceNumber, sheets });
    } catch {
      this.error.set('Could not generate the PDF.');
    } finally {
      this.busy.set(false);
    }
  }

  /** Locks the weeks the PDF was generated for. */
  protected async markInvoiced(): Promise<void> {
    const g = this.generated();
    if (!g || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.service.markInvoiced(g.sheets, g.number);
      this.message.set(`Marked ${g.sheets.length} week(s) as invoiced (${g.number}).`);
      this.generated.set(null);
      this.selectedWeeks.set(new Set());
      await this.load();
      this.suggestNumber();
    } catch {
      this.error.set('Could not mark the timesheets as invoiced.');
    } finally {
      this.busy.set(false);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.sheets.set(await this.service.listAll());
    } catch {
      this.error.set('Could not load timesheets.');
    } finally {
      this.loading.set(false);
    }
  }

  /** Default INV-YYYYMMDD-NN, where NN follows existing invoice numbers for that date. */
  private suggestNumber(): void {
    const prefix = `INV-${this.form.controls.invoiceDate.value.replaceAll('-', '')}-`;
    const used = new Set(this.sheets().map((s) => s.invoiceNumber));
    let n = 1;
    while (used.has(prefix + String(n).padStart(2, '0'))) n++;
    this.form.controls.invoiceNumber.setValue(prefix + String(n).padStart(2, '0'), {
      emitEvent: false,
    });
  }
}
