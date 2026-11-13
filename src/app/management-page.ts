import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, EMPTY, finalize, Observable, Subject, switchMap } from 'rxjs';
import { Business, BusinessRole, ManagementService, Member, Page } from './management.service';

function passwordValidator(minimumLength: () => number): ValidatorFn {
  return control => {
    const password: string = control.value;
    if (!password.trim()) return { required: true };
    if (Array.from(password).length < minimumLength()) return { tooShort: true };
    return new TextEncoder().encode(password).length > 72 ? { tooManyBytes: true } : null;
  };
}

@Component({
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './management-page.html',
  styleUrl: './product-catalog.scss',
})
export class ManagementPage {
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly api = inject(ManagementService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly requests = new Subject<void>();

  protected readonly mode = this.route.snapshot.data['management'] as 'businesses' | 'administrators' | 'users' | 'tenant';
  protected readonly businessId = this.route.snapshot.paramMap.get('businessId');
  protected readonly title = {
    businesses: 'Businesses', administrators: 'Business Administrators', users: 'Users', tenant: 'Users',
  }[this.mode];
  protected readonly platform = this.mode !== 'tenant';
  protected readonly showBusinesses = this.mode === 'businesses' || (this.platform && !this.businessId);
  protected readonly business = signal<Business | null>(null);
  protected readonly result = signal<Page<Business | Member> | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly loadError = signal('');
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly page = signal(1);
  protected readonly search = this.fb.control('', Validators.maxLength(255));
  protected readonly editor = signal<'business' | 'user' | 'assign' | 'reset' | null>(null);
  protected readonly selected = signal<Business | Member | null>(null);
  protected readonly roles: BusinessRole[] = this.mode === 'administrators' ? ['owner', 'admin']
    : this.platform ? ['owner', 'admin', 'staff'] : ['admin', 'staff'];

  protected readonly form = this.fb.group({
    name: '',
    slug: '',
    email: '',
    role: this.fb.control<BusinessRole>(this.mode === 'administrators' ? 'admin' : 'staff'),
    isActive: true,
    accountActive: true,
    password: ['', passwordValidator(() => this.passwordMinimum())],
    onboarding: false,
    administratorName: '',
    administratorEmail: '',
    administratorPassword: ['', passwordValidator(() => 6)],
  });
  private term = '';

  constructor() {
    if (this.businessId) {
      this.api.business(this.businessId).pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: business => this.business.set(business),
        error: () => {},
      });
    }
    this.requests.pipe(switchMap(() => {
      this.loading.set(true);
      this.loadError.set('');
      const request: Observable<Page<Business | Member>> = this.showBusinesses
        ? this.api.businesses(this.page(), this.term)
        : this.api.users(this.businessId, this.page(), this.term, this.mode === 'administrators');
      return request.pipe(catchError(error => {
        this.loadError.set(this.errorText(error, 'Unable to load records.'));
        return EMPTY;
      }), finalize(() => this.loading.set(false)));
    }), takeUntilDestroyed(this.destroy)).subscribe(result => this.result.set(result));
    this.reload();
  }

  protected reload(): void { this.requests.next(); }

  protected searchList(): void {
    this.term = this.search.value.trim();
    this.turnPage(1);
  }

  protected turnPage(page: number): void {
    this.page.set(page);
    this.reload();
  }

  protected open(mode: NonNullable<ReturnType<ManagementPage['editor']>>, row?: Business | Member): void {
    this.selected.set(row ?? null);
    this.editor.set(mode);
    this.error.set('');
    this.message.set('');
    const member = row && 'role' in row ? row : null;
    this.form.reset({ name: row?.name ?? '', slug: row && 'slug' in row ? row.slug : '',
      email: member?.email ?? '', role: member?.role ?? (this.mode === 'administrators' ? 'admin' : 'staff'),
      isActive: row?.isActive ?? true, accountActive: member?.accountActive ?? true });
  }

  protected close(): void {
    this.form.reset();
    this.editor.set(null);
    this.error.set('');
  }

  protected passwordMinimum(): number {
    return this.editor() === 'reset' ? 12 : 6;
  }

  protected changeStatus(row: Business | Member, global = false): void {
    const member = 'role' in row;
    const active = member && global ? row.accountActive : row.isActive;
    if (!this.confirmStatus(active, row.name, global)) return;
    const request = member ? this.api.saveUser(this.businessId,
      global ? { accountActive: !active } : { isActive: !active }, row.id)
      : this.api.setBusinessStatus(row.id, !active);
    this.submit(request, 'Status updated.');
  }

  private confirmStatus(active: boolean, name: string, global = false): boolean {
    return !this.saving() && (!active || !!this.window?.confirm(global
      ? 'Deactivate ' + name + ' across all businesses?'
      : 'Deactivate ' + name + '?'));
  }

  protected save(): void {
    if (this.saving()) return;
    this.error.set('');
    const values = this.form.getRawValue();
    const id = this.selected()?.id;
    const mode = this.editor();
    if (!mode) return;
    const emailValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.trim().length <= 255;
    const accountValid = (name: string, email: string) => !!name.trim() && name.trim().length <= 150 && emailValid(email);

    let request: Observable<unknown>;
    if (mode === 'business') {
      if (!values.name.trim() || values.name.trim().length > 200 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug.trim())
          || values.slug.length > 120) {
        this.error.set('Enter a business name and a slug with lowercase letters, digits, and hyphens.');
        return;
      }
      const onboarding = !id && values.onboarding;
      if (onboarding) this.form.controls.administratorPassword.markAsTouched();
      if (onboarding && !accountValid(values.administratorName, values.administratorEmail)) {
        this.error.set('Enter the owner name and a valid email address.');
        return;
      }
      if (onboarding && this.form.controls.administratorPassword.invalid) return;
      request = this.api.saveBusiness({ name: values.name.trim(), slug: values.slug.trim(), isActive: values.isActive,
        ...(onboarding ? { administrator: { name: values.administratorName.trim(),
          email: values.administratorEmail.trim(), password: values.administratorPassword } } : {}) }, id);
    } else if (mode === 'assign' && this.businessId) {
      if (!emailValid(values.email)) { this.error.set('Enter an eligible user’s email.'); return; }
      request = this.api.assign(this.businessId, values.email.trim(), values.role);
    } else if (mode === 'reset' && this.businessId && id) {
      this.form.controls.password.markAsTouched();
      if (this.form.controls.password.invalid) return;
      request = this.api.reset(this.businessId, id, values.password);
    } else if (mode === 'user') {
      if (!id) this.form.controls.password.markAsTouched();
      if (!accountValid(values.name, values.email)) {
        this.error.set('Enter a name and a valid email address.');
        return;
      }
      if (!id && this.form.controls.password.invalid) return;
      const original = this.selected() as Member | null;
      request = this.api.saveUser(this.businessId, {
        ...(values.name.trim() !== original?.name ? { name: values.name.trim() } : {}),
        ...(values.email.trim() !== original?.email ? { email: values.email.trim() } : {}),
        role: values.role, ...(id ? { isActive: values.isActive,
          ...(this.platform ? { accountActive: values.accountActive } : {}) } : { password: values.password }),
      }, id);
    } else return;

    const row = this.selected();
    if (row && (mode === 'business' || mode === 'user')) {
      const global = 'accountActive' in row && this.platform && row.accountActive && !values.accountActive;
      if ((global || (row.isActive && !values.isActive)) && !this.confirmStatus(true, row.name, global)) return;
    }
    this.submit(request, mode === 'reset' ? 'Password reset. Existing sessions are revoked.' : 'Changes saved.');
  }

  private submit(request: Observable<unknown>, message: string): void {
    this.error.set('');
    this.message.set('');
    this.saving.set(true);
    this.form.disable();
    request.pipe(finalize(() => { this.form.enable(); this.saving.set(false); }),
      takeUntilDestroyed(this.destroy)).subscribe({
      next: () => {
        this.close();
        this.message.set(message);
        this.reload();
      },
      error: error => this.error.set(this.errorText(error, 'Unable to save changes.')),
    });
  }

  private errorText(error: unknown, fallback: string): string {
    return error instanceof HttpErrorResponse && [400, 403, 404, 409].includes(error.status)
      && typeof error.error?.error === 'string' ? error.error.error : fallback;
  }
}
