import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthApiError } from './auth.models';
import { AuthService } from './auth.service';
import { Workspace, workspaceFor } from './workspaces';

@Component({
  imports: [
    ReactiveFormsModule, MatButtonModule, MatCardModule,
    MatFormFieldModule, MatInputModule, RouterLink,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  protected readonly workspace: Workspace = this.route.snapshot.data['workspace'];
  protected readonly otherWorkspace: Workspace = this.route.snapshot.data['otherWorkspace'];
  protected readonly submitting = signal(false);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    password: ['', Validators.required],
  });

  protected get notice(): string {
    const notice = this.route.snapshot.queryParamMap.get('notice');
    if (notice === 'expired') return 'Your session ended. Sign in again to continue.';
    if (notice === 'unavailable') return 'The authentication service is unavailable. Try again shortly.';
    return '';
  }

  protected async submit(): Promise<void> {
    if (this.submitting()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.submitting.set(true);
    this.error.set('');
    try {
      const session = await firstValueFrom(this.auth.login(this.workspace.loginType, this.form.getRawValue()));
      await this.router.navigate(['/', workspaceFor(session.loginType).path, 'dashboard'], { replaceUrl: true });
    } catch (error) {
      const response = error instanceof HttpErrorResponse ? error : undefined;
      const apiError: AuthApiError | undefined = response?.error;
      const message = typeof apiError?.error === 'string' ? apiError.error : '';
      this.error.set(response?.status === 401 ? 'Invalid credentials or access unavailable.'
        : message || 'Unable to sign in. Try again shortly.');
    } finally {
      this.form.controls.password.reset();
      this.submitting.set(false);
    }
  }
}
