import { LoginType } from './auth.models';

export interface Section {
  path: string;
  label: string;
  description: string;
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
    { path: 'users', label: 'Users', description: 'Manage business administrators and assignments.' },
  ],
};

export const businessAdmin: Workspace = {
  path: 'business-admin',
  loginType: 'business',
  label: 'Business Admin',
  description: 'Manage Messenger support and commerce for your business.',
  sections: [
    { path: 'products', label: 'Products', description: 'Manage your product catalog and variants.' },
    { path: 'inventory', label: 'Inventory', description: 'Review stock levels and inventory movements.' },
    { path: 'conversations', label: 'Conversations', description: 'Review Messenger threads and support handoffs.' },
    { path: 'orders', label: 'Orders', description: 'Track customer orders and fulfillment.' },
    { path: 'ai-settings', label: 'AI Settings', description: 'Configure AI reply modes and schedules.' },
  ],
};

export function workspaceFor(type: LoginType): Workspace {
  return type === 'super-admin' ? superAdmin : businessAdmin;
}
