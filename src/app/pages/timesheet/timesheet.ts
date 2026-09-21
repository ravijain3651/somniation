import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map, startWith } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { addDays, parseIsoDate, toIsoDate, weekEndingFor } from '../../core/dates';
import { DAYS, MAX_RECEIPT_BYTES, RECEIPT_TYPES, Timesheet } from '../../core/timesheet.model';
import { TimesheetService } from '../../core/timesheet.service';

@Component({
  selector: 'app-timesheet',
  imports: [ReactiveFormsModule],
  templateUrl: './timesheet.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimesheetPage {
  protected readonly auth = inject(AuthService);
  private readonly service = inject(TimesheetService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly days = DAYS;
  protected readonly maxWeek = weekEndingFor(new Date());

  protected readonly form = this.fb.group({
    weekEnding: [weekEndingFor(new Date()), Validators.required],
    hours: this.fb.group(
      Object.fromEntries(
        DAYS.map((d) => [d, [0, [Validators.required, Validators.min(0), Validators.max(24)]]]),
      ) as Record<(typeof DAYS)[number], [number, ReturnType<typeof Validators.min>[]]>,
    ),
  });

  protected readonly existing = signal<Timesheet | null>(null);
  protected readonly receipt = signal<File | null>(null);
  protected readonly receiptError = signal('');
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');

  protected readonly locked = computed(() => this.existing()?.invoiced === true);

  private readonly hoursValue = toSignal(
    this.form.controls.hours.valueChanges.pipe(
      startWith(this.form.controls.hours.getRawValue()),
      map(() => this.form.controls.hours.getRawValue()),
    ),
    { initialValue: this.form.controls.hours.getRawValue() },
  );
  protected readonly total = computed(() =>
    Math.round(DAYS.reduce((sum, d) => sum + (Number(this.hoursValue()[d]) || 0), 0) * 100) / 100,
  );

  /** Mon–Sun range shown next to the picker. */
  protected weekRange(): string {
    const end = parseIsoDate(this.form.controls.weekEnding.value);
    return `${toIsoDate(addDays(end, -6))} to ${toIsoDate(end)}`;
  }

  constructor() {
    void this.loadWeek();
  }

  /** Snap any picked date to the Sunday that ends its week, then load that week. */
  protected async onWeekChange(): Promise<void> {
    const raw = this.form.controls.weekEnding.value;
    if (!raw) return;
    this.form.controls.weekEnding.setValue(weekEndingFor(parseIsoDate(raw)));
    await this.loadWeek();
  }

  protected onFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.receiptError.set('');
    if (file && !RECEIPT_TYPES[file.type]) {
      this.receipt.set(null);
      this.receiptError.set('Receipt must be a PNG or JPG image.');
    } else if (file && file.size > MAX_RECEIPT_BYTES) {
      this.receipt.set(null);
      this.receiptError.set('Receipt must be smaller than 10 MB.');
    } else {
      this.receipt.set(file);
    }
  }

  private async loadWeek(): Promise<void> {
    await this.auth.ready;
    const user = this.auth.user();
    if (!user) return;
    this.loading.set(true);
    this.message.set('');
    this.error.set('');
    this.receipt.set(null);
    try {
      const ts = await this.service.get(user.uid, this.form.controls.weekEnding.value);
      this.existing.set(ts);
      this.form.controls.hours.reset(
        ts ? ts.hours : Object.fromEntries(DAYS.map((d) => [d, 0])),
      );
      ts?.invoiced ? this.form.controls.hours.disable() : this.form.controls.hours.enable();
    } catch {
      this.error.set('Could not load this week. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async submit(): Promise<void> {
    const user = this.auth.user();
    if (!user || this.locked() || this.saving()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    if (!this.receipt() && !this.existing()?.receiptUrl) {
      this.receiptError.set('Please attach a receipt image (PNG or JPG).');
      return;
    }
    this.saving.set(true);
    this.message.set('');
    this.error.set('');
    try {
      const weekEnding = this.form.controls.weekEnding.value;
      const raw = this.form.controls.hours.getRawValue();
      const hours = Object.fromEntries(DAYS.map((d) => [d, Number(raw[d])])) as Timesheet['hours'];
      await this.service.save(
        {
          userId: user.uid,
          userEmail: user.email ?? '',
          weekEnding,
          hours,
          totalHours: this.total(),
        },
        this.receipt(),
        this.existing()?.receiptUrl ?? '',
        !this.existing(),
      );
      this.message.set('Timesheet saved.');
      await this.loadWeek();
      this.message.set('Timesheet saved.');
    } catch {
      this.error.set('Could not save the timesheet. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }
}
