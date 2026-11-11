import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface ConversationSummary {
  id: string;
  customerPsid: string;
  customerName: string | null;
  lastActivityAt: string | null;
  lastMessagePreview: string | null;
  messageCount: number;
}

export interface ConversationMessage {
  id: string;
  direction: 'incoming' | 'outgoing';
  senderType: 'customer' | 'ai' | 'admin';
  body: string | null;
  createdAt: string;
  deliveryStatus: 'received' | 'pending' | 'sent' | 'failed' | null;
}

interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class ConversationsService {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/business/conversations';
  readonly pageSize = 20;

  list(page: number) {
    return this.http.get<Page<ConversationSummary>>(this.url, {
      params: { page, pageSize: this.pageSize },
    });
  }

  messages(id: string, page: number) {
    return this.http.get<Page<ConversationMessage>>(`${this.url}/${encodeURIComponent(id)}/messages`, {
      params: { page, pageSize: this.pageSize },
    });
  }

  lastPage(total: number): number {
    return Math.max(1, Math.ceil(total / this.pageSize));
  }
}
