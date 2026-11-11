import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { authInterceptor } from './auth.interceptor';
import { AuthSession } from './auth.models';
import { AuthService } from './auth.service';

const superSession: AuthSession = {
  user: { id: '1', name: 'Platform Admin', email: 'platform@example.test' },
  loginType: 'super-admin',
  business: null,
  csrfToken: 'super-token',
};

const businessSession: AuthSession = {
  user: { id: '2', name: 'Business Admin', email: 'business@example.test' },
  loginType: 'business',
  business: { id: '9', name: 'Test Business', slug: 'test-business', role: 'owner' },
  csrfToken: 'business-token',
};

describe('CMS authentication', () => {
  let http: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => http.verify());

  async function restore(session: AuthSession | null): Promise<void> {
    const pending = firstValueFrom(auth.restore());
    const request = http.expectOne('/api/auth/me');
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.headers.has('X-CSRF-Token')).toBeFalse();
    if (session) {
      request.flush(session);
    } else {
      request.flush({ error: 'Sign-in required.' }, { status: 401, statusText: 'Unauthorized' });
    }
    await pending;
  }

  it('sends anonymous visitors to the appropriate sign-in page without a preview link', async () => {
    await restore(null);
    const harness = await RouterTestingHarness.create('/');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent)
      .toContain('Business Admin sign in');

    await harness.navigateByUrl('/super-admin/businesses');
    expect(router.url).toBe('/super-admin/login');
    expect(harness.routeNativeElement?.textContent).not.toContain('Preview workspace');

    await harness.navigateByUrl('/business-admin/products');
    expect(router.url).toBe('/business-admin/login');
  });

  for (const [path, session, sections] of [
    ['super-admin', superSession, ['businesses', 'users']],
    ['business-admin', businessSession, ['products', 'inventory', 'conversations', 'orders', 'ai-settings']],
  ] as const) {
    it(`restores the ${path} workspace and shows its feature routes`, async () => {
      await restore(session);
      const harness = await RouterTestingHarness.create(`/${path}/dashboard`);
      const links = Array.from(
        harness.routeNativeElement!.querySelectorAll('main nav a'),
        (link) => link.getAttribute('href'),
      );
      expect(links).toEqual(sections.map((section) => `/${path}/${section}`));

      for (const section of sections) {
        await harness.navigateByUrl(`/${path}/${section}`);
        expect(harness.routeNativeElement?.querySelector('main h2')?.textContent)
          .toContain('Awaiting API integration');
      }
    });

    it(`submits the ${path} login form to its endpoint and opens its dashboard`, async () => {
      await restore(null);
      const harness = await RouterTestingHarness.create(`/${path}/login`);
      const element = harness.routeNativeElement!;
      const setInput = (selector: string, value: string) => {
        const input = element.querySelector<HTMLInputElement>(selector)!;
        input.value = value;
        input.dispatchEvent(new Event('input'));
      };
      setInput('[type=email]', session.user.email);
      setInput('[type=password]', 'test password');
      element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));

      const request = http.expectOne(`/api/auth/${session.loginType}/login`);
      expect(request.request.method).toBe('POST');
      expect(request.request.withCredentials).toBeTrue();
      expect(request.request.headers.has('X-CSRF-Token')).toBeFalse();
      expect(request.request.body).toEqual({ email: session.user.email, password: 'test password' });
      request.flush(session);

      await harness.fixture.whenStable();
      expect(router.url).toBe(`/${path}/dashboard`);
    });
  }

  it('redirects a business user away from Super Admin routes', async () => {
    await restore(businessSession);
    const harness = await RouterTestingHarness.create('/super-admin/users');
    expect(router.url).toBe('/business-admin/dashboard?notice=forbidden');
    expect(harness.routeNativeElement?.querySelector('[role=alert]')?.textContent)
      .toContain('permission');
  });

  it('sends the CSRF token on authenticated writes, including sign-out', async () => {
    await restore(businessSession);
    const harness = await RouterTestingHarness.create('/business-admin/dashboard');
    const client = TestBed.inject(HttpClient);

    const write = firstValueFrom(client.patch('/api/products/1', {}));
    const apiRequest = http.expectOne('/api/products/1');
    expect(apiRequest.request.withCredentials).toBeTrue();
    expect(apiRequest.request.headers.get('X-CSRF-Token')).toBe(businessSession.csrfToken);
    apiRequest.flush({});
    await write;

    const external = firstValueFrom(client.post('https://example.test/api/products', {}));
    const externalRequest = http.expectOne('https://example.test/api/products');
    expect(externalRequest.request.withCredentials).toBeFalse();
    expect(externalRequest.request.headers.has('X-CSRF-Token')).toBeFalse();
    externalRequest.flush({});
    await external;

    harness.routeNativeElement!.querySelector<HTMLButtonElement>('.sign-out')!.click();
    const logout = http.expectOne('/api/auth/logout');
    expect(logout.request.method).toBe('POST');
    expect(logout.request.withCredentials).toBeTrue();
    expect(logout.request.headers.get('X-CSRF-Token')).toBe(businessSession.csrfToken);
    logout.flush(null, { status: 204, statusText: 'No Content' });

    await harness.fixture.whenStable();
    expect(auth.session()).toBeNull();
    expect(router.url).toBe('/business-admin/login');
  });

  it('keeps the session on 403 and returns to sign-in when a protected API returns 401', async () => {
    await restore(businessSession);
    const harness = await RouterTestingHarness.create('/business-admin/dashboard');
    const client = TestBed.inject(HttpClient);

    for (const [status, statusText] of [[403, 'Forbidden'], [401, 'Unauthorized']] as const) {
      const result = firstValueFrom(client.get('/api/products')).catch((error) => error.status);
      http.expectOne('/api/products').flush({ error: statusText }, { status, statusText });
      expect(await result).toBe(status);

      if (status === 403) {
        expect(auth.session()).toEqual(businessSession);
        expect(auth.forbidden()).toBeTrue();
      }
    }

    await harness.fixture.whenStable();
    expect(auth.session()).toBeNull();
    expect(router.url).toBe('/business-admin/login?notice=expired');
  });
});
