import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from './auth.service';

@Component({
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './my-account.html',
  styles: [`
    .account-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; align-items: start; }
    form { display: grid; gap: .45rem; }
    form > button { justify-self: start; }
    @media (max-width: 950px) { .account-grid { grid-template-columns: minmax(0, 1fr); } }
  `],
})
export class MyAccountPage {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly profile = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(150), Validators.pattern(/\S/)]],
    email: ['', [Validators.required, Validators.email, Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/), Validators.maxLength(255)]],
  });
  protected readonly passwords = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, (control: AbstractControl<string>) => Array.from(String(control.value)).length >= 12
      && new TextEncoder().encode(control.value).length <= 72 && String(control.value).trim() ? null : { length: true }]],
    confirmPassword: ['', Validators.required],
  });
  protected readonly passwordFields = [
    { key: 'currentPassword', title: 'Current password', autocomplete: 'current-password' },
    { key: 'newPassword', title: 'New password', autocomplete: 'new-password' },
    { key: 'confirmPassword', title: 'Confirm new password', autocomplete: 'new-password' },
  ] as const;
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  protected readonly savingProfile = signal(false);
  protected readonly savingPassword = signal(false);
  protected readonly showPasswords = signal(false);
  protected readonly profileError = signal('');
  protected readonly passwordError = signal('');
  protected readonly profileSuccess = signal(false);
  protected readonly passwordSuccess = signal(false);

  constructor() { this.load(); }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.auth.loadAccount().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ user }) => {
        this.profile.reset({ name: user.name, email: user.email });
        this.loading.set(false);
      },
      error: () => { this.loadError.set('Could not load your account.'); this.loading.set(false); },
    });
  }

  protected saveProfile(): void {
    if (this.savingProfile() || this.savingPassword()) return;
    this.profile.markAllAsTouched();
    const { name, email } = this.profile.getRawValue();
    this.profile.patchValue({ name: name.trim(), email: email.trim() });
    if (this.profile.invalid) return;
    this.savingProfile.set(true);
    this.profileError.set('');
    this.profileSuccess.set(false);
    this.auth.updateProfile(this.profile.getRawValue()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (user) => {
        this.profile.reset({ name: user.name, email: user.email });
        this.profileSuccess.set(true);
        this.savingProfile.set(false);
      },
      error: (error) => {
        this.profileError.set(error.error?.error || 'Could not save your profile.');
        this.savingProfile.set(false);
      },
    });
  }

  protected updatePassword(): void {
    if (this.savingProfile() || this.savingPassword()) return;
    this.passwords.markAllAsTouched();
    this.passwordError.set('');
    this.passwordSuccess.set(false);
    const values = this.passwords.getRawValue();
    if (this.passwords.invalid || values.newPassword !== values.confirmPassword) return;
    this.savingPassword.set(true);
    this.auth.changePassword(values).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.passwords.reset();
        this.showPasswords.set(false);
        this.passwordSuccess.set(true);
        this.savingPassword.set(false);
      },
      error: (error) => {
        this.passwordError.set(error.error?.error || 'Could not update your password.');
        this.savingPassword.set(false);
      },
    });
  }
}
