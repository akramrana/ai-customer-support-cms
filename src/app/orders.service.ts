import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export const orderStatuses = ['draft', 'pending_confirmation', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'dispatched'] as const;
export type OrderStatus = (typeof orderStatuses)[number];
export type OrderAction = 'confirm' | 'cancel' | 'dispatch';

export interface OrderSummary {
  id: string;
  reference: string;
  customerName: string | null;
  phone: string | null;
  status: OrderStatus;
  total: string;
  currency: string;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  productName: string;
  variantName: string | null;
  sku: string;
  packages: number | null;
  requestedQuantity: string | null;
  requestedUnit: string | null;
  measurementValue: string | null;
  measurementUnit: string | null;
  unitPrice: string;
  lineTotal: string;
}

export interface OrderDetail extends OrderSummary {
  conversationId: string | null;
  source?: 'manual' | 'messenger' | null;
  confirmedBy?: string | null;
  confirmedAt?: string | null;
  dispatchedAt?: string | null;
  address: string | null;
  region: 'inside_dhaka' | 'outside_dhaka' | null;
  extraRequest: string | null;
  subtotal: string;
  deliveryFee: string;
  items: OrderItem[];
}

export function shortOrderNumber(reference: string): string {
  return reference.replace(/^ORD-/i, '').slice(-6);
}

export function orderStatusLabel(status: OrderStatus): string {
  if (status === 'pending_confirmation') return 'Awaiting review';
  return status[0].toUpperCase() + status.slice(1);
}

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/business/orders';

  list(page: number, pageSize: number, status: OrderStatus | '') {
    return this.http.get<{ items: OrderSummary[]; total: number }>(this.url, {
      params: { page, pageSize, ...(status ? { status } : {}) },
    });
  }

  pendingCount() {
    return this.http.get<{ count: number }>(this.url + '/pending-count');
  }

  details(id: string) {
    return this.http.get<OrderDetail>(this.url + '/' + encodeURIComponent(id));
  }

  create(input: { requestId: string; zone: 'inside' | 'outside'; customerName: string; phone: string; address: string;
    items: { variantId: string; quantity: number }[] }) {
    return this.http.post<{ id: string }>(this.url, input);
  }

  review(id: string, action: OrderAction) {
    return this.http.post<{ status: OrderStatus }>(this.url + '/' + encodeURIComponent(id) + '/' + action, {});
  }
}
