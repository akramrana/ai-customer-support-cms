import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, EMPTY, finalize, from, map, mergeMap, of, Subject, switchMap, tap } from 'rxjs';

import { ProductCatalogService, ProductSummary } from './product-catalog.service';

@Component({
  imports: [
    ReactiveFormsModule, RouterLink, MatButtonModule, MatChipsModule, MatFormFieldModule,
    MatIconModule, MatInputModule, MatPaginatorModule, MatProgressBarModule, MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './product-list.html',
  styleUrl: './product-list.scss',
})
export class ProductListPage {
  private readonly api = inject(ProductCatalogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly refresh = new Subject<void>();
  private searchTerm = '';

  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly columns = ['name', 'status', 'variants', 'actions'];
  protected readonly items = signal<ProductSummary[]>([]);
  protected readonly counts = signal<Record<string, number | null>>({});
  protected readonly page = signal(0);
  protected readonly pageSize = signal(20);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly deactivating = signal<string | null>(null);
  protected readonly actionError = signal('');
  protected readonly success = signal('');

  constructor() {
    this.refresh.pipe(
      switchMap(() => {
        this.loading.set(true);
        this.error.set('');
        this.counts.set({});
        return this.api.list(this.page() + 1, this.pageSize(), this.searchTerm).pipe(
          tap(({ items, total }) => {
            this.items.set(items);
            this.total.set(total);
            this.loading.set(false);
          }),
          switchMap(({ items }) => from(items).pipe(
            mergeMap(({ id }) => this.api.detail(id).pipe(
              map(({ variants }) => ({ id, count: variants.length })),
              catchError(() => of({ id, count: null })),
            ), 4),
          )),
          catchError(() => {
            this.loading.set(false);
            this.error.set('Unable to load products. Try again.');
            return EMPTY;
          }),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(({ id, count }) => this.counts.update((counts) => ({ ...counts, [id]: count })));

    this.search.valueChanges.pipe(
      map((value) => value.trim()),
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((search) => {
      this.searchTerm = search;
      this.page.set(0);
      this.reload();
    });

    this.reload();
  }

  protected reload(): void {
    this.refresh.next();
  }

  protected changePage(event: PageEvent): void {
    this.page.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.reload();
  }

  protected deactivate(product: ProductSummary): void {
    if (this.deactivating() || !this.window?.confirm(`Deactivate “${product.name}”?`)) return;

    this.deactivating.set(product.id);
    this.actionError.set('');
    this.success.set('');
    this.api.deactivate(product.id).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.deactivating.set(null)),
    ).subscribe({
      next: () => {
        this.items.update((items) => items.map((item) =>
          item.id === product.id ? { ...item, isActive: false } : item,
        ));
        this.success.set('Product deactivated.');
      },
      error: () => this.actionError.set('Unable to deactivate the product. Try again.'),
    });
  }
}
