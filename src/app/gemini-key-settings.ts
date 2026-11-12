import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { finalize, Observable } from 'rxjs';

type KeyStatus = { configured: boolean };

@Component({
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  templateUrl: './gemini-key-settings.html',
})
export class GeminiKeySettingsPage {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly url = '/api/business/gemini-key';
  protected readonly configured = signal<boolean | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly key = new FormControl('', { nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^[A-Za-z0-9_-]{20,200}$/)] });

  protected readonly form = new FormGroup({ key: this.key });

  constructor() { this.refresh(); }

  protected refresh(): void {
    this.run(this.http.get<KeyStatus>(this.url));
  }

  protected save(): void {
    if (this.key.invalid || this.busy()) return;
    const apiKey = this.key.value;
    this.key.reset();
    this.run(this.http.put<KeyStatus>(this.url, { apiKey }), 'Gemini API key saved.');
  }

  protected remove(): void {
    if (this.busy() || !this.window?.confirm('Remove this business’s Gemini API key?')) return;
    this.key.reset();
    this.run(this.http.delete<KeyStatus>(this.url), 'Gemini API key removed.');
  }

  private run(request: Observable<KeyStatus>, message = ''): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    request.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({
      next: ({ configured }) => { this.configured.set(configured); this.success.set(message); },
      error: () => this.error.set('Could not complete the Gemini key request. Try again.'),
    });
  }
}
