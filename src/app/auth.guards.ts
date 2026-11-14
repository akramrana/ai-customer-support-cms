import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthService } from './auth.service';
import { canManageBusinessOperations, LoginType } from './auth.models';
import { workspaceFor } from './workspaces';

export function requireWorkspace(type: LoginType): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const loginPath = ['/', workspaceFor(type).path, 'login'];

    return auth.restore().pipe(
      map((session) => {
        if (!session) return router.createUrlTree(loginPath);
        if (session.loginType === type) return true;

        return router.createUrlTree(['/', workspaceFor(session.loginType).path, 'dashboard'], {
          queryParams: { notice: 'forbidden' },
        });
      }),
      catchError(() => of(router.createUrlTree(loginPath, {
        queryParams: { notice: 'unavailable' },
      }))),
    );
  };
}

export const requireBusinessOwner: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.session()?.business?.role === 'owner' || router.createUrlTree(['/business-admin/dashboard'], {
    queryParams: { notice: 'forbidden' },
  });
};

export const requireBusinessOperations: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return canManageBusinessOperations(auth.session()?.business?.role) || router.createUrlTree(['/business-admin/dashboard'], {
    queryParams: { notice: 'forbidden' },
  });
};

export const redirectSignedIn: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.restore().pipe(
    map((session) => session
      ? router.createUrlTree(['/', workspaceFor(session.loginType).path, 'dashboard'])
      : true),
    catchError(() => of(true)),
  );
};
