import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from './app.routes';

describe('App routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });

  it('renders the business admin sign-in page at the root URL', async () => {
    const harness = await RouterTestingHarness.create('/');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent)
      .toContain('Business Admin sign in');
  });

  it('shows each role its own dashboard sections and opens the linked placeholders', async () => {
    const harness = await RouterTestingHarness.create();
    const roles = [
      { path: 'super-admin', sections: ['businesses', 'users'] },
      { path: 'business-admin', sections: ['products', 'inventory', 'conversations', 'orders', 'ai-settings'] },
    ];

    for (const role of roles) {
      await harness.navigateByUrl(`/${role.path}/login`);
      const preview = harness.routeNativeElement?.querySelector<HTMLAnchorElement>('a.preview');
      expect(preview?.getAttribute('href')).toBe(`/${role.path}/dashboard`);

      await harness.navigateByUrl(`/${role.path}/dashboard`);
      const dashboard = harness.routeNativeElement!;
      const links = Array.from(dashboard.querySelectorAll('main nav a'), (link) => link.getAttribute('href'));
      expect(links).toEqual(role.sections.map((section) => `/${role.path}/${section}`));

      for (const link of links) {
        await harness.navigateByUrl(link!);
        expect(harness.routeNativeElement?.querySelector('main h2')?.textContent)
          .toContain('Awaiting API integration');
      }
    }
  });
});
