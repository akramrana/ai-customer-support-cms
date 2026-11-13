import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute } from '@angular/router';
import { catchError, EMPTY, expand, finalize, reduce, Subject, switchMap } from 'rxjs';
import { Business, ManagementService } from './management.service';

interface UsageCounts {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  inputTokens: number;
  outputTokens: number;
  averageLatencyMs: number | null;
}

interface DailyUsage extends UsageCounts { date: string }
interface Usage extends UsageCounts {
  from: string;
  to: string;
  daily: DailyUsage[];
  recentErrors: { code: string; calls: number; lastSeen: string }[];
}

const dayMs = 86_400_000;
const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);

@Component({
  imports: [DatePipe, DecimalPipe, PercentPipe, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './ai-usage.html',
  styleUrls: ['./product-catalog.scss', './ai-usage.scss'],
})
export class AiUsagePage {
  private readonly http = inject(HttpClient);
  private readonly management = inject(ManagementService);
  private readonly destroy = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly requests = new Subject<{ from: string; to: string; businessId: string }>();
  protected readonly platform = inject(ActivatedRoute).snapshot.data['platform'] === true;
  protected readonly form = this.fb.group({
    from: isoDay(Date.now() - 29 * dayMs), to: isoDay(Date.now()), businessId: '',
  });
  protected readonly businesses = signal<Business[]>([]);
  protected readonly businessError = signal(false);
  protected readonly businessesLoading = signal(false);
  protected readonly usage = signal<Usage | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly chart = signal<{ rows: { date: string; inputTokens: number; outputTokens: number }[]; max: number }>({ rows: [], max: 1 });

  constructor() {
    this.requests.pipe(switchMap(({ from, to, businessId }) => {
      this.loading.set(true);
      this.error.set('');
      return this.http.get<Usage>(this.platform ? '/api/platform/ai-usage' : '/api/business/ai-usage', {
        params: { from, to, ...(this.platform && businessId ? { businessId } : {}) },
      }).pipe(catchError((error: unknown) => {
        this.error.set(error instanceof HttpErrorResponse && error.status === 400 && typeof error.error?.error === 'string'
          ? error.error.error : 'Unable to load AI usage. Try again.');
        return EMPTY;
      }), finalize(() => this.loading.set(false)));
    }), takeUntilDestroyed(this.destroy)).subscribe(usage => {
      this.usage.set(usage);
      const byDate = new Map(usage.daily.map(row => [row.date, row]));
      const rows = [];
      for (let time = Date.parse(usage.from); time <= Date.parse(usage.to); time += dayMs) {
        const date = isoDay(time);
        const row = byDate.get(date);
        rows.push({ date, inputTokens: row?.inputTokens ?? 0, outputTokens: row?.outputTokens ?? 0 });
      }
      this.chart.set({ rows, max: Math.max(1, ...rows.map(row => row.inputTokens + row.outputTokens)) });
    });
    if (this.platform) this.loadBusinesses();
    this.load();
  }

  protected loadBusinesses(): void {
    this.businessesLoading.set(true);
    this.businessError.set(false);
    this.management.businesses(1, '').pipe(
      expand(page => page.page * page.pageSize < page.total ? this.management.businesses(page.page + 1, '') : EMPTY),
      reduce((items, page) => items.concat(page.items), [] as Business[]),
      finalize(() => this.businessesLoading.set(false)), takeUntilDestroyed(this.destroy),
    ).subscribe({ next: rows => this.businesses.set(rows), error: () => this.businessError.set(true) });
  }

  protected load(): void {
    const range = this.form.getRawValue();
    if (!range.from || !range.to || range.from > range.to || Date.parse(range.to) - Date.parse(range.from) >= 366 * dayMs) {
      this.error.set('Select a date range of 1 to 366 days.');
      return;
    }
    this.requests.next(range);
  }
}
