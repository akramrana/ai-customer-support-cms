import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, Observable, of, shareReplay, tap, throwError } from 'rxjs';

import { AuthSession, Credentials, LoginType } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly currentSession = signal<AuthSession | null>(null);
  private readonly accessError = signal(false);
  private restored = false;
  private restoration?: Observable<AuthSession | null>;

  readonly session = this.currentSession.asReadonly();
  readonly forbidden = this.accessError.asReadonly();

  restore(): Observable<AuthSession | null> {
    if (this.restored) return of(this.session());

    return this.restoration ??= this.http.get<AuthSession>('/api/auth/me').pipe(
      catchError((error: HttpErrorResponse) => error.status === 401 ? of(null) : throwError(() => error)),
      tap((session) => this.setSession(session)),
      finalize(() => { this.restoration = undefined; }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }

  login(type: LoginType, credentials: Credentials): Observable<AuthSession> {
    return this.http.post<AuthSession>(`/api/auth/${type}/login`, credentials).pipe(
      tap((session) => this.setSession(session)),
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout', null).pipe(
      catchError((error: HttpErrorResponse) => error.status === 401
        ? of(undefined)
        : throwError(() => error)),
      tap(() => this.setSession(null)),
    );
  }

  clearSession(): void {
    this.setSession(null);
  }

  setForbidden(value: boolean): void {
    this.accessError.set(value);
  }

  private setSession(session: AuthSession | null): void {
    this.restored = true;
    this.accessError.set(false);
    this.currentSession.set(session);
  }
}
