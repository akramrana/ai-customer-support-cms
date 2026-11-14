import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

interface EmailSettings {
  enabled: boolean;
  keyConfigured: boolean;
  senderEmail: string;
  senderName: string;
  recipientEmail: string;
}

@Component({
  selector: 'app-order-email-settings',
  imports: [DatePipe, MatProgressSpinnerModule, ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSlideToggleModule],
  templateUrl: './order-email-settings.html',
  styles: [`
    :host { display: block; margin-block: 1rem; }
    mat-card-content { padding: clamp(1rem, 3vw, 1.5rem); }
    .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr)); gap: .5rem 1rem; }
    .actions { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; }
    .test-label { display: inline-flex; gap: .5rem; align-items: center; }
  `],
})
export class OrderEmailSettings {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly url = '/api/business/email-notifications';
  protected readonly settings = signal<EmailSettings | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal(false);
  protected readonly testing = signal(false);
  protected readonly testResult = signal<{ acceptedAt: string; messageId?: string } | null>(null);
  protected readonly testError = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    enabled: false,
    senderEmail: ['', [Validators.email, Validators.maxLength(254)]],
    senderName: ['', Validators.maxLength(100)],
    recipientEmail: ['', [Validators.email, Validators.maxLength(254)]],
    apiKey: ['', Validators.pattern(/^re_[a-zA-Z0-9_-]{1,252}$/)],
    clearKey: false,
  });

  constructor() { this.load(); }

  protected load(): void {
    this.busy.set(true);
    this.error.set('');
    this.http.get<EmailSettings>(this.url).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: settings => this.show(settings),
      error: () => { this.error.set('Could not load email settings.'); this.busy.set(false); },
    });
  }

  protected save(): void {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    const { apiKey, clearKey, senderEmail, recipientEmail, senderName, enabled } = this.form.getRawValue();
    if (this.form.invalid || (clearKey && apiKey) || (enabled && (!senderEmail || !recipientEmail))) {
      this.error.set('Check sender and recipient details. Choose either to replace or clear the key.');
      return;
    }
    this.error.set('');
    this.success.set(false);
    this.busy.set(true);
    this.form.disable();
    this.http.put<EmailSettings>(this.url, {
      enabled, senderEmail: senderEmail.trim(), senderName: senderName.trim(), recipientEmail: recipientEmail.trim(),
      ...(clearKey ? { apiKey: null } : apiKey ? { apiKey } : {}),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: settings => { this.show(settings); this.success.set(true); },
      error: error => {
        this.error.set(error.error?.error || 'Could not save email settings.');
        this.form.enable();
        this.busy.set(false);
      },
    });
  }

  protected testUnavailable(): string {
    const saved = this.settings();
    const form = this.form.getRawValue();
    if (!saved) return 'Load your email settings first.';
    if (form.apiKey || form.clearKey || form.enabled !== saved.enabled || form.senderName !== saved.senderName
      || form.senderEmail !== saved.senderEmail || form.recipientEmail !== saved.recipientEmail) {
      return 'Save your changes before sending a test email.';
    }
    if (!saved.keyConfigured) return 'Save a Resend API key before sending a test email.';
    if (!saved.senderEmail || !saved.recipientEmail) return 'Save a sender and recipient address before sending a test email.';
    return '';
  }

  protected sendTest(): void {
    if (this.testing() || this.busy() || this.testUnavailable()) return;
    this.testing.set(true);
    this.testError.set('');
    this.testResult.set(null);
    this.http.post<{ acceptedAt: string; messageId?: string }>(this.url + '/test', null)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: result => { this.testResult.set(result); this.testing.set(false); },
        error: error => {
          this.testError.set(error.error?.error || 'Could not confirm acceptance. Try again later.');
          this.testing.set(false);
        },
      });
  }

  private show(settings: EmailSettings): void {
    this.settings.set(settings);
    this.form.reset({ ...settings, apiKey: '', clearKey: false });
    this.form.enable();
    this.busy.set(false);
  }
}
