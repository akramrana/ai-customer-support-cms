import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

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
  protected readonly workspace: Workspace = inject(ActivatedRoute).snapshot.data['workspace'];
  protected readonly compact = toSignal(
    inject(BreakpointObserver).observe('(max-width: 760px)').pipe(map((result) => result.matches)),
    { requireSync: true },
  );
}
