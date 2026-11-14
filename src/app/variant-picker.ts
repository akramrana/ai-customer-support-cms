import { Component, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { catchError, map, of, switchMap, timer } from 'rxjs';
import { ProductCatalogService, VariantChoice } from './product-catalog.service';

export type { VariantChoice } from './product-catalog.service';

@Component({
  selector: 'app-variant-picker',
  imports: [ReactiveFormsModule, MatAutocompleteModule, MatFormFieldModule, MatInputModule],
  template: `
    <mat-form-field appearance="outline">
      <mat-label>Find a product variant</mat-label>
      <input matInput [formControl]="query" [matAutocomplete]="matches" maxlength="255"
        placeholder="Search by name, SKU, or brand">
      <mat-autocomplete #matches="matAutocomplete" [displayWith]="display" [autoActiveFirstOption]="true"
        (optionSelected)="choose($event)">
        @for (entry of results(); track entry.variant.id) {
          <mat-option [value]="entry">
            <strong>{{ entry.product.name }}</strong>
            <span class="variant-meta">{{ variantLabel(entry) }} · {{ entry.variant.sku }}</span>
            <span class="variant-meta">Price {{ entry.variant.price }}{{ currency() ? ' ' + currency() : '' }}
              · {{ entry.variant.stockQty }} in stock
              @if (!entry.product.isActive || !entry.variant.isActive) { · Inactive }
            </span>
          </mat-option>
        }
        @if (status()) { <mat-option disabled>{{ status() }}</mat-option> }
      </mat-autocomplete>
      <mat-hint>Type at least 2 characters</mat-hint>
    </mat-form-field>
    <span class="sr-only" role="status">{{ status() }}</span>
  `,
  styles: [`
    :host { display: block; max-width: 42rem; margin-block: .75rem; }
    mat-form-field { width: 100%; }
    .variant-meta { display: block; font-size: .875rem; color: var(--mat-sys-on-surface-variant); overflow-wrap: anywhere; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  `],
})
export class VariantPicker {
  private readonly api = inject(ProductCatalogService);
  readonly activeOnly = input(false);
  readonly currency = input('');
  readonly selected = output<VariantChoice | null>();
  protected readonly query = new FormControl<string | VariantChoice>('', { nonNullable: true });
  protected readonly results = signal<VariantChoice[]>([]);
  protected readonly status = signal('');

  protected readonly display = (entry: string | VariantChoice | null): string =>
    typeof entry === 'string' ? entry : entry ? entry.product.name + ' · ' + this.variantLabel(entry) : '';

  constructor() {
    this.query.valueChanges.pipe(
      switchMap(value => {
        this.results.set([]);
        this.status.set('');
        if (typeof value !== 'string') return of(null);
        this.selected.emit(null);
        const search = value.trim();
        if (search.length < 2) return of(null);
        this.status.set('Searching catalog…');
        // Switch immediately on input so an old request cannot populate the dropdown during the debounce.
        return timer(300).pipe(
          switchMap(() => this.api.searchVariants(search, this.activeOnly())),
          map(({ items }) => ({ items, status: items.length ? '' : 'No matching variants.' })),
          catchError(() => of({ items: [], status: 'Could not search the catalog. Edit your search to try again.' })),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe(result => {
      if (!result) return;
      this.results.set(result.items);
      this.status.set(result.status);
    });
  }

  protected variantLabel(entry: VariantChoice): string {
    const variant = entry.variant;
    const size = Number(variant.measurementValue) + ' ' + variant.measurementUnit;
    return variant.variantName ? variant.variantName + ' · ' + size : size;
  }

  protected choose(event: MatAutocompleteSelectedEvent): void {
    this.selected.emit(event.option.value as VariantChoice);
  }
}
