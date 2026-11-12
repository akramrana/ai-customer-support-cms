import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { OrdersService, OrderStatus, OrderSummary, orderStatuses, orderStatusLabel } from './orders.service';

@Component({
  imports: [DatePipe, RouterLink, MatButtonModule, MatFormFieldModule, MatPaginatorModule, MatProgressBarModule, MatSelectModule],
  templateUrl: './order-list.html',
  styleUrl: './orders.scss',
})
export class OrderListPage {
  private readonly api = inject(OrdersService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  private countRequest?: Subscription;
  protected readonly orders = signal<OrderSummary[]>([]);
  protected readonly pending = signal<number | null>(null);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly statuses = orderStatuses;
  protected readonly label = orderStatusLabel;
  protected status: OrderStatus | '' = '';
  protected page = 0;
  protected pageSize = 20;

  constructor() { this.refresh(); }

  protected refresh(): void {
    this.countRequest?.unsubscribe();
    this.countRequest = this.api.pendingCount().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ count }) => this.pending.set(count),
      error: () => this.pending.set(null),
    });
    this.load();
  }

  protected filter(status: OrderStatus | ''): void {
    this.status = status;
    this.page = 0;
    this.load();
  }

  protected paginate(event: PageEvent): void {
    this.page = event.pageIndex;
    this.pageSize = event.pageSize;
    this.load();
  }

  private load(): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.request = this.api.list(this.page + 1, this.pageSize, this.status).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ items, total }) => {
        this.orders.set(items);
        this.total.set(total);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load orders. Try refreshing.');
        this.loading.set(false);
      },
    });
  }
}
