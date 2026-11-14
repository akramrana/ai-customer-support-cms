export type LoginType = 'super-admin' | 'business';

export interface Credentials {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthBusiness {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'admin' | 'staff';
}

export function canManageBusinessOperations(role: AuthBusiness['role'] | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

interface SessionDetails {
  user: AuthUser;
  csrfToken: string;
}

export type AuthSession = SessionDetails & (
  | { loginType: 'super-admin'; business: null }
  | { loginType: 'business'; business: AuthBusiness }
);

export interface AuthApiError {
  error: string;
}
