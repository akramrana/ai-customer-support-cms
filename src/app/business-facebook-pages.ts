import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { AuthService } from './auth.service';
import { catchError, EMPTY, finalize, Subject, switchMap } from 'rxjs';

interface BusinessFacebookPage {
  id: string;
  page_id: string;
  page_name: string | null;
  is_active: boolean;
  connected_at: string;
  has_access_token: boolean;
}

@Component({
  selector: 'app-business-facebook-pages',
  imports: [MatButtonModule, MatCardModule, RouterLink],
  template: `
    @if (setup()) {
      <header class="page-heading"><h1>Facebook Pages</h1></header>
      @if (notice()) { <p role="status">{{ notice() }}</p> }
      @if (actionError()) { <p role="alert">{{ actionError() }}</p> }
      @if (canConnect()) {
        <button mat-flat-button type="button" [disabled]="busy()" (click)="authorize()">Connect Facebook Page</button>
        <button mat-button type="button" [disabled]="busy()" (click)="loadAvailable()">Refresh available Pages</button>
        @if (available(); as choices) {
          <h2>Select a Facebook Page</h2>
          @for (page of choices; track page.page_id) {
            <p>{{ page.page_name || page.page_id }} ({{ page.page_id }})
              <button mat-button type="button" [disabled]="busy()" (click)="connect(page.page_id)">Connect</button>
            </p>
          } @empty { <p>Facebook returned no Pages with the required management and messaging access.</p> }
        }
        @if (busy()) { <p role="status">Working on your Facebook connection…</p> }
      } @else { <p>A business owner or administrator can connect Pages.</p> }
    }
    <mat-card appearance="outlined">
      <mat-card-content>
        @if (loading()) {
          <p role="status">Loading Facebook Pages…</p>
        } @else if (error()) {
          <p role="alert">Unable to load Facebook Pages.</p>
          <button mat-button type="button" (click)="load()">Retry</button>
        } @else {
          <h2>{{ connected() ? 'Facebook Page Connected' : 'Connect Facebook Page' }}</h2>
          <ul>
            @for (page of pages(); track page.id) {
              <li>
                <strong>{{ page.page_name || 'Unnamed Page' }}</strong>
                <span>Page ID {{ page.page_id }}</span>
                <span>{{ page.is_active ? 'Active' : 'Inactive' }} · {{ page.has_access_token ? 'Connected' : 'Connection required' }}</span>
                @if (setup() && canConnect()) {
                  <button mat-button type="button" [disabled]="busy()" (click)="authorize()">Reconnect</button>
                }
                @if (!page.is_active || !page.has_access_token) {
                  <span>Messenger automation unavailable</span>
                }
              </li>
            }
          </ul>
          @if (!setup()) {
            <a mat-flat-button routerLink="/business-admin/facebook-pages">
              {{ connected() ? 'Add another Page' : 'Connect Facebook Page' }}
            </a>
          } @else {
            <a mat-button routerLink="/business-admin/dashboard">Back to dashboard</a>
          }
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    mat-card { margin-block-end: 1.25rem; }
    mat-card-content { padding: 1.25rem; }
    h2 { margin-block-start: 0; }
    ul { list-style: none; padding: 0; }
    ul:empty { display: none; }
    li { display: flex; flex-wrap: wrap; gap: .35rem 1rem; margin-block: .75rem; }
  `,
})
export class BusinessFacebookPages implements OnInit {
  readonly setup = input(false);
  private readonly window = inject(DOCUMENT).defaultView;
  private popup: Window | null = null;
  private callbackOrigin: string | null = null;
  private popupTimer?: number;
  private readonly auth = inject(AuthService);
  private readonly endpoint = '/api/business/facebook-pages';
  protected readonly busy = signal(false);
  protected readonly actionError = signal('');
  protected readonly notice = signal('');
  protected readonly available = signal<Pick<BusinessFacebookPage, 'page_id' | 'page_name'>[] | null>(null);
  private readonly http = inject(HttpClient);
  private readonly destroy = inject(DestroyRef);
  private readonly requests = new Subject<void>();
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly pages = signal<BusinessFacebookPage[]>([]);
  protected connected(): boolean { return this.pages().some(page => page.has_access_token); }

