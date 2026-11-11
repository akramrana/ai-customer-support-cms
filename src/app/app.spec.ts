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

      for (const section of sections.filter((name) => name !== 'ai-settings')) {
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

  it('loads both AI resources and saves mode changes without writing or clearing schedules', async () => {
    await restore(businessSession);
    const harness = await RouterTestingHarness.create('/business-admin/ai-settings');
    const page = harness.routeNativeElement!;
    expect(page.textContent).toContain('Loading AI settings');
    http.expectOne('/api/business/settings').flush({ aiMode: 'scheduled', timezone: 'Asia/Dhaka' });
    const schedules = http.expectOne('/api/business/ai-schedules');
    expect(schedules.request.withCredentials).toBeTrue();
    schedules.flush({
      schedules: [{ weekday: 2, startTime: '17:00:00', endTime: '09:00:15', isActive: true }],
    });
    harness.detectChanges();
    expect(page.textContent).toContain('Ends Wednesday.');
    expect(page.querySelector('select')?.value).toBe('Asia/Dhaka');

    const chooseMode = (label: string) => {
      const option = Array.from(page.querySelectorAll('mat-radio-button'))
        .find((button) => button.textContent?.trim() === label)!;
      option.querySelector('input')!.click();
      harness.detectChanges();
    };

    chooseMode('OFF');
    expect(page.textContent).not.toContain('Weekly schedule');
    const settingsForm = page.querySelector('form')!;
    settingsForm.dispatchEvent(new Event('submit', { cancelable: true }));
    settingsForm.dispatchEvent(new Event('submit', { cancelable: true }));
    const save = http.expectOne({ method: 'PUT', url: '/api/business/settings' });
    expect(save.request.headers.get('X-CSRF-Token')).toBe(businessSession.csrfToken);
    expect(save.request.body).toEqual({ aiMode: 'off', timezone: 'Asia/Dhaka' });
    http.expectNone({ method: 'PUT', url: '/api/business/ai-schedules' });
    save.flush(save.request.body);
    harness.detectChanges();
    expect(page.textContent).toContain('AI settings saved.');

    chooseMode('SCHEDULED');
    expect(page.querySelector<HTMLInputElement>('[formControlName=endTime]')?.value).toBe('09:00:15');
  });

  it('validates intervals and keeps the schedule draft after a separate save fails', async () => {
    await restore(businessSession);
    const harness = await RouterTestingHarness.create('/business-admin/ai-settings');
    const page = harness.routeNativeElement!;
    http.expectOne('/api/business/settings').flush({ aiMode: 'scheduled', timezone: 'UTC' });
    http.expectOne('/api/business/ai-schedules').flush({ schedules: [] });
    harness.detectChanges();

    const forms = page.querySelectorAll('form');
    const submit = (form: HTMLFormElement) =>
      form.dispatchEvent(new Event('submit', { cancelable: true }));
    submit(forms[0]);
    http.expectOne({ method: 'PUT', url: '/api/business/settings' })
      .flush({ aiMode: 'scheduled', timezone: 'UTC' });

    const add = page.querySelector<HTMLButtonElement>('[aria-label="Add interval for Tuesday"]')!;
    add.click();
    harness.detectChanges();
    const edit = (interval: Element, control: string, value: string) => {
      const input = interval.querySelector<HTMLInputElement>(`[formControlName=${control}]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    const first = page.querySelector('[aria-label="Tuesday interval 1"]')!;
    edit(first, 'startTime', '17:00');
    edit(first, 'endTime', '17:00:00');
    submit(forms[1]);
    harness.detectChanges();
    http.expectNone({ method: 'PUT', url: '/api/business/ai-schedules' });
    expect(page.textContent).toContain('Start and end times must differ.');

    edit(first, 'endTime', '09:00');
    add.click();
    harness.detectChanges();
    const second = page.querySelector('[aria-label="Tuesday interval 2"]')!;
    edit(second, 'startTime', '10:00');
    edit(second, 'endTime', '12:00');
    second.querySelector('mat-slide-toggle button')!.dispatchEvent(new Event('click'));
    submit(forms[1]);
    submit(forms[1]);
    const save = http.expectOne({ method: 'PUT', url: '/api/business/ai-schedules' });
    expect(save.request.headers.get('X-CSRF-Token')).toBe(businessSession.csrfToken);
    expect(save.request.body).toEqual({
      schedules: [
        { weekday: 2, startTime: '17:00', endTime: '09:00', isActive: true },
        { weekday: 2, startTime: '10:00', endTime: '12:00', isActive: false },
      ],
    });
    save.flush({ error: 'Business settings service unavailable.' }, {
      status: 500, statusText: 'Internal Server Error',
    });
    harness.detectChanges();
    http.expectNone({ method: 'PUT', url: '/api/business/ai-schedules' });
    expect(page.textContent).toContain('AI settings saved.');
    expect(page.textContent).toContain('Your edits are still here.');

    second.querySelector<HTMLButtonElement>('[aria-label="Remove Tuesday interval 2"]')!.click();
    harness.detectChanges();
    submit(forms[1]);
    const manualSave = http.expectOne({ method: 'PUT', url: '/api/business/ai-schedules' });
    expect(manualSave.request.body.schedules.length).toBe(1);
    manualSave.flush({
      schedules: [{ weekday: 2, startTime: '17:00:00', endTime: '09:00:00', isActive: true }],
    });
    harness.detectChanges();
    expect(page.textContent).toContain('Weekly schedule saved.');
  });

  it('keeps write controls hidden when the initial schedule load fails', async () => {
    await restore(businessSession);
    const harness = await RouterTestingHarness.create('/business-admin/ai-settings');
    http.expectOne('/api/business/settings').flush({ aiMode: 'scheduled', timezone: 'Asia/Dhaka' });
    http.expectOne('/api/business/ai-schedules').flush({ error: 'Unavailable' }, {
      status: 500, statusText: 'Internal Server Error',
    });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Unable to load AI settings and schedules.');
    expect(harness.routeNativeElement?.querySelector('form')).toBeNull();
  });
});
