import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, reduce } from 'rxjs';

export type TaxonomyKind = 'brands' | 'categories';
export interface TaxonomyItem { id: string; name: string }
export interface TaxonomyPage { items: TaxonomyItem[]; page: number; pageSize: number; total: number }

@Injectable({ providedIn: 'root' })
export class CatalogTaxonomyService {
  private readonly http = inject(HttpClient);

  list(kind: TaxonomyKind, page: number, pageSize: number, search = '') {
    return this.http.get<TaxonomyPage>(this.url(kind), { params: { page, pageSize, search } });
  }

  options(kind: TaxonomyKind) {
    return this.list(kind, 1, 100).pipe(
      expand(page => page.page * page.pageSize < page.total ? this.list(kind, page.page + 1, 100) : EMPTY),
      reduce((items, page) => items.concat(page.items), [] as TaxonomyItem[]),
    );
  }

  save(kind: TaxonomyKind, name: string, id?: string) {
    return id ? this.http.put<TaxonomyItem>(this.url(kind, id), { name })
      : this.http.post<TaxonomyItem>(this.url(kind), { name });
  }

  remove(kind: TaxonomyKind, id: string) {
    return this.http.delete<void>(this.url(kind, id));
  }

  private url(kind: TaxonomyKind, id?: string) {
    return '/api/business/' + kind + (id ? '/' + encodeURIComponent(id) : '');
  }
}
