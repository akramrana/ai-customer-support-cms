import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface ProductFields {
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface VariantFields {
  sku: string;
  variantName: string | null;
  price: string;
  stockQty: number;
  isActive: boolean;
}

export interface ImageFields {
  imageUrl: string;
  altText: string | null;
  sortOrder: number;
}

export interface ProductSummary extends ProductFields {
  id: string;
}

export interface ProductDetail extends ProductSummary {
  variants: (VariantFields & { id: string })[];
  images: (ImageFields & { id: string })[];
}

export interface ProductPage {
  items: ProductSummary[];
  page: number;
  pageSize: number;
  total: number;
}

type ChildWrite<T> = T | (Partial<T> & { id: string });

export interface ProductUpdate extends Partial<ProductFields> {
  variants: ChildWrite<VariantFields>[];
  images: ChildWrite<ImageFields>[];
  removeImageIds?: string[];
}

export interface ProductCreate extends ProductFields {
  variants: VariantFields[];
  images: ImageFields[];
}

@Injectable({ providedIn: 'root' })
export class ProductCatalogService {
  private readonly http = inject(HttpClient);
  private readonly url = '/api/business/products';

  list(page: number, pageSize: number, search: string) {
    return this.http.get<ProductPage>(this.url, { params: { page, pageSize, search } });
  }

  detail(id: string) {
    return this.http.get<ProductDetail>(this.productUrl(id));
  }

  create(input: ProductCreate) {
    return this.http.post<ProductDetail>(this.url, input);
  }

  update(id: string, input: ProductUpdate) {
    return this.http.put<ProductDetail>(this.productUrl(id), input);
  }

  deactivate(id: string) {
    return this.http.delete<void>(this.productUrl(id));
  }

  private productUrl(id: string): string {
    return `${this.url}/${encodeURIComponent(id)}`;
  }
}
