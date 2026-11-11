import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  afterNextRender, Component, DestroyRef, ElementRef, inject, Injector, signal, viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { concatMap, finalize, map, Observable, of, range, reduce, Subscription, switchMap } from 'rxjs';

import { ConversationMessage, ConversationsService, ConversationSummary } from './conversations.service';

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;
  if (error.status === 401) return 'Your session has expired. Sign in again.';
  if (error.status === 403) return 'You don’t have permission to view these conversations.';
  if (error.status === 404) return 'This conversation is no longer available.';
  return fallback;
}

@Component({
  imports: [DatePipe, MatButtonModule, MatPaginatorModule, MatProgressBarModule],
  templateUrl: './conversation-viewer.html',
  styleUrl: './conversation-viewer.scss',
})
export class ConversationViewerPage {
  private readonly api = inject(ConversationsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly historyPane = viewChild<ElementRef<HTMLElement>>('historyPane');
  private readonly paginator = viewChild(MatPaginator);
  private request?: Subscription;
  private newestPage = 0;

  protected readonly pageSize = this.api.pageSize;
  protected readonly conversations = signal<ConversationSummary[]>([]);
  protected readonly listPage = signal(1);
  protected readonly total = signal(0);
  protected readonly listLoading = signal(false);
  protected readonly listError = signal('');
  protected readonly selected = signal<ConversationSummary | null>(null);
  protected readonly showThread = signal(false);
  protected readonly messages = signal<ConversationMessage[]>([]);
  protected readonly oldestPage = signal(0);
  protected readonly messageLoading = signal(false);
  protected readonly messageError = signal('');
  protected readonly senderLabels = { customer: 'Customer', ai: 'AI', admin: 'Admin' };

  constructor() {
    this.refreshList();
  }

  protected refreshList(page = this.listPage()): void {
    if (this.listLoading()) return;
    this.listLoading.set(true);
    this.listError.set('');
    this.api.list(page).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.listLoading.set(false)),
    ).subscribe({
      next: (result) => {
        this.conversations.set(result.items);
        this.listPage.set(result.page);
        this.total.set(result.total);
        const selected = result.items.find(({ id }) => id === this.selected()?.id);
        if (selected) this.selected.set(selected);
      },
      error: (error: unknown) => {
        const paginator = this.paginator();
        if (paginator) paginator.pageIndex = this.listPage() - 1;
        this.listError.set(errorMessage(error, 'Couldn’t load conversations. Try refreshing.'));
      },
    });
  }

  protected changePage(event: PageEvent): void {
    this.refreshList(event.pageIndex + 1);
  }

  protected openConversation(conversation: ConversationSummary): void {
    this.showThread.set(true);
    if (this.selected()?.id === conversation.id) return;
    this.request?.unsubscribe();
    this.selected.set(conversation);
    this.messages.set([]);
    this.oldestPage.set(0);
    this.newestPage = 0;
    this.refreshMessages();
  }

  protected refreshMessages(): void {
    const id = this.selected()?.id;
    if (!id || this.messageLoading()) return;
    if (!this.newestPage) {
      const hint = this.api.lastPage(this.selected()!.messageCount);
      const newest = this.api.messages(id, hint).pipe(switchMap((result) => {
        const last = this.api.lastPage(result.total);
        return last === result.page ? of(result) : this.api.messages(id, last);
      }));
      this.readMessages(newest.pipe(map(({ items, page }) => ({ items, first: page, last: page }))), 'initial');
      return;
    }

    // Re-read the newest loaded page, then only fetch pages appended since it was loaded.
    const refresh = this.api.messages(id, this.newestPage).pipe(switchMap((first) => {
      const last = this.api.lastPage(first.total);
      return range(first.page + 1, Math.max(0, last - first.page)).pipe(
        concatMap((page) => this.api.messages(id, page)),
        reduce((items, page) => items.concat(page.items), first.items),
        map((items) => ({ items, first: this.oldestPage(), last: Math.max(first.page, last) })),
      );
    }));
    this.readMessages(refresh, 'refresh');
  }

  protected loadOlder(): void {
    const id = this.selected()?.id;
    const page = this.oldestPage() - 1;
    if (!id || page < 1 || this.messageLoading()) return;
    this.readMessages(this.api.messages(id, page).pipe(
      map((result) => ({ items: result.items, first: result.page, last: this.newestPage })),
    ), 'older');
  }

  private readMessages(
    source: Observable<{ items: ConversationMessage[]; first: number; last: number }>,
    kind: 'initial' | 'refresh' | 'older',
  ): void {
    const id = this.selected()?.id;
    this.messageLoading.set(true);
    this.messageError.set('');
    this.request = source.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.messageLoading.set(false)),
    ).subscribe({
      next: ({ items, first, last }) => {
        const pane = this.historyPane()?.nativeElement;
        const height = pane?.scrollHeight ?? 0;
        const atEnd = !!pane && height - pane.scrollTop - pane.clientHeight <= 48;
        const unique = new Map(this.messages().map((message) => [message.id, message]));
        for (const item of items) unique.set(item.id, item);
        this.messages.set([...unique.values()].sort((a, b) =>
          a.id.length - b.id.length || (a.id < b.id ? -1 : a.id === b.id ? 0 : 1),
        ));
        this.oldestPage.set(first);
        this.newestPage = last;

        afterNextRender(() => {
          const currentPane = this.historyPane()?.nativeElement;
          if (!currentPane || id !== this.selected()?.id) return;
          if (kind === 'initial' || (kind === 'refresh' && atEnd)) {
            currentPane.scrollTop = currentPane.scrollHeight;
          } else if (kind === 'older' && currentPane === pane) {
            currentPane.scrollTop += currentPane.scrollHeight - height;
          }
        }, { injector: this.injector });
      },
      error: (error: unknown) => {
        this.messageError.set(errorMessage(error, kind === 'older'
          ? 'Couldn’t load older messages. Try again.'
          : 'Couldn’t load messages. Try refreshing.'));
      },
    });
  }
}
