import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
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
      <p>Facebook sign-in will be available here when connection setup is enabled.</p>
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
export class BusinessFacebookPages {
  readonly setup = input(false);
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

  protected load(): void { this.requests.next(); }
}

@Component({
  imports: [BusinessFacebookPages],
  template: '<app-business-facebook-pages [setup]="true" />',
})
export class BusinessFacebookPagesSetup {}