  constructor() {
    this.requests.pipe(switchMap(() => {
      this.loading.set(true);
      this.error.set(false);
      return this.http.get<{ items: BusinessFacebookPage[] }>('/api/business/facebook-pages').pipe(
        catchError(() => { this.error.set(true); return EMPTY; }),
        finalize(() => this.loading.set(false)),
      );
    }), takeUntilDestroyed(this.destroy)).subscribe(response => this.pages.set(response.items));
    this.load();
  }

  ngOnInit(): void {
    if (!this.setup() || !this.canConnect()) return;
    this.window?.addEventListener('message', this.receiveResult);
    this.destroy.onDestroy(() => {
      this.window?.removeEventListener('message', this.receiveResult);
      this.finishPopup();
    });
    this.loadAvailable();
  }

  private readonly receiveResult = (event: MessageEvent): void => {
    if (!this.popup || event.source !== this.popup || event.origin !== this.callbackOrigin
        || event.data?.type !== 'facebook-oauth') return;
    const result = event.data.result;
    if (!['select', 'cancelled', 'permissions', 'error'].includes(result)) return;
    this.finishPopup();
    if (result) {
      this.notice.set(result === 'cancelled' ? 'Facebook authorization was cancelled.'
        : result === 'permissions' ? 'Grant all requested Facebook permissions, then try again.'
        : result === 'select' ? '' : 'Facebook authorization could not be completed. Try again.');

    }
    if (result === 'select') this.loadAvailable(true);
  };

  protected loadAvailable(expectAuthorization = false): void {
    this.http.get<{ authorized: boolean; items: Pick<BusinessFacebookPage, 'page_id' | 'page_name'>[] }>(this.endpoint + '/oauth/available')
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: data => {
          this.available.set(data.authorized ? data.items : null);
          if (expectAuthorization && !data.authorized) this.actionError.set('Authorization is unavailable. Try again.');
        },
        error: () => this.actionError.set('Unable to load available Pages. Authorize Facebook to try again.'),
      });
  }

  protected canConnect(): boolean {
    const role = this.auth.session()?.business?.role;
    return role === 'owner' || role === 'admin';
  }

  protected authorize(): void {
    if (this.busy()) return;
    const popup = this.window?.open('about:blank', '_blank', 'popup,width=620,height=740');
    if (!popup) {
      this.actionError.set('Allow popups for this site and try again.');
      return;
    }
    this.popup = popup;
    this.busy.set(true);
    this.available.set(null);
    this.notice.set('');
    this.actionError.set('');
    this.http.post<{ authorizationUrl: string; callbackOrigin: string }>(this.endpoint + '/oauth/start', {}).pipe(
      takeUntilDestroyed(this.destroy),
    ).subscribe({ next: result => {
      try {
        const authorization = new URL(result.authorizationUrl);
        const callback = new URL(result.callbackOrigin);
        if (authorization.origin !== 'https://www.facebook.com' || callback.protocol !== 'https:') throw new Error();
        this.callbackOrigin = callback.origin;
        popup.location.replace(authorization.href);
        this.popupTimer = this.window?.setInterval(() => {
          if (!popup.closed) return;
          this.finishPopup();
          this.notice.set('Facebook window closed. If you authorized the app, select an available Page.');
          this.loadAvailable();
        }, 1000);
      } catch {
        this.finishPopup();
        this.actionError.set('Unable to open Facebook authorization. Try again.');
      }
    }, error: error => { this.finishPopup(); this.showError(error); } });
  }

  private finishPopup(): void {
    if (this.popupTimer !== undefined) this.window?.clearInterval(this.popupTimer);
    this.popupTimer = undefined;
    this.popup?.close();
    this.popup = null;
    this.callbackOrigin = null;
    this.busy.set(false);
  }

  protected connect(pageId: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.actionError.set('');
    this.http.post<void>(this.endpoint + '/connect', { page_id: pageId }).pipe(
      finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroy),
    ).subscribe({ next: () => {
      this.available.set(null);
      this.notice.set('Facebook Page connected.');
      this.load();
    }, error: error => { this.available.set(null); this.showError(error); } });
  }

  private showError(error: unknown): void {
    this.actionError.set(error instanceof HttpErrorResponse && typeof error.error?.error === 'string'
      ? error.error.error : 'Unable to connect the Page. Authorize Facebook and try again.');
  }

  protected load(): void { this.requests.next(); }
}

@Component({
  imports: [BusinessFacebookPages],
  template: '<app-business-facebook-pages [setup]="true" />',
})
export class BusinessFacebookPagesSetup {}
