(() => {
  if (
    location.hostname !== 'alainnicolas.fr' ||
    !/^\/(efrogs|discord|strava)(\/|$)/.test(location.pathname)
  )
    return;
  const id = 'G-XRJBN4S6Y7';
  const key = 'analytics-consent';
  const lifetime = 183 * 24 * 60 * 60 * 1000;
  let loaded = false;
  let lastPath = '';
  const choice = () => {
    try {
      const data = JSON.parse(localStorage.getItem(key));
      if (
        data?.version === 1 &&
        data.date <= Date.now() &&
        Date.now() - data.date < lifetime
      )
        return data.value;
    } catch {}
    return null;
  };
  const banner = document.createElement('section');
  banner.setAttribute('aria-label', 'Analytics preferences');
  banner.style.cssText =
    'position:fixed;z-index:99999;bottom:0;left:0;right:0;padding:16px;background:#fff;color:#111;box-shadow:0 0 8px #0005;font:16px sans-serif';
  banner.innerHTML =
    '<p>Allow Google Analytics to measure visits?</p><button type="button" data-reject>Reject</button> <button type="button" data-accept>Accept</button>';
  const settings = document.createElement('button');
  settings.type = 'button';
  settings.textContent = 'Analytics preferences';
  settings.style.cssText =
    'position:fixed;z-index:99998;bottom:4px;right:4px;font:12px sans-serif';
  document.body.append(banner, settings);
  const page = () => {
    if (
      !loaded ||
      location.pathname === lastPath ||
      /\/oauth\/?$/.test(location.pathname)
    )
      return;
    lastPath = location.pathname;
    window.gtag('event', 'page_view', {
      page_location: location.origin + location.pathname,
      page_referrer: '',
    });
  };
  const start = () => {
    if (loaded) return;
    const params = new URLSearchParams(location.search);
    if (
      params.has('code') ||
      params.has('state') ||
      /\/oauth\/?$/.test(location.pathname)
    )
      return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    window.gtag('js', new Date());
    window.gtag('config', id, {
      send_page_view: false,
      page_location: location.origin + location.pathname,
      page_referrer: '',
    });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    document.head.append(script);
    page();
  };
  const setChoice = (value) => {
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ value, date: Date.now(), version: 1 }),
      );
    } catch {}
    if (value === 'accepted') {
      banner.hidden = true;
      start();
    } else {
      window[`ga-disable-${id}`] = true;
      document.cookie.split(';').forEach((entry) => {
        const name = entry.trim().split('=')[0];
        if (name === '_ga' || name.startsWith('_ga_')) {
          for (const domain of [
            '',
            `; domain=${location.hostname}`,
            `; domain=.${location.hostname}`,
          ]) {
            document.cookie = `${name}=; max-age=0; path=/${domain}; SameSite=Lax`;
          }
        }
      });
      location.reload();
    }
  };
  banner
    .querySelector('[data-accept]')
    .addEventListener('click', () => setChoice('accepted'));
  banner
    .querySelector('[data-reject]')
    .addEventListener('click', () => setChoice('rejected'));
  settings.addEventListener('click', () => {
    banner.hidden = false;
  });
  window.addEventListener('storage', (event) => {
    if (event.key === key) location.reload();
  });
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      if (choice() === 'accepted' && !loaded) start();
      page();
      return result;
    };
  }
  window.addEventListener('popstate', page);
  const current = choice();
  banner.hidden = current !== null;
  if (current === 'accepted') start();
})();
