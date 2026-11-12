import { DatePipe, DOCUMENT } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from './auth.service';
import { OrderAction, OrderDetail, OrdersService, orderStatusLabel } from './orders.service';

@Component({
  imports: [DatePipe, RouterLink, MatButtonModule, MatProgressBarModule],
  templateUrl: './order-detail.html',
  styleUrl: './orders.scss',
})
export class OrderDetailPage {
  private readonly api = inject(OrdersService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
  protected readonly session = inject(AuthService).session;
  protected readonly order = signal<OrderDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly label = orderStatusLabel;

  constructor() { this.load(); }

  protected load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.api.details(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (order) => { this.order.set(order); this.loading.set(false); },
      error: (error) => {
        this.error.set(error.status === 404 ? 'Order not found.' : 'Could not load this order.');
        this.loading.set(false);
      },
    });
  }

  protected review(action: OrderAction): void {
    const order = this.order();
    if (!order || order.status !== 'pending_confirmation' || this.saving() || this.loading()) return;
    const verb = action === 'confirm' ? 'Confirm' : 'Cancel';
    if (!this.window?.confirm(verb + ' order ' + order.reference + '?')) return;
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    this.api.review(this.id, action).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ status }) => {
        this.order.set({ ...order, status });
        this.success.set('Order ' + this.label(status).toLowerCase() + '.');
        this.saving.set(false);
        this.load();
      },
      error: (error) => {
        this.error.set(error.status === 409 ? 'This order was already reviewed. Refresh to see its current status.'
          : 'Could not update this order.');
        this.saving.set(false);
      },
    });
  }
}
