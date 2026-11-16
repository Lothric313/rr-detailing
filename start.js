// Keep reloads out of the middle of the scroll-driven desktop scene.
history.scrollRestoration = 'manual';
const isReload = performance.getEntriesByType('navigation')[0]?.type === 'reload';
if (isReload && location.hash) history.replaceState(history.state, '', location.pathname + location.search);
if (isReload) window.scrollTo({ top: 0, behavior: 'instant' });

window.rrMobile = matchMedia('(max-width: 800px)');
if (!window.rrMobile.matches) {
  document.documentElement.classList.add('has-preloader', 'is-loading');
  const deadline = window.setTimeout(() => window.finishCarLoading(), 20000);
  window.finishCarLoading = () => {
    if (window.carLoadingFinished) return;
    window.carLoadingFinished = true;
    clearTimeout(deadline);
    document.documentElement.classList.remove('is-loading');
    window.dispatchEvent(new Event('car-loading-finished'));
    const preloader = document.querySelector('.site-preloader');
    if (preloader) {
      preloader.classList.add('is-finished');
      window.setTimeout(() => preloader.remove(), 600);
    }
  };
  window.rrMobile.addEventListener('change', event => {
    if (event.matches) window.finishCarLoading();
  });
}
