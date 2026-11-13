import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { ActivatedRoute } from '@angular/router';
import { catchError, EMPTY, finalize, Subject, switchMap } from 'rxjs';
import { CatalogTaxonomyService, TaxonomyItem, TaxonomyKind, TaxonomyPage } from './catalog-taxonomy.service';

@Component({
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatPaginatorModule],
  templateUrl: './catalog-taxonomy.html',
  styleUrl: './product-catalog.scss',
})
export class CatalogTaxonomyPage {
  private readonly api = inject(CatalogTaxonomyService);
  private readonly destroy = inject(DestroyRef);
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly kind: TaxonomyKind = inject(ActivatedRoute).snapshot.data['kind'];
  private readonly requests = new Subject<void>();
  private page = 1;
  private size = 20;
  private term = '';

  protected readonly title = this.kind === 'brands' ? 'Brands' : 'Categories';
  protected readonly label = this.kind === 'brands' ? 'brand' : 'category';
  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly name = new FormControl('', {
    nonNullable: true,
    validators: control => {
      const name = control.value.trim().replace(/\s+/gu, ' ');
      return name && Array.from(name).length <= 150 ? null : { name: true };
    },
  });
  protected readonly result = signal<TaxonomyPage | null>(null);
  protected readonly editing = signal<TaxonomyItem | null | undefined>(undefined);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly loadError = signal('');
  protected readonly error = signal('');

  constructor() {
    this.requests.pipe(switchMap(() => {
      this.loading.set(true);
      this.loadError.set('');
      return this.api.list(this.kind, this.page, this.size, this.term).pipe(
        catchError(() => {
          this.loadError.set('Unable to load ' + this.title.toLowerCase() + '.');
          return EMPTY;
        }),
        finalize(() => this.loading.set(false)),
      );
    }), takeUntilDestroyed(this.destroy)).subscribe(result => this.result.set(result));
    this.load();
  }

  protected load(): void {
    this.requests.next();
  }

  protected applySearch(): void {
    this.term = this.search.value.trim().replace(/\s+/gu, ' ');
    this.page = 1;
    this.load();
  }

  protected paginate(event: PageEvent): void {
    this.page = event.pageIndex + 1;
    this.size = event.pageSize;
    this.load();
  }

  protected edit(item?: TaxonomyItem): void {
    this.editing.set(item ?? null);
    this.name.reset(item?.name ?? '');
    this.error.set('');
  }

  protected cancel(): void {
    this.editing.set(undefined);
    this.error.set('');
  }

  protected save(): void {
    if (this.busy() || this.editing() === undefined) return;
    this.name.markAsTouched();
    if (this.name.invalid) return;
    this.busy.set(true);
    this.error.set('');
    this.api.save(this.kind, this.name.value.trim().replace(/\s+/gu, ' '), this.editing()?.id)
      .pipe(finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroy)).subscribe({
        next: () => { this.cancel(); this.load(); },
        error: error => this.showError(error),
      });
  }

  protected remove(item: TaxonomyItem): void {
    if (this.busy() || !this.window?.confirm('Delete ' + item.name + '? Existing products keep their assignment.')) return;
    this.busy.set(true);
    this.error.set('');
    this.api.remove(this.kind, item.id)
      .pipe(finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroy)).subscribe({
        next: () => {
          if (this.editing()?.id === item.id) this.cancel();
          if (this.result()?.items.length === 1 && this.page > 1) this.page--;
          this.load();
        },
        error: error => this.showError(error),
      });
  }

  private showError(error: unknown): void {
    this.error.set(error instanceof HttpErrorResponse && [400, 404, 409].includes(error.status)
      && typeof error.error?.error === 'string' ? error.error.error : 'Unable to complete the request. Try again.');
  }
}
