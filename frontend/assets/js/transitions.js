// Page transitions, scroll reveals and the nav tab indicator, shared by every page.
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const native = 'onpagereveal' in window; // cross-document View Transitions supported
  const root = document.documentElement;

  // ---- arrival
  if (!native && !reduce) {
    root.classList.add('page-entering');
    setTimeout(() => root.classList.remove('page-entering'), 700);
  }
  const bar = document.createElement('div');
  bar.className = 'page-bar';
  document.body.appendChild(bar);

  // ---- leaving (fallback only; native transitions handle themselves)
  document.addEventListener('click', e => {
    if (native || reduce || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !/\.html$|\/$/.test(url.pathname)) return;
    if (url.pathname === location.pathname && url.hash) return; // in-page anchor
    e.preventDefault();
    root.classList.add('page-leaving');
    setTimeout(() => { location.href = url.href; }, 230);
  });
  window.addEventListener('pageshow', ev => { if (ev.persisted) root.classList.remove('page-leaving'); });

  // ---- nav tab indicator
  function inkFor(container) {
    const current = container.querySelector('[aria-current=page]');
    if (!current) return;
    container.style.position = 'relative';
    const ink = document.createElement('span');
    ink.className = 'nav-ink';
    container.appendChild(ink);
    const place = el => { ink.style.left = `${el.offsetLeft}px`; ink.style.width = `${el.offsetWidth}px`; };
    place(current);
    container.querySelectorAll('a').forEach(a => {
      a.addEventListener('mouseenter', () => place(a));
      a.addEventListener('focus', () => place(a));
    });
    container.addEventListener('mouseleave', () => place(current));
    addEventListener('resize', () => place(current));
  }
  document.querySelectorAll('.nav .pages, .nav .links').forEach(inkFor);

  // ---- scroll reveal (only for things that start below the fold, so the first screen is never hidden)
  if (reduce || !('IntersectionObserver' in window)) return;
  const SEL = '.sec-head, .card, .tbl, .feat, .step, .pc, .dl a, .docs a, .code, .kpi, .counts > div, .beat, .pick, .score > div';
  const fold = innerHeight * 0.92;
  const targets = [...document.querySelectorAll(SEL)].filter(el => el.getBoundingClientRect().top > fold && !el.closest('.reveal-pending'));
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target;
      const sibs = [...el.parentElement.children].filter(c => c.classList.contains('reveal-pending'));
      el.style.setProperty('--rd', `${Math.min(5, Math.max(0, sibs.indexOf(el))) * 70}ms`);
      el.classList.remove('reveal-pending');
      el.classList.add('revealed');
      io.unobserve(el);
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  targets.forEach(el => { el.classList.add('reveal-pending'); io.observe(el); });
  // Safety net: never leave anything hidden.
  setTimeout(() => document.querySelectorAll('.reveal-pending').forEach(el => { el.classList.remove('reveal-pending'); el.classList.add('revealed'); }), 12000);
})();
