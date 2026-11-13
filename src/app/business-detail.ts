import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, EMPTY, switchMap } from 'rxjs';
import { FacebookPages } from './facebook-pages';
import { Business, ManagementService } from './management.service';

@Component({
  imports: [RouterLink, FacebookPages],
  template: `
    <a routerLink="/super-admin/businesses">Back to businesses</a>
    @if (business(); as row) {
      <header class="page-heading">
        <h1>{{ row.name }}</h1>
        <p>{{ row.slug }} · {{ row.isActive ? 'Active' : 'Inactive' }}</p>
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
  protected readonly business = signal<Business | null>(null);
  protected readonly error = signal('');

  constructor() {
    const api = inject(ManagementService);
    inject(ActivatedRoute).paramMap.pipe(switchMap(params => {
      this.business.set(null);
      this.error.set('');
      return api.business(params.get('businessId')!).pipe(catchError(() => {
        this.error.set('Unable to load this business.');
        return EMPTY;
      }));
    }), takeUntilDestroyed()).subscribe(business => this.business.set(business));
  }
}
