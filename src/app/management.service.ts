import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export type BusinessRole = 'owner' | 'admin' | 'staff';
export interface Business { id: string; name: string; slug: string; isActive: boolean }
export interface Member {
  id: string; name: string; email: string; role: BusinessRole; isActive: boolean; accountActive: boolean;
}
export interface Page<T> { items: T[]; page: number; pageSize: number; total: number }

@Injectable({ providedIn: 'root' })
export class ManagementService {
  private readonly http = inject(HttpClient);
  private readonly businessesUrl = '/api/platform/businesses';

  businesses(page: number, search: string) {
    return this.http.get<Page<Business>>(this.businessesUrl, { params: { page, search, pageSize: 20 } });
  }

  business(id: string) {
    return this.http.get<Business>(this.businessesUrl + '/' + id);
  }

  saveBusiness(input: Omit<Business, 'id'> & {
    administrator?: { name: string; email: string; password: string };
  }, id?: string) {
    return id ? this.http.put<Business>(this.businessesUrl + '/' + id, input)
      : this.http.post<Business>(this.businessesUrl, input);
  }

  users(business: string | null, page: number, search: string, administrators: boolean) {
    return this.http.get<Page<Member>>(this.usersUrl(business), {
      params: { page, search, administrators, pageSize: 20 },
    });
  }

  saveUser(business: string | null, input: Partial<Omit<Member, 'id'>> & { password?: string }, id?: string) {
    const url = this.usersUrl(business);
    return id ? this.http.put<Member>(url + '/' + id, input) : this.http.post<Member>(url, input);
  }

  assign(business: string, email: string, role: BusinessRole) {
    return this.http.post<Member>(this.usersUrl(business) + '/assign', { email, role });
  }

  reset(business: string, user: string, password: string) {
    return this.http.put<void>(this.usersUrl(business) + '/' + user + '/password', { password });
  }

  private usersUrl(business: string | null) {
    return business === null ? '/api/business/users' : this.businessesUrl + '/' + business + '/users';
  }
}
