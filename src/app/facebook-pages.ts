import { DOCUMENT, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { RouterLink } from '@angular/router';
import { catchError, EMPTY, finalize, Subject, switchMap } from 'rxjs';
import { Page } from './management.service';

interface FacebookPage {
  id: string;
  business_id: string;
  business_name: string;
  page_id: string;
  page_name: string | null;
  is_active: boolean;
  connected_at: string;
}

@Component({
  selector: 'app-facebook-pages',
  imports: [DatePipe, RouterLink, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatPaginatorModule],
  templateUrl: './facebook-pages.html',
  styleUrls: ['./product-list.scss', './product-catalog.scss'],
})
export class FacebookPages implements OnInit {
  readonly businessId = input<string>();
  private readonly http = inject(HttpClient);
  private readonly destroy = inject(DestroyRef);
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly requests = new Subject<void>();
  private readonly url = '/api/platform/facebook-pages';
  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly result = signal<Page<FacebookPage> | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly statusError = signal('');
  protected readonly saving = signal<string | null>(null);
  private page = 1;
  private pageSize = 20;
  private term = '';

  ngOnInit(): void {
    this.requests.pipe(switchMap(() => {
      this.loading.set(true);
      this.error.set('');
      const url = this.businessId() ? '/api/platform/businesses/' + this.businessId() + '/facebook-pages' : this.url;
      return this.http.get<Page<FacebookPage>>(url, { params: {
        page: this.page, pageSize: this.pageSize, search: this.term,
      } }).pipe(catchError(() => {
        this.error.set('Unable to load Facebook Pages.');
        return EMPTY;
      }), finalize(() => this.loading.set(false)));
    }), takeUntilDestroyed(this.destroy)).subscribe(result => this.result.set(result));
    this.load();
  }

  protected load(): void { this.requests.next(); }

  protected applySearch(): void {
    this.term = this.search.value.trim();
    this.page = 1;
    this.load();
  }

  protected paginate(event: PageEvent): void {
    this.page = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.load();
  }

  protected toggle(row: FacebookPage): void {
    if (this.saving()) return;
    if (row.is_active && !this.window?.confirm('Deactivate this Page? Automated Messenger processing will pause.')) return;
    this.saving.set(row.id);
    this.statusError.set('');
    this.http.patch<FacebookPage>(this.url + '/' + row.id + '/status', { is_active: !row.is_active })
      .pipe(finalize(() => this.saving.set(null)), takeUntilDestroyed(this.destroy)).subscribe({
        next: updated => {
          this.result.update(result => result && {
            ...result, items: result.items.map(item => item.id === updated.id ? updated : item),
          });
          if (this.loading()) this.load();
        },
        error: () => this.statusError.set('Unable to change the Page status. Try again.'),
      });
  }
}
