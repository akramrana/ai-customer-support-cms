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

const catalogUrl = '/api/business/products';
const catalogProduct = { id: '10', name: 'Cotton tee', description: null, isActive: true };
const catalogDetail = {
  ...catalogProduct,
  variants: [
    { id: '100', sku: 'TEE-S', variantName: null, price: '19.95', stockQty: 12, isActive: true },
    { id: '101', sku: 'TEE-M', variantName: '', price: '19.95', stockQty: 2, isActive: true },
  ],
  images: [{ id: '200', imageUrl: 'https://example.test/front.png', altText: null, sortOrder: 0 }],
};

function enterValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function setField(container: Element, field: string, value: string): void {
  enterValue(container.querySelector<HTMLInputElement>(`[formControlName=${field}]`)!, value);
}

function clickText(container: Element, text: string): void {
  Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.trim() === text)!.click();
}

function submitCatalogForm(form: HTMLFormElement): void {
  form.dispatchEvent(new Event('submit', { cancelable: true }));
}

const conversationUrl = '/api/business/conversations';
const conversationRoute = '/business-admin/conversations';
const messageUrl = conversationUrl + '/10/messages';
const conversation = {
  id: '10', customerPsid: 'customer-10', customerName: 'Nadia',
  lastActivityAt: '2026-11-11T09:00:00Z', lastMessagePreview: 'Hello', messageCount: 21,
};

function chatMessage(id: string, body: string, outgoing = false) {
  return {
    id, body, createdAt: '2026-11-11T09:00:00Z',
    direction: outgoing ? 'outgoing' : 'incoming',
    senderType: outgoing ? 'ai' : 'customer',
    deliveryStatus: outgoing ? 'sent' : 'received',
  };
}

function chatPage<T>(items: T[], page: number, total: number) {
  return { items, page, pageSize: 20, total };
}

