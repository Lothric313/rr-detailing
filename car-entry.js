(() => {
  const mobile = window.rrMobile;
  function loadScene() {
    if (mobile.matches) return;
    mobile.removeEventListener('change', loadScene);
    import('./car-scene.js?v=mobile-1').catch(error => {
      console.error('Не удалось запустить 3D-сцену', error);
      window.finishCarLoading?.();
      document.querySelector('#scene-loading').hidden = true;
    });
  }
  mobile.addEventListener('change', loadScene);
  loadScene();
})();
