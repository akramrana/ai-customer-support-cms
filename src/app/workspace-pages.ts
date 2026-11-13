import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { BusinessFacebookPages } from './business-facebook-pages';
import { AuthService } from './auth.service';
import { Section, Workspace } from './workspaces';

@Component({
  imports: [MatCardModule, RouterLink, BusinessFacebookPages],
  template: `
    <header class="page-heading">
      <h1>Dashboard</h1>
      <p>{{ workspace.description }}</p>
    </header>
    @if (workspace.loginType === 'business') { <app-business-facebook-pages /> }
    <nav class="section-grid" aria-label="Workspace sections">
      @for (section of workspace.sections; track section.path) {
        @if (!section.hidden && (!section.ownerOnly || auth.session()?.business?.role === 'owner')) {
          <a class="section-link" [routerLink]="['..', section.path]">
            <mat-card appearance="outlined">
              <mat-card-content>
                <h2>{{ section.label }} <span aria-hidden="true">↗</span></h2>
                <p>{{ section.description }}</p>
              </mat-card-content>
            </mat-card>
          </a>
        }
      }
    </nav>
  `,
  styles: `
    .section-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
      gap: 16px;
    }
    .section-link { color: inherit; text-decoration: none; border-radius: 12px; }
    mat-card { height: 100%; }
    .section-link:hover mat-card { border-color: var(--accent); }
    mat-card-content { padding: 20px; }
    h2 { display: flex; justify-content: space-between; gap: 8px; font-size: 1.125rem; margin: 0; }
    h2 span { color: var(--accent); }
    p { margin-bottom: 0; }
  `,
})
export class DashboardPage {
  protected readonly auth = inject(AuthService);
  protected readonly workspace: Workspace = inject(ActivatedRoute).snapshot.data['workspace'];
}

@Component({
  imports: [MatCardModule],
  template: `
    <header class="page-heading">
      <h1>{{ section.label }}</h1>
      <p>{{ section.description }}</p>
    </header>
    <mat-card appearance="outlined">
      <mat-card-content>
        <h2>Awaiting API integration</h2>
        <p>This section will be available once its admin API is connected.</p>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    mat-card-content { padding: clamp(20px, 4vw, 40px); }
    h2 { margin: 0; font-size: 1.125rem; }
    p { margin-bottom: 0; }
  `,
})
export class FeaturePage {
  protected readonly section: Section = inject(ActivatedRoute).snapshot.data['section'];
}
