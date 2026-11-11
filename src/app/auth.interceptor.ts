import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';
import { workspaceFor } from './workspaces';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const document = inject(DOCUMENT);
  const url = new URL(request.url, document.baseURI);
  if (url.origin !== document.location.origin || !url.pathname.startsWith('/api/')) {
    return next(request);
  }

  const auth = inject(AuthService);
  const router = inject(Router);
  const session = auth.session();
  const login = /^\/api\/auth\/(super-admin|business)\/login\/?$/.test(url.pathname);
  const readOnly = ['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase());
  const headers = session && !readOnly && !login
    ? request.headers.set('X-CSRF-Token', session.csrfToken)
    : request.headers;

  return next(request.clone({ withCredentials: true, headers })).pipe(
    catchError((error: HttpErrorResponse) => {
      // Auth endpoints handle their own errors. Ignore responses from a replaced session.
      if (!url.pathname.startsWith('/api/auth/') && session && auth.session() === session) {
        if (error.status === 401) {
          auth.clearSession();
          void router.navigate(['/', workspaceFor(session.loginType).path, 'login'], {
            queryParams: { notice: 'expired' },
            replaceUrl: true,
          });
        } else if (error.status === 403) {
          auth.setForbidden(true);
        }
      }
      return throwError(() => error);
    }),
  );
};
