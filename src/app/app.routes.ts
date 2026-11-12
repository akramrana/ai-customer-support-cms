import { Route, Routes } from '@angular/router';

import { redirectSignedIn, requireWorkspace } from './auth.guards';
import { businessAdmin, superAdmin, Workspace } from './workspaces';

const productEditor: Route = {
  title: 'Product Editor | Messenger Support',
  loadComponent: () => import('./product-editor').then((module) => module.ProductEditorPage),
  canDeactivate: [(editor: { canLeave(): boolean }) => editor.canLeave()],
};

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
      ...workspace.sections.map((section): Route => {
        if (workspace.loginType === 'business' && section.path === 'products') {
          return {
            path: 'products',
            children: [
              {
                path: '',
                pathMatch: 'full',
                title: 'Products | Messenger Support',
                loadComponent: () => import('./product-list').then((module) => module.ProductListPage),
              },
              { ...productEditor, path: 'new' },
              { ...productEditor, path: ':id/edit' },
            ],
          };
        }
        if (workspace.loginType === 'business' && section.path === 'ai-settings') {
          return { path: 'ai-settings', children: [
            { path: '', pathMatch: 'full', title: 'AI Settings | Messenger Support',
              loadComponent: () => import('./business-ai-settings').then(module => module.BusinessAiSettingsPage) },
            { path: 'gemini-key', title: 'Gemini API Key | Messenger Support',
              loadComponent: () => import('./gemini-key-settings').then(module => module.GeminiKeySettingsPage) },
          ] };
        }
        if (workspace.loginType === 'business' && section.path === 'orders') {
          return { path: 'orders', children: [
            { path: '', pathMatch: 'full', title: 'Orders | Messenger Support',
              loadComponent: () => import('./order-list').then((module) => module.OrderListPage) },
            { path: ':id', title: 'Order Details | Messenger Support',
              loadComponent: () => import('./order-detail').then((module) => module.OrderDetailPage) },
          ] };
        }
        if (workspace.loginType === 'business' && section.path === 'conversations') {
          return {
            path: section.path,
            title: 'Conversations | Messenger Support',
            loadComponent: () => import('./conversation-viewer').then((module) => module.ConversationViewerPage),
          };
        }
        return {
          path: section.path,
          title: `${section.label} | Messenger Support`,
          data: { section },
          loadComponent: () => import('./workspace-pages').then((module) => module.FeaturePage),
        };
      }),
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
