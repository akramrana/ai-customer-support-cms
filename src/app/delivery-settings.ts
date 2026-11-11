import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { finalize } from 'rxjs';

import { DeliverySettings, DeliverySettingsService } from './delivery-settings.service';

const feeValidators = [Validators.required, Validators.pattern(/^\d{1,8}(?:\.\d{1,2})?$/)];
const estimateValidator = (control: AbstractControl<string>) =>
  Array.from(control.value).length <= 50 ? null : { maxlength: true };

@Component({
  selector: 'app-delivery-settings',
  imports: [
    ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule,
    MatInputModule, MatProgressBarModule,
  ],
  templateUrl: './delivery-settings.html',
  styleUrl: './delivery-settings.scss',
})
export class DeliverySettingsSection {
  private readonly api = inject(DeliverySettingsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly currency = signal('');
  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  protected readonly saving = signal(false);
  protected readonly feedback = signal<{ kind: 'success' | 'error'; message: string } | null>(null);
  protected readonly form = this.fb.group({
    insideDhakaFee: ['', feeValidators],
    outsideDhakaFee: ['', feeValidators],
    insideDhakaDeliveryDays: ['', estimateValidator],
    outsideDhakaDeliveryDays: ['', estimateValidator],
  });
  protected readonly locations = [
    { label: 'Inside Dhaka', fee: 'insideDhakaFee', estimate: 'insideDhakaDeliveryDays' },
    { label: 'Outside Dhaka', fee: 'outsideDhakaFee', estimate: 'outsideDhakaDeliveryDays' },
  ] as const;

  constructor() {
    this.load();
  }

  protected load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.loadError.set(false);
    this.api.load().pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: (settings) => this.apply(settings),
      error: () => this.loadError.set(true),
    });
  }

  protected save(): void {
    if (this.saving()) return;
    this.feedback.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const draft = this.form.getRawValue();
    this.saving.set(true);
    this.form.disable();
    this.api.save({
      ...draft,
      insideDhakaDeliveryDays: draft.insideDhakaDeliveryDays.trim() || null,
      outsideDhakaDeliveryDays: draft.outsideDhakaDeliveryDays.trim() || null,
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        this.form.enable();
        this.saving.set(false);
      }),
    ).subscribe({
      next: (settings) => {
        this.apply(settings);
        this.feedback.set({ kind: 'success', message: 'Delivery settings saved.' });
      },
      error: () => this.feedback.set({
        kind: 'error', message: 'Couldn’t save delivery settings. Your edits are still here.',
      }),
    });
  }

  private apply(settings: DeliverySettings): void {
    const { currency, insideDhakaDeliveryDays, outsideDhakaDeliveryDays, ...fees } = settings;
    this.currency.set(currency);
    this.form.reset({
      ...fees,
      insideDhakaDeliveryDays: insideDhakaDeliveryDays ?? '',
      outsideDhakaDeliveryDays: outsideDhakaDeliveryDays ?? '',
    });
  }
}