const deliveryUrl = '/api/business/delivery-settings';
const deliveryFixture = {
  currency: 'BDT', insideDhakaFee: '50.00', outsideDhakaFee: '100.00',
  insideDhakaDeliveryDays: '1–2 days', outsideDhakaDeliveryDays: '3–4 days',
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

  afterEach(() => {
    for (const request of http.match('/api/business/facebook-pages')) {
      if (!request.cancelled) request.flush({ items: [] });
    }
    http.verify();
  });

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

  it('manages the Gemini API key through the authenticated client without displaying it', async () => {
    await restore(businessSession);
    const url = '/api/business/gemini-key';
    const harness = await RouterTestingHarness.create('/business-admin/ai-settings/gemini-key');
    http.expectOne(url).flush({ configured: false });
    harness.detectChanges();
    const page = harness.routeNativeElement!;
    expect(page.textContent).toContain('Not configured');
    const input = page.querySelector<HTMLInputElement>('input[type=password]')!;
    const saveButton = page.querySelector<HTMLButtonElement>('button[type=submit]')!;
    for (const invalid of ['   ', 'x'.repeat(201)]) {
      input.value = invalid;
      input.dispatchEvent(new Event('input'));
      harness.detectChanges();
      expect(saveButton.disabled).toBeTrue();
      http.expectNone({ method: 'PUT', url });
    }
    input.value = '  test.key+/=  ';
    input.dispatchEvent(new Event('input'));
    harness.detectChanges();
    expect(saveButton.disabled).toBeFalse();
    saveButton.click();
    const save = http.expectOne({ method: 'PUT', url });
    expect(save.request.body).toEqual({ apiKey: 'test.key+/=' });
    expect(save.request.headers.get('X-CSRF-Token')).toBe('business-token');
    save.flush({ configured: true });
    harness.detectChanges();
    expect(input.value).toBe('');
    expect(page.textContent).not.toContain('test.key+/=');
    spyOn(window, 'confirm').and.returnValue(true);
    Array.from(page.querySelectorAll('button')).find(button => button.textContent?.includes('Remove key'))!.click();
    http.expectOne({ method: 'DELETE', url }).flush({ configured: false });
    harness.detectChanges();
    expect(page.textContent).toContain('Not configured');
  });

  it('loads the order list and details and confirms through the authenticated client', async () => {
    await restore(businessSession);
    const base = '/api/business/orders';
    const order = { id: '42', reference: 'ORD-42', customerName: 'Customer', phone: '+8801712345678',
      status: 'pending_confirmation', total: '268.41', currency: 'BDT', createdAt: '2026-11-12T00:00:00Z' };
    const detail = { ...order, address: 'Road 1', region: 'outside_dhaka', extraRequest: 'Call on arrival',
      subtotal: '187.91', deliveryFee: '80.50', items: [{ id: '1', productName: 'Loose rice', sku: 'RICE',
        requestedQuantity: '1.500', requestedUnit: 'kg', packages: null, unitPrice: '125.27', lineTotal: '187.91' }] };
    const harness = await RouterTestingHarness.create('/business-admin/orders');
    http.expectOne(base + '/pending-count').flush({ count: 1 });
    const list = http.expectOne(request => request.url === base);
    expect(list.request.params.get('page')).toBe('1');
    list.flush({ items: [order], total: 1 });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Awaiting review: 1');
    expect(harness.routeNativeElement?.querySelector('a[href="/business-admin/orders/42"]')?.textContent).toContain('Order #42');
    await harness.navigateByUrl('/business-admin/orders/42');
    http.expectOne(base + '/42').flush(detail);
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('1.500 kg');
    const confirm = spyOn(window, 'confirm').and.returnValue(false);
    const button = Array.from(harness.routeNativeElement!.querySelectorAll('button'))
      .find(node => node.textContent?.includes('Confirm order'))!;
    button.click();
    http.expectNone(base + '/42/confirm');
    confirm.and.returnValue(true);
    button.click();
    const action = http.expectOne({ method: 'POST', url: base + '/42/confirm' });
    expect(action.request.withCredentials).toBeTrue();
    expect(action.request.headers.get('X-CSRF-Token')).toBe('business-token');
    action.flush({ status: 'confirmed' });
    http.expectOne(base + '/42').flush({ ...detail, status: 'confirmed' });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Confirmed');
    const dispatch = Array.from(harness.routeNativeElement!.querySelectorAll('button'))
      .find(node => node.textContent?.includes('Dispatched & Update Stock'))!;
    dispatch.click();
    expect(confirm.calls.mostRecent().args[0]).toContain('Loose rice · 1.500 kg');
    http.expectOne({ method: 'POST', url: base + '/42/dispatch' }).flush({ status: 'dispatched' });
    http.expectOne(base + '/42').flush({ ...detail, status: 'dispatched' });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).not.toContain('Dispatched & Update Stock');
  });

  it('creates one manual order with multiple editable variant rows and the configured delivery fee', async () => {
    await restore(businessSession);
    const harness = await RouterTestingHarness.create('/business-admin/create-order');
    http.expectOne(deliveryUrl).flush(deliveryFixture);
    harness.detectChanges();
    const page = harness.routeNativeElement!;
    const input = (selector: string, value: string) => {
      const element = page.querySelector<HTMLInputElement>(selector)!;
      element.value = value;
      element.dispatchEvent(new Event('input'));
      harness.detectChanges();
    };
    const select = (index: number, value: string) => {
      const element = page.querySelectorAll('select')[index];
      element.value = value;
      element.dispatchEvent(new Event('change'));
      harness.detectChanges();
    };
    const click = (label: string) => {
      Array.from(page.querySelectorAll('button')).find(button => button.textContent?.trim() === label)!.click();
      harness.detectChanges();
    };
    const pick = async (sku: string, id: string, price: string) => {
      const search = page.querySelector<HTMLInputElement>('app-variant-picker input')!;
      search.focus();
      input('app-variant-picker input', 'Shirt ' + sku);
      await new Promise(resolve => setTimeout(resolve, 325));
      const request = http.expectOne(req => req.url === '/api/business/products/variant-search');
      expect(request.request.params.get('search')).toBe('Shirt ' + sku);
      expect(request.request.params.get('activeOnly')).toBe('true');
      request.flush({ items: [{
        product: { id: '9', name: 'Shirt', isActive: true },
        variant: { id, sku, price, isActive: true, stockQty: 3, measurementValue: '1', measurementUnit: 'pcs' },
      }] });
      harness.detectChanges();
      await harness.fixture.whenStable();
      (document.querySelector('mat-option') as HTMLElement).click();
      harness.detectChanges();
    };
    await pick('S', '100', '10.00');
    click('Add Product');
    click('Add Product');
    expect(page.querySelectorAll('tbody tr').length).toBe(1);
    await pick('M', '101', '20.00');
    click('Add Product');
    input('[aria-label="Quantity for S"]', '3');
    input('[formcontrolname="customerName"]', 'Customer');
    input('[formcontrolname="phone"]', '01700000000');
    input('[formcontrolname="address"]', 'Address');
    select(0, 'outside');
    expect(page.textContent).toContain('150.00 BDT');
    click('Save order');
    const request = http.expectOne({ method: 'POST', url: '/api/business/orders' });
    expect(request.request.body.items).toEqual([{ variantId: '100', quantity: 3 }, { variantId: '101', quantity: 1 }]);
    expect(request.request.body.zone).toBe('outside');
    request.flush({ error: 'Temporary test failure' }, { status: 500, statusText: 'Error' });
    harness.detectChanges();
    expect(page.querySelectorAll('tbody tr').length).toBe(2);
    click('Save order');
    const retry = http.expectOne({ method: 'POST', url: '/api/business/orders' });
    expect(retry.request.body.requestId).toBe(request.request.body.requestId);
    retry.flush({ error: 'Temporary test failure' }, { status: 500, statusText: 'Error' });
  });

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
    ['super-admin', superSession, ['businesses', 'ai-usage', 'facebook-pages', 'administrators', 'users']],
    ['business-admin', businessSession, ['products', 'brands', 'categories', 'inventory', 'conversations', 'users', 'orders', 'create-order', 'ai-usage', 'ai-settings']],
  ] as const) {
    it(`restores the ${path} workspace and shows its feature routes`, async () => {
      await restore(session);
      const harness = await RouterTestingHarness.create(`/${path}/dashboard`);
      const links = Array.from(
        harness.routeNativeElement!.querySelectorAll('main nav a'),
        (link) => link.getAttribute('href'),
      );
      expect(links).toEqual(sections.map((section) => `/${path}/${section}`));

      for (const section of sections.filter((name) => !['businesses', 'ai-usage', 'facebook-pages', 'administrators', 'users'].includes(name) && name !== 'brands' && name !== 'categories' && name !== 'ai-settings' && name !== 'products' && name !== 'conversations' && name !== 'orders' && name !== 'inventory' && name !== 'create-order')) {
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

  for (const platform of [true, false]) {
    it('loads AI usage with filters for the ' + (platform ? 'platform' : 'business'), async () => {
      await restore(platform ? superSession : businessSession);
      const scope = platform ? 'platform' : 'business';
      const url = '/api/' + scope + '/ai-usage';
      const harness = await RouterTestingHarness.create(platform ? '/super-admin/ai-usage' : '/business-admin/ai-usage');
      if (platform) http.expectOne(req => req.url === '/api/platform/businesses').flush(chatPage([
        { id: '9', name: 'Test Business', slug: 'test', isActive: true },
      ], 1, 1));
      const request = http.expectOne(req => req.url === url);
      expect(request.request.params.has('businessId')).toBeFalse();
      const metrics = { totalCalls: 2, successfulCalls: 1, failedCalls: 1, inputTokens: 80, outputTokens: 20, averageLatencyMs: 100 };
      const data = { ...metrics, from: '2026-11-01', to: '2026-11-01', daily: [{ date: '2026-11-01', ...metrics }],
        recentErrors: [{ code: 'network_error', calls: 1, lastSeen: '2026-11-01T12:00:00Z' }] };
      request.flush(data);
      harness.detectChanges();
      const page = harness.routeNativeElement!;
      expect(page.textContent).toContain('50%');
      expect(page.textContent).toContain('80 input');
      expect(page.textContent).toContain('network error');
      const select = page.querySelector('select');
      if (platform) {
        select!.value = '9';
        select!.dispatchEvent(new Event('change'));
      } else expect(select).toBeNull();
      setField(page, 'from', '2026-11-01');
      setField(page, 'to', '2026-11-01');
      submitCatalogForm(page.querySelector('form')!);
      const filtered = http.expectOne(req => req.url === url);
      expect(filtered.request.params.get('from')).toBe('2026-11-01');
      expect(filtered.request.params.get('businessId')).toBe(platform ? '9' : null);
      filtered.flush(data);
    });
  }

  it('accepts Facebook OAuth results only from the opened popup and configured origin', async () => {
    await restore(businessSession);
    const url = '/api/business/facebook-pages';
    const harness = await RouterTestingHarness.create('/business-admin/facebook-pages');
    http.expectOne(url).flush({ items: [] });
    http.expectOne(url + '/oauth/available').flush({ authorized: false, items: [] });
    harness.detectChanges();
    const popup = { location: { replace: jasmine.createSpy() }, close: jasmine.createSpy(), closed: false };
    spyOn(window, 'open').and.returnValue(popup as unknown as Window);
    const page = harness.routeNativeElement!;
    const start = () => {
      clickText(page, 'Connect Facebook Page');
      const request = http.expectOne(url + '/oauth/start');
      expect(request.request.headers.get('X-CSRF-Token')).toBe(businessSession.csrfToken);
      request.flush({ authorizationUrl: 'https://www.facebook.com/v27.0/dialog/oauth', callbackOrigin: 'https://tunnel.test' });
      harness.detectChanges();
    };
    const result = (value: string, origin: string, source: unknown) => {
      const event = new MessageEvent('message', { origin, data: { type: 'facebook-oauth', result: value } });
      Object.defineProperty(event, 'source', { value: source });
      window.dispatchEvent(event);
    };
    start();
    result('select', 'https://other.test', popup);
    result('select', 'https://tunnel.test', window);
    http.expectNone(url + '/oauth/available');
    result('error', 'https://tunnel.test', popup);
    harness.detectChanges();
    expect(page.textContent).toContain('Facebook authorization could not be completed');
    start();
    result('select', 'https://tunnel.test', popup);
    http.expectOne(url + '/oauth/available').flush({ authorized: true, items: [{ page_id: '1', page_name: 'Shop' }] });
    harness.detectChanges();
    expect(page.textContent).toContain('Select a Facebook Page');
  });

  it('shows tenant Facebook Page connection status and links to setup', async () => {
    await restore(businessSession);
    const url = '/api/business/facebook-pages';
    const harness = await RouterTestingHarness.create('/business-admin/dashboard');
    const request = http.expectOne(url);
    expect(request.request.withCredentials).toBeTrue();
    request.flush({ items: [] });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Connect Facebook Page');
    await harness.navigateByUrl('/business-admin/facebook-pages');
    http.expectOne(url).flush({ items: [] });
    http.expectOne(url + '/oauth/available').flush({ authorized: true, items: [{ page_id: '100', page_name: 'Shop' }] });
    harness.detectChanges();
    clickText(harness.routeNativeElement!, 'Connect');
    const connect = http.expectOne({ method: 'POST', url: url + '/connect' });
    expect(connect.request.body).toEqual({ page_id: '100' });
    expect(connect.request.headers.get('X-CSRF-Token')).toBe(businessSession.csrfToken);
    connect.flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne(url).flush({ items: [] });
    await harness.navigateByUrl('/business-admin/dashboard');
    const row = { id: '1', page_id: '100', page_name: 'Pending shop', is_active: true, connected_at: '2026-11-01' };
    http.expectOne(url).flush({ items: [{ ...row, has_access_token: false },
      { ...row, id: '2', page_id: '200', page_name: 'Disabled shop', is_active: false, has_access_token: true }] });
    harness.detectChanges();
    const page = harness.routeNativeElement!;
    expect(page.textContent).toContain('Facebook Page Connected');
    expect(page.textContent).toContain('Page ID 200');
    expect(page.textContent).toContain('Inactive');
    expect(page.textContent).toContain('Connection required');
    expect(page.querySelector('a[href="/business-admin/facebook-pages"]')?.textContent).toContain('Add another Page');
  });

  it('lists Facebook Pages, confirms deactivation, and opens the business detail', async () => {
    await restore(superSession);
    const url = '/api/platform/facebook-pages';
    const row = { id: '9', business_id: '50', business_name: 'Business', page_id: '123',
      page_name: 'Shop Page', is_active: true, connected_at: '2026-11-01T00:00:00Z' };
    const harness = await RouterTestingHarness.create('/super-admin/facebook-pages');
    http.expectOne(req => req.url === url).flush(chatPage([row], 1, 1));
    harness.detectChanges();
    const page = harness.routeNativeElement!;
    const toggle = page.querySelector<HTMLButtonElement>('button[role=switch]')!;
    const confirm = spyOn(window, 'confirm').and.returnValue(false);
    toggle.click();
    http.expectNone({ method: 'PATCH', url: url + '/9/status' });
    confirm.and.returnValue(true);
    toggle.click();
    const update = http.expectOne({ method: 'PATCH', url: url + '/9/status' });
    expect(update.request.headers.get('X-CSRF-Token')).toBe(superSession.csrfToken);
    expect(update.request.body).toEqual({ is_active: false });
    update.flush({ ...row, is_active: false });
    harness.detectChanges();
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    toggle.click();
    http.expectOne({ method: 'PATCH', url: url + '/9/status' })
      .flush({}, { status: 500, statusText: 'Server Error' });
    harness.detectChanges();
    expect(page.textContent).toContain('Unable to change the Page status');
    const businessLink = page.querySelector('a[href="/super-admin/businesses/50"]')!;
    await harness.navigateByUrl(businessLink.getAttribute('href')!);
    http.expectOne('/api/platform/businesses/50').flush({ id: '50', name: 'Business', slug: 'business', isActive: true });
    harness.detectChanges();
    http.expectOne(req => req.url === '/api/platform/businesses/50/facebook-pages').flush(chatPage([], 1, 0));
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('No Facebook Pages connected.');
  });

  it('denies Business Admin access to the platform Facebook Pages page', async () => {
    await restore(businessSession);
    await RouterTestingHarness.create('/super-admin/facebook-pages');
    expect(router.url).toBe('/business-admin/dashboard?notice=forbidden');
    http.expectNone(req => req.url === '/api/platform/facebook-pages');
  });

  it('confirms business deactivation and refreshes only after a successful status change', async () => {
    await restore(superSession);
    const url = '/api/platform/businesses';
    const business = { id: '50', name: 'Shop', slug: 'shop', isActive: true };
    const harness = await RouterTestingHarness.create('/super-admin/businesses');
    http.expectOne(req => req.url === url).flush(chatPage([business], 1, 1));
    harness.detectChanges();
    const page = harness.routeNativeElement!;
    const confirm = spyOn(window, 'confirm').and.returnValue(false);
    clickText(page, 'Deactivate business');
    http.expectNone(url + '/50/status');
    confirm.and.returnValue(true);
    clickText(page, 'Deactivate business');
    const patch = http.expectOne({ method: 'PATCH', url: url + '/50/status' });
    expect(patch.request.body).toEqual({ isActive: false });
    expect(patch.request.headers.get('X-CSRF-Token')).toBe(superSession.csrfToken);
    patch.flush({ ...business, isActive: false });
    http.expectOne(req => req.url === url).flush(chatPage([{ ...business, isActive: false }], 1, 1));
    harness.detectChanges();
    expect(page.textContent).toContain('Activate business');
  });

  it('creates a business with its initial owner through the platform form', async () => {
    await restore(superSession);
    const url = '/api/platform/businesses';
    const harness = await RouterTestingHarness.create('/super-admin/businesses');
    http.expectOne(req => req.url === url).flush(chatPage([], 1, 0));
    harness.detectChanges();
    const page = harness.routeNativeElement!;
    clickText(page, 'Add business');
    harness.detectChanges();
    setField(page, 'name', 'New Business');
    setField(page, 'slug', 'new-business');
    page.querySelector<HTMLInputElement>('[formControlName=onboarding]')!.click();
    harness.detectChanges();
    setField(page, 'administratorName', 'Initial Owner');
    setField(page, 'administratorEmail', 'owner@example.test');
    setField(page, 'administratorPassword', 'abc12');
    submitCatalogForm(page.querySelector('form')!);
    harness.detectChanges();
    http.expectNone({ method: 'POST', url });
    expect(page.querySelector('mat-error')?.textContent).toContain('Use at least 6 characters.');
    setField(page, 'administratorPassword', 'abc123');
    submitCatalogForm(page.querySelector('form')!);
    const request = http.expectOne({ method: 'POST', url });
    expect(request.request.headers.get('X-CSRF-Token')).toBe(superSession.csrfToken);
    expect(request.request.body).toEqual({ name: 'New Business', slug: 'new-business', isActive: true,
      administrator: { name: 'Initial Owner', email: 'owner@example.test', password: 'abc123' } });
    request.flush({ id: '50', name: 'New Business', slug: 'new-business', isActive: true });
    http.expectOne(req => req.url === url).flush(chatPage([{ id: '50', name: 'New Business', slug: 'new-business', isActive: true }], 1, 1));
    harness.detectChanges();
    expect(page.textContent).toContain('New Business');
    expect(page.querySelector('a[href="/super-admin/administrators/50"]')).not.toBeNull();
    expect(page.querySelector('input[type=password]')).toBeNull();
  });

  it('hides user management from a business admin without owner permissions', async () => {
    await restore({ ...businessSession, business: { ...businessSession.business!, role: 'admin' } });
    const harness = await RouterTestingHarness.create('/business-admin/users');
    expect(router.url).toBe('/business-admin/dashboard?notice=forbidden');
    expect(harness.routeNativeElement?.querySelector('a[href="/business-admin/users"]')).toBeNull();
  });

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

  it('clears the current session when the server rejects a session check', async () => {
    await restore(businessSession);
    const harness = await RouterTestingHarness.create('/business-admin/dashboard');
    const client = TestBed.inject(HttpClient);
    const check = firstValueFrom(client.get('/api/auth/me')).catch(error => error.status);
    http.expectOne('/api/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(await check).toBe(401);
    await harness.fixture.whenStable();
    expect(auth.session()).toBeNull();
    expect(router.url).toBe('/business-admin/login?notice=expired');
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
    http.expectOne(deliveryUrl).flush(deliveryFixture);
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
    http.expectOne(deliveryUrl).flush(deliveryFixture);
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
    http.expectOne(deliveryUrl).flush(deliveryFixture);
    http.expectOne('/api/business/settings').flush({ aiMode: 'scheduled', timezone: 'Asia/Dhaka' });
    http.expectOne('/api/business/ai-schedules').flush({ error: 'Unavailable' }, {
      status: 500, statusText: 'Internal Server Error',
    });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Unable to load AI settings and schedules.');
    expect(harness.routeNativeElement?.querySelector('form:not([aria-labelledby=delivery-settings-heading])')).toBeNull();
  });

  it('lists products, loads variant counts, paginates, and debounces name search', async () => {
    await restore(businessSession);
    const harness = await RouterTestingHarness.create('/business-admin/products');
    const page = harness.routeNativeElement!;
    expect(page.textContent).toContain('Loading products');
    const list = http.expectOne((request) => request.url === catalogUrl);
    expect(list.request.params.get('page')).toBe('1');
    expect(list.request.params.get('pageSize')).toBe('20');
    list.flush({ items: [catalogProduct], page: 1, pageSize: 20, total: 21 });
    http.expectOne(catalogUrl + '/10').flush(catalogDetail);
    harness.detectChanges();
    expect(page.querySelector('tbody tr')?.textContent).toContain('Cotton tee');
    expect(page.querySelector('tbody tr td:nth-child(3)')?.textContent?.trim()).toBe('2');

    spyOn(window, 'confirm').and.returnValues(false, true);
    const deactivate = page.querySelector<HTMLButtonElement>('[aria-label="Deactivate Cotton tee"]')!;
    deactivate.click();
    http.expectNone({ method: 'DELETE', url: catalogUrl + '/10' });
    deactivate.click();
    const deletion = http.expectOne({ method: 'DELETE', url: catalogUrl + '/10' });
    expect(deletion.request.headers.get('X-CSRF-Token')).toBe(businessSession.csrfToken);
    deletion.flush(null, { status: 204, statusText: 'No Content' });
    harness.detectChanges();
    expect(page.textContent).toContain('Product deactivated.');

    page.querySelector<HTMLButtonElement>('button.mat-mdc-paginator-navigation-next')!.click();
    const second = http.expectOne((request) => request.url === catalogUrl);
    expect(second.request.params.get('page')).toBe('2');
    second.flush({ items: [], page: 2, pageSize: 20, total: 21 });
    const search = page.querySelector<HTMLInputElement>('input[type=search]')!;
    enterValue(search, 'Cot');
    enterValue(search, 'Cotton');
    http.expectNone((request) => request.url === catalogUrl);
    await new Promise((resolve) => setTimeout(resolve, 350));
    const searched = http.expectOne((request) => request.url === catalogUrl);
    expect(searched.request.params.get('search')).toBe('Cotton');
    expect(searched.request.params.get('page')).toBe('1');
    searched.flush({ items: [], page: 1, pageSize: 20, total: 0 });
    harness.detectChanges();
    expect(page.textContent).toContain('No products match your search.');
  });

  function flushTaxonomyOptions(): void {
    for (const [kind, name] of [['brands', 'COSRX'], ['categories', 'Sunscreen']]) {
      http.expectOne(req => req.url === '/api/business/' + kind)
        .flush({ items: [{ id: '1', name }], page: 1, pageSize: 100, total: 1 });
    }
  }

  for (const [kind, label] of [['brands', 'brand'], ['categories', 'category']]) {
    it('lists, validates and handles duplicate names for ' + kind, async () => {
      await restore(businessSession);
      const url = '/api/business/' + kind;
      const harness = await RouterTestingHarness.create('/business-admin/' + kind);
      const page = harness.routeNativeElement!;
      http.expectOne(req => req.url === url).flush(chatPage([{ id: '1', name: 'Existing' }], 1, 1));
      harness.detectChanges();
      expect(page.textContent).toContain('Existing');
      clickText(page, 'Add ' + label);
      harness.detectChanges();
      const form = page.querySelector('form')!;
      const input = form.querySelector('input')!;
      enterValue(input, '   ');
      submitCatalogForm(form);
      http.expectNone({ method: 'POST', url });
      enterValue(input, '  New   name ');
      submitCatalogForm(form);
      const request = http.expectOne({ method: 'POST', url });
      expect(request.request.body).toEqual({ name: 'New name' });
      expect(request.request.headers.get('X-CSRF-Token')).toBe(businessSession.csrfToken);
      request.flush({ error: 'Name already exists.' }, { status: 409, statusText: 'Conflict' });
      harness.detectChanges();
      expect(page.textContent).toContain('Name already exists.');
    });
  }

  it('validates the create form and keeps its draft after a duplicate SKU conflict', async () => {
    await restore(businessSession);
    const harness = await RouterTestingHarness.create('/business-admin/products/new');
    flushTaxonomyOptions();
    harness.detectChanges();
    const page = harness.routeNativeElement!;
    const form = page.querySelector('form')!;
    clickText(page, 'Add variant');
    clickText(page, 'Add image');
    harness.detectChanges();
    setField(page, 'name', 'Cotton tee');
    setField(page, 'sku', 'TEE-S');
    setField(page, 'price', '-2');
    setField(page, 'stockQty', '1.5');
    setField(page, 'imageUrl', 'https://user:pass@example.test/tee.png');
    submitCatalogForm(form);
    http.expectNone({ method: 'POST', url: catalogUrl });
    harness.detectChanges();
    expect(page.textContent).toContain('Correct the highlighted fields');

    const brand = page.querySelector<HTMLSelectElement>('[formControlName=brand_id]')!;
    expect(brand.options[1].textContent).toBe('COSRX');
    brand.selectedIndex = 1;
    brand.dispatchEvent(new Event('change'));
    setField(page, 'price', '19.95');
    setField(page, 'stockQty', '12');
    setField(page, 'imageUrl', 'https://example.test/tee.png');
    submitCatalogForm(form);
    submitCatalogForm(form);
    const request = http.expectOne({ method: 'POST', url: catalogUrl });
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.body).toEqual({
      name: 'Cotton tee', description: null, isActive: true, brand_id: '1', category_id: null,
      variants: [{ sku: 'TEE-S', variantName: null, price: '19.95', stockQty: 12, isActive: true,
        sellingMode: 'packaged', measurementUnit: 'pcs', measurementValue: '1' }],
      images: [{ imageUrl: 'https://example.test/tee.png', altText: null, sortOrder: 0 }],
    });
    request.flush({ error: 'private database message' }, { status: 409, statusText: 'Conflict' });
    harness.detectChanges();
    expect(page.textContent).toContain('A SKU already exists');
    expect(page.textContent).not.toContain('private database message');
    expect(page.querySelector<HTMLInputElement>('[formControlName=sku]')?.value).toBe('TEE-S');
    expect(page.querySelector('img')?.getAttribute('src')).toBe('https://example.test/tee.png');

    const confirmation = spyOn(window, 'confirm').and.returnValue(false);
    await harness.navigateByUrl('/business-admin/dashboard');
    expect(confirmation).toHaveBeenCalled();
    expect(router.url).toBe('/business-admin/products/new');
  });

  it('sends only edited children, new rows without IDs, and explicit image removals', async () => {
    await restore(businessSession);
    const harness = await RouterTestingHarness.create('/business-admin/products/10/edit');
    flushTaxonomyOptions();
    const page = harness.routeNativeElement!;
    http.expectOne(catalogUrl + '/10').flush(catalogDetail);
    harness.detectChanges();
    const firstVariant = page.querySelector('[aria-label="Variant 1"]')!;
    expect(firstVariant.querySelector<HTMLInputElement>('[formcontrolname="stockQty"]')?.readOnly).toBeTrue();
    firstVariant.querySelector('mat-slide-toggle button')!.dispatchEvent(new Event('click'));
    clickText(page, 'Add variant');
    clickText(page, 'Add image');
    harness.detectChanges();
    const addedVariant = page.querySelector('[aria-label="Variant 3"]')!;
    setField(addedVariant, 'sku', 'TEE-XL');
    setField(addedVariant, 'price', '21');
    setField(page.querySelector('[aria-label="Image 2"]')!, 'imageUrl', 'https://example.test/back.png');
    clickText(page.querySelector('[aria-label="Image 1"]')!, 'Remove image');
    harness.detectChanges();
    submitCatalogForm(page.querySelector('form')!);

    const update = http.expectOne({ method: 'PUT', url: catalogUrl + '/10' });
    expect(update.request.headers.get('X-CSRF-Token')).toBe(businessSession.csrfToken);
    expect(update.request.body).toEqual({
      variants: [{ id: '100', isActive: false },
        { sku: 'TEE-XL', variantName: null, price: '21', stockQty: 0, isActive: true,
          sellingMode: 'packaged', measurementUnit: 'pcs', measurementValue: '1' }],
      images: [{ imageUrl: 'https://example.test/back.png', altText: null, sortOrder: 0 }],
      removeImageIds: ['200'],
    });
    update.flush(catalogDetail);
    await harness.fixture.whenStable();
    expect(router.url).toBe('/business-admin/products');
    http.expectOne((request) => request.url === catalogUrl).flush({ items: [], page: 1, pageSize: 20, total: 0 });
  });

  it('shows a safe list error and retries on demand', async () => {
    await restore(businessSession);
    const harness = await RouterTestingHarness.create('/business-admin/products');
    http.expectOne((request) => request.url === catalogUrl)
      .flush({ error: 'private database message' }, { status: 500, statusText: 'Server Error' });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Unable to load products.');
    expect(harness.routeNativeElement?.textContent).not.toContain('private database message');
    clickText(harness.routeNativeElement!, 'Retry');
    http.expectOne((request) => request.url === catalogUrl).flush({ items: [], page: 1, pageSize: 20, total: 0 });
  });

  it('loads conversations in server order and requests additional list pages on demand', async () => {
    await restore(businessSession);
    const harness = await RouterTestingHarness.create(conversationRoute);
    const request = http.expectOne((req) => req.url === conversationUrl);
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.params.keys().sort()).toEqual(['page', 'pageSize']);
    expect(request.request.params.get('page')).toBe('1');
    request.flush(chatPage([conversation, { ...conversation, id: '9', customerName: null, customerPsid: 'PSID-9' }], 1, 22));
    harness.detectChanges();

    const page = harness.routeNativeElement!;
    expect(Array.from(page.querySelectorAll('.thread-name'), (row) => row.textContent?.trim()))
      .toEqual(['Nadia', 'PSID-9']);
    expect(page.textContent).toContain('21 messages');
    page.querySelector<HTMLButtonElement>('.mat-mdc-paginator-navigation-next')!.click();
    const next = http.expectOne((req) => req.url === conversationUrl && req.params.get('page') === '2');
    next.flush(chatPage([], 2, 22));
    harness.detectChanges();
    expect(page.textContent).toContain('No conversations on this page.');
  });

  it('opens the newest page, prepends older messages once, and renders untrusted text literally', async () => {
    await restore(businessSession);
    const harness = await RouterTestingHarness.create(conversationRoute);
    const page = harness.routeNativeElement!;
    http.expectOne((req) => req.url === conversationUrl).flush(chatPage([conversation], 1, 1));
    harness.detectChanges();
    page.querySelector<HTMLButtonElement>('.thread')!.click();
    const payload = '<img src=x onerror=alert(1)>';
    http.expectOne((req) => req.url === messageUrl && req.params.get('page') === '2')
      .flush(chatPage([chatMessage('100', payload, true)], 2, 21));
    harness.detectChanges();
    expect(page.querySelector('.thread')?.getAttribute('aria-current')).toBe('true');
    expect(page.querySelector('.body')?.textContent).toBe(payload);
    expect(page.querySelector('.message img')).toBeNull();
    expect(page.querySelector('.message')?.classList.contains('outgoing')).toBeTrue();

    clickText(page, 'Load older messages');
    http.expectOne((req) => req.url === messageUrl && req.params.get('page') === '1')
      .flush(chatPage([chatMessage('9', 'Earlier'), chatMessage('100', payload, true)], 1, 21));
    harness.detectChanges();
    expect(Array.from(page.querySelectorAll('.body'), (node) => node.textContent))
      .toEqual(['Earlier', payload]);
    expect(page.textContent).toContain('sent');
  });

  it('keeps the selected thread and loaded messages during refresh and pagination failures', async () => {
    await restore(businessSession);
    const harness = await RouterTestingHarness.create(conversationRoute);
    const page = harness.routeNativeElement!;
    http.expectOne((req) => req.url === conversationUrl).flush(chatPage([conversation], 1, 1));
    harness.detectChanges();
    page.querySelector<HTMLButtonElement>('.thread')!.click();
    http.expectOne((req) => req.url === messageUrl && req.params.get('page') === '2')
      .flush(chatPage([chatMessage('21', 'Saved reply')], 2, 21));
    harness.detectChanges();

    clickText(page, 'Refresh conversations');
    http.expectOne((req) => req.url === conversationUrl)
      .flush(chatPage([{ ...conversation, customerName: 'Nadia Updated' }], 1, 1));
    harness.detectChanges();
    expect(page.querySelector('#thread-heading')?.textContent).toContain('Nadia Updated');
    expect(page.textContent).toContain('Saved reply');

    clickText(page, 'Load older messages');
    http.expectOne((req) => req.url === messageUrl && req.params.get('page') === '1')
      .error(new ProgressEvent('error'));
    harness.detectChanges();
    expect(page.textContent).toContain('Couldn’t load older messages');
    expect(page.textContent).toContain('Saved reply');

    clickText(page, 'Refresh messages');
    http.expectOne((req) => req.url === messageUrl && req.params.get('page') === '2')
      .flush(chatPage([chatMessage('21', 'Saved reply')], 2, 41));
    http.expectOne((req) => req.url === messageUrl && req.params.get('page') === '3')
      .flush({ error: 'private error' }, { status: 500, statusText: 'Server Error' });
    harness.detectChanges();
    expect(page.textContent).toContain('Couldn’t load messages');
    expect(page.textContent).toContain('Saved reply');
    expect(page.textContent).not.toContain('private error');

    clickText(page, 'Refresh messages');
    http.expectOne((req) => req.url === messageUrl && req.params.get('page') === '2')
      .flush(chatPage([chatMessage('21', 'Saved reply'), chatMessage('22', 'New reply')], 2, 22));
    harness.detectChanges();
    expect(Array.from(page.querySelectorAll('.body'), (node) => node.textContent))
      .toEqual(['Saved reply', 'New reply']);

    clickText(page, 'Refresh messages');
    http.expectOne((req) => req.url === messageUrl)
      .flush({}, { status: 404, statusText: 'Not Found' });
    harness.detectChanges();
    expect(page.textContent).toContain('This conversation is no longer available.');
    expect(page.textContent).toContain('New reply');
  });

  it('switches between inbox and thread at mobile width and handles an empty thread', async () => {
    await restore(businessSession);
    const harness = await RouterTestingHarness.create(conversationRoute);
    const page = harness.routeNativeElement!;
    const host = page.querySelector('.inbox')!.parentElement!;
    host.style.width = '380px';
    http.expectOne((req) => req.url === conversationUrl).flush(chatPage([{ ...conversation, messageCount: 0 }], 1, 1));
    harness.detectChanges();
    const inbox = page.querySelector<HTMLElement>('.threads')!;
    const thread = page.querySelector<HTMLElement>('.thread-panel')!;
    expect(getComputedStyle(thread).display).toBe('none');
    page.querySelector<HTMLButtonElement>('.thread')!.click();
    http.expectOne((req) => req.url === messageUrl).flush(chatPage([], 1, 0));
    harness.detectChanges();
    expect(getComputedStyle(inbox).display).toBe('none');
    expect(getComputedStyle(thread).display).toBe('flex');
    expect(thread.textContent).toContain('No messages in this conversation yet.');
    clickText(thread, 'Back to inbox');
    harness.detectChanges();
    expect(getComputedStyle(inbox).display).toBe('flex');
    expect(getComputedStyle(thread).display).toBe('none');
    expect(inbox.querySelector('.thread')?.getAttribute('aria-current')).toBe('true');
  });

  it('uses the existing permission and expired-session handling for conversation reads', async () => {
    await restore(businessSession);
    const harness = await RouterTestingHarness.create(conversationRoute);
    http.expectOne((req) => req.url === conversationUrl).flush({}, { status: 403, statusText: 'Forbidden' });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('permission to view these conversations');
    clickText(harness.routeNativeElement!, 'Refresh conversations');
    http.expectOne((req) => req.url === conversationUrl).flush({}, { status: 401, statusText: 'Unauthorized' });
    await harness.fixture.whenStable();
    expect(router.url).toBe('/business-admin/login?notice=expired');
  });

  it('opens at the newest message and preserves scroll position when reading older messages', async () => {
    await restore(businessSession);
    const harness = await RouterTestingHarness.create(conversationRoute);
    const page = harness.routeNativeElement!;
    http.expectOne((req) => req.url === conversationUrl)
      .flush(chatPage([{ ...conversation, messageCount: 40 }], 1, 1));
    harness.detectChanges();
    page.querySelector<HTMLButtonElement>('.thread')!.click();
    const longMessage = 'Customer message\n'.repeat(20);
    const newest = Array.from({ length: 20 }, (_, index) => chatMessage(String(index + 21), longMessage));
    http.expectOne((req) => req.url === messageUrl && req.params.get('page') === '2')
      .flush(chatPage(newest, 2, 40));
    harness.detectChanges();
    const history = page.querySelector<HTMLElement>('.history')!;
    expect(history.scrollHeight).toBeGreaterThan(history.clientHeight);
    expect(history.scrollHeight - history.scrollTop - history.clientHeight).toBeLessThanOrEqual(2);

    history.scrollTop = 0;
    clickText(page, 'Refresh messages');
    http.expectOne((req) => req.url === messageUrl && req.params.get('page') === '2')
      .flush(chatPage(newest, 2, 41));
    http.expectOne((req) => req.url === messageUrl && req.params.get('page') === '3')
      .flush(chatPage([chatMessage('41', 'New reply')], 3, 41));
    harness.detectChanges();
    expect(history.scrollTop).toBe(0);
    expect(page.textContent).toContain('New reply');
  });

  it('loads and saves delivery settings independently, validates fields, and preserves a failed draft', async () => {
    await restore(businessSession);
    const harness = await RouterTestingHarness.create('/business-admin/ai-settings');
    const page = harness.routeNativeElement!;
    const delivery = page.querySelector('app-delivery-settings')!;
    expect(delivery.textContent).toContain('Loading delivery settings');
    http.expectOne('/api/business/settings').flush({ aiMode: 'off', timezone: 'Asia/Dhaka' });
    http.expectOne('/api/business/ai-schedules').flush({ schedules: [] });
    const load = http.expectOne(deliveryUrl);
    expect(load.request.withCredentials).toBeTrue();
    load.flush(deliveryFixture);
    harness.detectChanges();
    expect(delivery.textContent).toContain('Inside Dhaka');
    expect(delivery.textContent).toContain('Outside Dhaka');
    expect(delivery.textContent).toContain('BDT');

    const fee = delivery.querySelectorAll<HTMLInputElement>('input')[0];
    const estimate = delivery.querySelectorAll<HTMLInputElement>('input')[1];
    const form = delivery.querySelector('form')!;
    expect(fee.value).toBe('50.00');
    enterValue(fee, '12.345');
    enterValue(estimate, 'x'.repeat(51));
    submitCatalogForm(form);
    harness.detectChanges();
    http.expectNone({ method: 'PUT', url: deliveryUrl });
    expect(delivery.textContent).toContain('up to two decimal places');
    expect(delivery.textContent).toContain('50 characters or fewer');

    enterValue(fee, '75.50');
    enterValue(estimate, '');
    submitCatalogForm(form);
    submitCatalogForm(form);
    const save = http.expectOne({ method: 'PUT', url: deliveryUrl });
    expect(save.request.headers.get('X-CSRF-Token')).toBe(businessSession.csrfToken);
    expect(save.request.body).toEqual({
      insideDhakaFee: '75.50', outsideDhakaFee: '100.00',
      insideDhakaDeliveryDays: null, outsideDhakaDeliveryDays: '3–4 days',
    });
    http.expectNone({ method: 'PUT', url: '/api/business/settings' });
    http.expectNone({ method: 'PUT', url: '/api/business/ai-schedules' });
    save.flush({}, { status: 500, statusText: 'Server Error' });
    harness.detectChanges();
    expect(fee.value).toBe('75.50');
    expect(delivery.textContent).toContain('Your edits are still here');

    submitCatalogForm(form);
    http.expectOne({ method: 'PUT', url: deliveryUrl })
      .flush({ ...deliveryFixture, insideDhakaFee: '75.50', insideDhakaDeliveryDays: null });
    harness.detectChanges();
    expect(delivery.textContent).toContain('Delivery settings saved.');
  });

  it('validates and saves the variant selling mode and measurement', async () => {
    await restore(businessSession);
    const harness = await RouterTestingHarness.create('/business-admin/products/new');
    flushTaxonomyOptions();
    harness.detectChanges();
    const page = harness.routeNativeElement!;
    clickText(page, 'Add variant');
    harness.detectChanges();
    setField(page, 'name', 'Loose dates');
    setField(page, 'sku', 'DATES-LOOSE');
    setField(page, 'price', '650');
    setField(page, 'stockQty', '20');
    const change = (field: string, value: string) => {
      const select = page.querySelector<HTMLSelectElement>(`[formControlName=${field}]`)!;
      select.value = value;
      select.dispatchEvent(new Event('change'));
    };
    change('sellingMode', 'by_measure');
    submitCatalogForm(page.querySelector('form')!);
    harness.detectChanges();
    expect(page.textContent).toContain('Pieces require packaged mode');
    http.expectNone({ method: 'POST', url: catalogUrl });

    change('measurementUnit', 'kg');
    setField(page, 'measurementValue', '0.125');
    submitCatalogForm(page.querySelector('form')!);
    const request = http.expectOne({ method: 'POST', url: catalogUrl });
    expect(request.request.body.variants[0]).toEqual({
      sku: 'DATES-LOOSE', variantName: null, price: '650', stockQty: 20, isActive: true,
      sellingMode: 'by_measure', measurementUnit: 'kg', measurementValue: '0.125',
    });
    request.flush({}, { status: 500, statusText: 'Server Error' });
  });
});
