import { DOCUMENT } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, EMPTY, finalize, switchMap } from 'rxjs';
import { FacebookPages } from './facebook-pages';
import { Business, ManagementService } from './management.service';

@Component({
  imports: [RouterLink, FacebookPages, MatButtonModule],
  template: `
    <a routerLink="/super-admin/businesses">Back to businesses</a>
    @if (business(); as row) {
      <header class="page-heading">
        <h1>{{ row.name }}</h1>
        <p>{{ row.slug }} · {{ row.isActive ? 'Active' : 'Inactive' }}</p>
        <button mat-button type="button" [disabled]="saving()" (click)="toggle(row)">
          {{ saving() ? 'Saving…' : row.isActive ? 'Deactivate business' : 'Activate business' }}
        </button>
        @if (statusError()) { <p role="alert">{{ statusError() }}</p> }
      </header>
      <nav aria-label="Business management">
        <a [routerLink]="['/super-admin/administrators', row.id]">Administrators</a>
        · <a [routerLink]="['/super-admin/users', row.id]">Users</a>
      </nav>
      @for (businessId of [row.id]; track businessId) {
        <app-facebook-pages [businessId]="businessId" />
      }
    } @else if (error()) {
      <p role="alert">{{ error() }}</p>
    } @else {
      <p role="status">Loading business…</p>
    }
  `,
})
export class BusinessDetail {
  private readonly api = inject(ManagementService);
  private readonly destroy = inject(DestroyRef);
  private readonly window = inject(DOCUMENT).defaultView;
  protected readonly saving = signal(false);
  protected readonly statusError = signal('');
  protected readonly business = signal<Business | null>(null);
  protected readonly error = signal('');

  constructor() {

    inject(ActivatedRoute).paramMap.pipe(switchMap(params => {
      this.business.set(null);
      this.error.set('');
      this.statusError.set('');
      return this.api.business(params.get('businessId')!).pipe(catchError(() => {
        this.error.set('Unable to load this business.');
        return EMPTY;
      }));
    }), takeUntilDestroyed()).subscribe(business => this.business.set(business));
  }

  protected toggle(row: Business): void {
    if (this.saving() || (row.isActive && !this.window?.confirm('Deactivate ' + row.name + '?'))) return;
    this.saving.set(true);
    this.statusError.set('');
    this.api.setBusinessStatus(row.id, !row.isActive).pipe(
      finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroy),
    ).subscribe({
      next: updated => { if (this.business()?.id === updated.id) this.business.set(updated); },
      error: () => { if (this.business()?.id === row.id) this.statusError.set('Unable to change the business status.'); },
    });
  }
}
