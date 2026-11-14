import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { Router, RouterLink } from '@angular/router';
import { DeliverySettings, DeliverySettingsService } from './delivery-settings.service';
import { OrdersService } from './orders.service';
import { VariantChoice, VariantPicker } from './variant-picker';

interface DraftItem extends VariantChoice { quantity: number }

@Component({
  imports: [DecimalPipe, ReactiveFormsModule, MatButtonModule, RouterLink, VariantPicker],
  templateUrl: './manual-order.html',
  styleUrls: ['./orders.scss', './commerce-pages.scss'],
})
export class ManualOrderPage {
  private readonly api = inject(OrdersService);
  private readonly settingsApi = inject(DeliverySettingsService);
  private readonly router = inject(Router);
  private readonly requestId = crypto.randomUUID();
  protected readonly choice = signal<VariantChoice | null>(null);
  protected readonly items = signal<DraftItem[]>([]);
  protected readonly settings = signal<DeliverySettings | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly quantity = new FormControl<number | null>(1);
  protected readonly form = new FormGroup({
    customerName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(40)] }),
    address: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(350)] }),
    zone: new FormControl<'inside' | 'outside'>('inside', { nonNullable: true }),
  });
  protected readonly subtotal = computed(() => this.items().reduce(
    (cents, item) => cents + Math.round(Number(item.variant.price) * 100) * item.quantity, 0));

  constructor() { this.loadSettings(); }

  protected loadSettings(): void {
    this.loading.set(true);
    this.error.set('');
    this.settingsApi.load().subscribe({
      next: (settings) => { this.settings.set(settings); this.loading.set(false); },
      error: () => { this.error.set('Could not load delivery charges.'); this.loading.set(false); },
    });
  }

  protected delivery(): number {
    const settings = this.settings();
    return Math.round(Number(this.form.controls.zone.value === 'inside' ? settings?.insideDhakaFee : settings?.outsideDhakaFee) * 100);
  }

  protected add(): void {
    const choice = this.choice();
    const quantity = this.quantity.value;
    if (!choice || this.saving()) return;
    if (!choice.variant.isActive || !choice.product.isActive) {
      this.error.set('Choose an active product variant.');
      return;
    }
    if (quantity === null || !Number.isInteger(quantity) || quantity < 1 || quantity > 2147483647) {
      this.error.set('Enter a positive whole quantity.');
      return;
    }
    if (this.items().some(item => item.variant.id === choice.variant.id)) {
      this.error.set('This variant is already listed. Change its quantity in the table.');
      return;
    }
    if (this.items().length >= 50) {
      this.error.set('An order can contain up to 50 variants.');
      return;
    }
    this.items.update(items => [...items, { ...choice, quantity }]);
    this.error.set('');
  }

  protected setQuantity(id: string, quantity: number): void {
    this.items.update(items => items.map(item => item.variant.id === id ? { ...item, quantity } : item));
  }

  protected remove(id: string): void {
    this.items.update(items => items.filter(item => item.variant.id !== id));
  }

  protected save(): void {
    if (this.saving() || !this.settings()) return;
    if (this.form.invalid || !this.items().length || this.items().some(
      ({ quantity }) => !Number.isInteger(quantity) || quantity < 1 || quantity > 2147483647)) {
      this.error.set('Enter customer details and a positive whole quantity for every item.');
      return;
    }
    this.saving.set(true);
    this.form.disable();
    this.error.set('');
    this.api.create({
      ...this.form.getRawValue(), requestId: this.requestId,
      items: this.items().map(({ variant, quantity }) => ({ variantId: variant.id, quantity })),
    }).subscribe({
      next: ({ id }) => {
        void this.router.navigate(['/business-admin/orders', id], { state: { manualOrderCreated: true } });
      },
      error: (error) => {
        this.form.enable();
        this.saving.set(false);
        this.error.set(error.error?.error || 'Could not verify the order was saved. Try saving again.');
      },
    });
  }
}
