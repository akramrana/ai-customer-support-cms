import { DatePipe, DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { canManageBusinessOperations } from './auth.models';
import { AuthService } from './auth.service';
import { VariantChoice, VariantPicker } from './variant-picker';

interface Movement {
  id: string;
  change: number;
  quantityAfter: number;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  adminName: string | null;
  adminId: string | null;
  createdAt: string;
}

interface InventoryPage {
  stock: number;
  movements: Movement[];
  next: string | null;
}

@Component({
  imports: [DatePipe, ReactiveFormsModule, MatButtonModule, VariantPicker],
  templateUrl: './inventory.html',
  styleUrls: ['./orders.scss', './commerce-pages.scss'],
})
export class InventoryManagementPage {
  private readonly http = inject(HttpClient);
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly session = inject(AuthService).session;
  protected canManage(): boolean { return canManageBusinessOperations(this.session()?.business?.role); }
  protected readonly choice = signal<VariantChoice | null>(null);
  protected readonly data = signal<InventoryPage | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly operation = new FormControl('add', { nonNullable: true });
  protected readonly quantity = new FormControl<number | null>(null);

  protected select(choice: VariantChoice | null): void {
    this.choice.set(choice);
    this.data.set(null);
    this.loading.set(false);
    this.error.set('');
    this.success.set('');
    if (choice) this.load();
  }

  protected load(before?: string): void {
    const choice = this.choice();
    if (!choice || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.http.get<InventoryPage>(this.url(choice), { params: before ? { before } : {} }).subscribe({
      next: (data) => {
        if (choice !== this.choice()) return;
        this.data.set(before ? { ...data, movements: [...(this.data()?.movements ?? []), ...data.movements] } : data);
        this.loading.set(false);
      },
      error: () => {
        if (choice !== this.choice()) return;
        this.error.set('Could not load stock history.');
        this.loading.set(false);
      },
    });
  }

  protected save(): void {
    const choice = this.choice();
    const quantity = this.quantity.value;
    const operation = this.operation.value;
    if (!choice || this.saving() || this.loading()) return;
    if (quantity === null || !Number.isInteger(quantity) || quantity < (operation === 'set' ? 0 : 1)) {
      this.error.set('Enter a valid whole stock quantity.');
      return;
    }
    const action = operation === 'set' ? 'Set stock to ' : operation === 'add' ? 'Add stock by ' : 'Remove stock by ';
    if (!this.window?.confirm(action + quantity + ' for ' + (choice.variant.variantName || choice.variant.sku) + '?')) return;
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    this.http.post<{ stock: number }>(this.url(choice), { operation, quantity }).subscribe({
      next: () => {
        this.saving.set(false);
        if (choice !== this.choice()) return;
        this.quantity.reset();
        this.success.set('Stock updated.');
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        if (choice === this.choice()) this.error.set(error.error?.error || 'Could not update stock.');
      },
    });
  }

  private url(choice: VariantChoice): string {
    return '/api/business/inventory/' + encodeURIComponent(choice.variant.id);
  }
}
