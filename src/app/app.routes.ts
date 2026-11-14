import { Route, Routes } from '@angular/router';

import { redirectSignedIn, requireBusinessOperations, requireBusinessOwner, requireWorkspace } from './auth.guards';
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
      ...(workspace.loginType === 'super-admin' ? [
        { path: 'business-administrators', pathMatch: 'full' as const, redirectTo: 'administrators' },
        { path: 'business-administrators/:businessId', redirectTo: 'administrators/:businessId' },
      ] : []),
      ...(workspace.loginType === 'business' ? [{
        path: 'facebook-pages', title: 'Facebook Pages | Messenger Support',
        loadComponent: () => import('./business-facebook-pages').then(module => module.BusinessFacebookPagesSetup),
      }] : []),
      ...workspace.sections.map((section): Route => {
        if (section.path === 'ai-usage') {
          return { path: section.path, title: 'AI Usage | Messenger Support',
            data: { platform: workspace.loginType === 'super-admin' },
            loadComponent: () => import('./ai-usage').then(module => module.AiUsagePage) };
        }
        if (workspace.loginType === 'super-admin' && section.path === 'facebook-pages') {
          return { path: section.path, title: 'Facebook Pages | Messenger Support',
            loadComponent: () => import('./facebook-pages').then(module => module.FacebookPages) };
        }
        if (['businesses', 'administrators', 'users'].includes(section.path)) {
          const page = {
            title: section.label + ' | Messenger Support',
            data: { management: workspace.loginType === 'business' ? 'tenant' : section.path },
            loadComponent: () => import('./management-page').then(module => module.ManagementPage),
          };
          if (section.path === 'businesses') {
            return { path: 'businesses', children: [{ path: '', pathMatch: 'full', ...page }, {
              path: ':businessId', title: 'Business Details | Messenger Support',
              loadComponent: () => import('./business-detail').then(module => module.BusinessDetail),
            }] };
          }
          return workspace.loginType === 'super-admin'
            ? { path: section.path, children: [{ path: '', ...page }, { path: ':businessId', ...page }] }
            : { path: section.path, ...page, ...(section.ownerOnly ? { canActivate: [requireBusinessOwner] } : {}) };
        }
        if (workspace.loginType === 'business' && ['brands', 'categories'].includes(section.path)) {
          return {
            path: section.path,
            title: `${section.label} | Messenger Support`,
            data: { kind: section.path },
            loadComponent: () => import('./catalog-taxonomy').then(module => module.CatalogTaxonomyPage),
          };
        }
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
        if (workspace.loginType === 'business' && section.path === 'inventory') {
          return { path: section.path, title: 'Inventory | Messenger Support',
            loadComponent: () => import('./inventory').then(module => module.InventoryManagementPage) };
        }
        if (workspace.loginType === 'business' && section.path === 'create-order') {
          return { path: section.path, title: 'Create Order | Messenger Support', canActivate: [requireBusinessOperations],
            loadComponent: () => import('./manual-order').then(module => module.ManualOrderPage) };
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
