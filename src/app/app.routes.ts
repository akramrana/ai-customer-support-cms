import { Route, Routes } from '@angular/router';

import { businessAdmin, superAdmin, Workspace } from './workspaces';

function workspaceRoutes(workspace: Workspace, otherWorkspace: Workspace): Routes {
  const preview: Route = {
    path: workspace.path,
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
        loadComponent: () => import('./workspace-pages').then((module) => module.FeaturePage),
      })),
    ],
  };

  return [
    {
      path: `${workspace.path}/login`,
      title: `${workspace.label} Sign In | Messenger Support`,
      data: { workspace, otherWorkspace },
      loadComponent: () => import('./login').then((module) => module.LoginPage),
    },
    preview,
  ];
}

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'business-admin/login' },
  ...workspaceRoutes(superAdmin, businessAdmin),
  ...workspaceRoutes(businessAdmin, superAdmin),
  { path: '**', redirectTo: 'business-admin/login' },
];
