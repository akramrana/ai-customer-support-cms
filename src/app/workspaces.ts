import { LoginType } from './auth.models';

export interface Section {
  path: string;
  label: string;
  description: string;
  hidden?: boolean;
  ownerOnly?: boolean;
}

export interface Workspace {
  path: string;
  loginType: LoginType;
  label: string;
  description: string;
  sections: readonly Section[];
}

export const superAdmin: Workspace = {
  path: 'super-admin',
  loginType: 'super-admin',
  label: 'Super Admin',
  description: 'Manage businesses and administrator access across the platform.',
  sections: [
    { path: 'businesses', label: 'Businesses', description: 'Manage business profiles and status.' },
    { path: 'ai-usage', label: 'AI Usage', description: 'Review provider calls, tokens, and errors across businesses.' },
    { path: 'facebook-pages', label: 'Facebook Pages', description: 'View connected Pages and manage Messenger automation.' },
    { path: 'administrators', label: 'Business Administrators', description: 'Manage business owners and administrators.' },
    { path: 'users', label: 'Users', description: 'Manage business user accounts and assignments.' },
  ],
};

export const businessAdmin: Workspace = {
  path: 'business-admin',
  loginType: 'business',
  label: 'Business Admin',
  description: 'Manage Messenger support and commerce for your business.',
  sections: [
    { path: 'products', label: 'Products', description: 'Manage your product catalog and variants.' },
    { path: 'brands', label: 'Brands', description: 'Manage product brands.' },
    { path: 'categories', label: 'Categories', description: 'Manage product categories.' },
    { path: 'inventory', label: 'Inventory', hidden: true, description: 'Review stock levels and inventory movements.' },
    { path: 'conversations', label: 'Conversations', description: 'Review Messenger threads and support handoffs.' },
    { path: 'users', label: 'Users', description: 'Manage users in your business.', ownerOnly: true },
    { path: 'orders', label: 'Orders', description: 'Track customer orders and fulfillment.' },
    { path: 'ai-usage', label: 'AI Usage', description: 'Review provider calls, tokens, and errors for your business.' },
    { path: 'ai-settings', label: 'AI Settings', description: 'Configure AI reply modes and schedules.' },
  ],
};

export function workspaceFor(type: LoginType): Workspace {
  return type === 'super-admin' ? superAdmin : businessAdmin;
}
