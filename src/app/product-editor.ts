import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, HostListener, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, EMPTY, finalize, Subject, switchMap } from 'rxjs';

import { AuthService } from './auth.service';
import {
  ImageFields, MeasurementUnit, ProductCatalogService, ProductCreate, ProductDetail, ProductUpdate,
  SellingMode, VariantFields,
} from './product-catalog.service';

const listUrl = '/business-admin/products';

function nonblank(control: AbstractControl) {
  return typeof control.value === 'string' && control.value.trim() ? null : { required: true };
}

function integerBetween(max: number) {
  return (control: AbstractControl) => Number.isInteger(control.value)
    && control.value >= 0 && control.value <= max ? null : { integer: true };
}

function previewUrl(value: string): string | null {
  const raw = value.trim();
  if (!/^https?:\/\//i.test(raw)) return null;
  try {
    const url = new URL(raw);
    return url.username || url.password || url.href.length > 2048 ? null : url.href;
  } catch {
    return null;
  }
}

function normalizeVariant<T extends VariantFields>(variant: T): T {
  const [whole, fraction = ''] = (variant.measurementValue ?? '1').split('.');
  const decimals = fraction.replace(/0+$/, '');
  return {
    ...variant,
    sku: variant.sku.trim(),
    variantName: variant.variantName?.trim() || null,
    sellingMode: variant.sellingMode ?? 'packaged',
    measurementUnit: variant.measurementUnit ?? 'pcs',
    measurementValue: String(Number(whole)) + (decimals ? '.' + decimals : ''),
  };
}

function normalizeImage<T extends ImageFields>(image: T): T {
  return { ...image, imageUrl: image.imageUrl.trim(), altText: image.altText?.trim() || null };
}

function changedFields<T extends object>(draft: T, original: T): Partial<T> {
  const changed: Partial<T> = {};
  for (const key of Object.keys(draft) as (keyof T)[]) {
    if (draft[key] !== original[key]) changed[key] = draft[key];
  }
  return changed;
}

function childUpdates<T extends object>(
  drafts: (T & { id: string })[],
  originals: (T & { id: string })[],
): (T | (Partial<T> & { id: string }))[] {
  const byId = new Map(originals.map(({ id, ...fields }) => [id, fields]));
  return drafts.flatMap<T | (Partial<T> & { id: string })>(({ id, ...fields }) => {
    if (!id) return [fields as T];

    const original = byId.get(id)!;
    const changes = changedFields(fields, original);
    return Object.keys(changes).length ? [{ ...changes, id } as Partial<T> & { id: string }] : [];
  });
}

@Component({
  imports: [
    ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule,
    MatProgressBarModule, MatSlideToggleModule,
  ],
  templateUrl: './product-editor.html',
  styleUrl: './product-catalog.scss',
})
export class ProductEditorPage {
  private readonly api = inject(ProductCatalogService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly reloadRequests = new Subject<string | null>();
  private original: ProductDetail | null = null;
  private readonly removedImages = new Set<string>();

  protected readonly id = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly previewUrl = previewUrl;
  protected readonly form = this.fb.group({
    name: ['', [nonblank, Validators.maxLength(255)]],
    description: ['', (control: AbstractControl) =>
      new TextEncoder().encode(control.value).length <= 65535 ? null : { size: true }],
    isActive: true,
    variants: this.fb.array<ReturnType<ProductEditorPage['variantForm']>>([]),
    images: this.fb.array<ReturnType<ProductEditorPage['imageForm']>>([]),
  });
  protected readonly variants = this.form.controls.variants;
  protected readonly images = this.form.controls.images;

  constructor() {
    this.reloadRequests.pipe(
      switchMap((id) => {
        this.loadError.set('');
        this.setProduct(null);
        if (!id) return EMPTY;
        this.loading.set(true);
        return this.api.detail(id).pipe(
          catchError(() => {
            this.loadError.set('Unable to load this product. It may be unavailable.');
            return EMPTY;
          }),
          finalize(() => this.loading.set(false)),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((product) => this.setProduct(product));

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.id.set(params.get('id'));
      this.reload();
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.form.dirty) event.preventDefault();
  }

  canLeave(): boolean {
    if (!this.auth.session() || !this.form.dirty) return true;
    return !this.saving() && (this.window?.confirm('Discard unsaved product changes?') ?? false);
  }

  protected reload(): void {
    this.reloadRequests.next(this.id());
  }

  protected addVariant(): void {
    this.variants.push(this.variantForm());
    this.form.markAsDirty();
  }

  protected removeNewVariant(index: number): void {
    if (this.variants.at(index).controls.id.value) return;
    this.variants.removeAt(index);
    this.form.markAsDirty();
  }

  protected addImage(): void {
    this.images.push(this.imageForm());
    this.form.markAsDirty();
  }

  protected removeImage(index: number): void {
    const id = this.images.at(index).controls.id.value;
    if (id) this.removedImages.add(id);
    this.images.removeAt(index);
    this.form.markAsDirty();
  }

  protected save(): void {
    if (this.saving() || this.loading() || this.loadError()) return;
    this.error.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.error.set('Correct the highlighted fields before saving.');
      return;
    }

    const input = this.payload();
    if (input.variants.length > 100 || input.images.length > 100 || this.removedImages.size > 100) {
      this.error.set('Save up to 100 variant changes, 100 image changes, and 100 image removals at a time.');
      return;
    }

    this.saving.set(true);
    this.form.disable();
    const request = this.original
      ? this.api.update(this.original.id, input as ProductUpdate)
      : this.api.create(input as ProductCreate);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (product) => {
        this.setProduct(product);
        this.snackbar.open('Product saved.', 'Dismiss', { duration: 5000 });
        void this.router.navigateByUrl(listUrl).finally(() => this.finishSaving());
      },
      error: (error: unknown) => {
        this.error.set(error instanceof HttpErrorResponse && error.status === 409
          ? 'A SKU already exists in this business. Use a unique SKU for each variant.'
          : 'Unable to save the product. Your edits are still here.');
        this.finishSaving();
      },
    });
  }

  private finishSaving(): void {
    this.form.enable();
    this.saving.set(false);
  }

  private setProduct(product: ProductDetail | null): void {
    this.original = product;
    this.removedImages.clear();
    this.variants.clear();
    this.images.clear();
    for (const variant of product?.variants ?? []) this.variants.push(this.variantForm(variant));
    for (const image of product?.images ?? []) this.images.push(this.imageForm(image));
    this.form.controls.name.reset(product?.name ?? '');
    this.form.controls.description.reset(product?.description ?? '');
    this.form.controls.isActive.reset(product?.isActive ?? true);
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.error.set('');
  }

  private variantForm(variant?: ProductDetail['variants'][number]) {
    const form = this.fb.group({
      id: variant?.id ?? '',
      sku: [variant?.sku ?? '', [nonblank, Validators.maxLength(100)]],
      variantName: [variant?.variantName ?? '', Validators.maxLength(150)],
      price: [variant?.price ?? '', [Validators.required, Validators.pattern(/^\d{1,10}(?:\.\d{1,2})?$/)]],
      stockQty: [variant?.stockQty ?? 0, integerBetween(4294967295)],
      sellingMode: this.fb.control<SellingMode>(variant?.sellingMode ?? 'packaged'),
      measurementUnit: this.fb.control<MeasurementUnit>(variant?.measurementUnit ?? 'pcs'),
      measurementValue: [variant?.measurementValue ?? '1', [
        Validators.required, Validators.pattern(/^\d{1,9}(?:\.\d{1,3})?$/), Validators.min(0.001),
      ]],
      isActive: variant?.isActive ?? true,
    });
    form.addValidators(() => {
      const { sellingMode, measurementUnit, measurementValue } = form.getRawValue();
      return measurementUnit === 'pcs' && (sellingMode !== 'packaged' || Number(measurementValue) % 1 !== 0)
        ? { pieceMeasurement: true } : null;
    });
    return form;
  }

  private imageForm(image?: ProductDetail['images'][number]) {
    return this.fb.group({
      id: image?.id ?? '',
      imageUrl: [image?.imageUrl ?? '', (control: AbstractControl) =>
        previewUrl(control.value) ? null : { url: true }],
      altText: [image?.altText ?? '', Validators.maxLength(255)],
      sortOrder: [image?.sortOrder ?? 0, integerBetween(2147483647)],
    });
  }

  private payload(): ProductCreate | ProductUpdate {
    const draft = this.form.getRawValue();
    const product = {
      name: draft.name.trim(),
      description: draft.description || null,
      isActive: draft.isActive,
    };
    const variants = draft.variants.map(normalizeVariant);
    const images = draft.images.map(normalizeImage);

    if (!this.original) {
      return {
        ...product,
        variants: variants.map(({ id, ...variant }) => variant),
        images: images.map(({ id, ...image }) => image),
      };
    }

    return {
      ...changedFields(product, {
        name: this.original.name.trim(),
        description: this.original.description || null,
        isActive: this.original.isActive,
      }),
      variants: childUpdates<VariantFields>(variants, this.original.variants.map(normalizeVariant)),
      images: childUpdates<ImageFields>(images, this.original.images.map(normalizeImage)),
      ...(this.removedImages.size ? { removeImageIds: [...this.removedImages] } : {}),
    };
  }
}
