import { Route, Routes } from '@angular/router';

import { redirectSignedIn, requireWorkspace } from './auth.guards';
import { businessAdmin, superAdmin, Workspace } from './workspaces';

function workspaceRoutes(workspace: Workspace, otherWorkspace: Workspace): Routes {
  const guard = requireWorkspace(workspace.loginType);
  const layout: Route = {
    path: workspace.path,
    canActivate: [guard],
    canActivateChild: [guard],
    data: { workspace },
    loadComponent: () => import('./workspace-layout').then((module) => module.WorkspaceLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: `${workspace.label} Dashboard | Messenger Support`,
        data: { workspace },
        loadComponent: () => import('./workspace-pages').then((module) => module.DashboardPage),
      },
      ...workspace.sections.map((section) => ({
        path: section.path,
        title: `${section.label} | Messenger Support`,
        data: { section },
        loadComponent: workspace.loginType === 'business' && section.path === 'ai-settings'
          ? () => import('./business-ai-settings').then((module) => module.BusinessAiSettingsPage)
          : () => import('./workspace-pages').then((module) => module.FeaturePage),
      })),
    ],
  };

  return [
    {
      path: `${workspace.path}/login`,
      canActivate: [redirectSignedIn],
      title: `${workspace.label} Sign In | Messenger Support`,
      data: { workspace, otherWorkspace },
      loadComponent: () => import('./login').then((module) => module.LoginPage),
    },
    layout,
  ];
}

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'business-admin/login' },
  ...workspaceRoutes(superAdmin, businessAdmin),
  ...workspaceRoutes(businessAdmin, superAdmin),
  { path: '**', redirectTo: 'business-admin/login' },
];
