import { canManageBusinessOperations } from './auth.models';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';

import { AuthService } from './auth.service';

import { Workspace } from './workspaces';

@Component({
  selector: 'app-workspace-layout',
  imports: [
    MatButtonModule, MatListModule, MatSidenavModule, MatToolbarModule,
    RouterLink, RouterLinkActive, RouterOutlet,
  ],
  templateUrl: './workspace-layout.html',
  styleUrl: './workspace-layout.scss',
})
export class WorkspaceLayout {
  protected readonly canManageOperations = canManageBusinessOperations;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly workspace: Workspace = this.route.snapshot.data['workspace'];
  protected readonly signingOut = signal(false);
  protected readonly signOutError = signal(false);
  protected readonly deniedRoute = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('notice') === 'forbidden')),
    { initialValue: false },
  );

  protected dismissAccessError(): void {
    this.auth.setForbidden(false);
    if (this.deniedRoute()) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { notice: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  protected async signOut(): Promise<void> {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    this.signOutError.set(false);
    try {
      await firstValueFrom(this.auth.logout());
      await this.router.navigate(['/', this.workspace.path, 'login'], { replaceUrl: true });
    } catch {
      this.signOutError.set(true);
    } finally {
      this.signingOut.set(false);
    }
  }

  protected readonly compact = toSignal(
    inject(BreakpointObserver).observe('(max-width: 760px)').pipe(map((result) => result.matches)),
    { requireSync: true },
  );
}
