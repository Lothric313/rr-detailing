(() => {
  const section = document.querySelector('#works');
  const gallery = section.querySelector('.portfolio-gallery');
  const grid = section.querySelector('.portfolio-grid');
  const { categories, works } = window.RRPortfolio;
  const mobile = window.rrMobile;
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = motionPreference.matches;
  const wrap = n => ((n % works.length) + works.length) % works.length;
  let position = 0, target = 0, openAmount = 0, isOpen = false, active = 0;
  let frame = 0, lastTime = 0, drag = null, suppressClick = false;
  let visible = false;
  let savedOverflow = null, previousFocus = null;
  let opening = null;


  // Additional views from the same Telegram album, excluding each cover.
  const albums = {
    371: [2, 4], 565: [3, 2, 5], 466: [1, 3, 5, 7], 576: [1, 3],
    445: [1], 572: [1, 3], 362: [4, 5], 538: [3, 4],
    416: [4, 6, 8, 3, 7], 448: [1, 3, 4], 546: [2, 3],
    395: [3, 5, 8, 7, 2], 453: [3, 2, 4], 342: [3, 1],
  };

  const reelDuration = 320;
  let albumState = null;
  let horizontalWheel = 0, lastHorizontalWheel = -Infinity, lastWorkStep = -Infinity;

  function clearAlbum() {
    if (!albumState) return;
    const {card, stack, animations} = albumState;
    finishReveal(albumState);
    stack.setAttribute('aria-hidden', 'true');
    for (const animation of animations) animation.cancel();
    stack.classList.add('is-leaving');
    setTimeout(() => stack.remove(), reduced ? 0 : 260);
    card.classList.remove('has-album');
    albumState = null;
  }

  function showAlbum(index) {
    clearAlbum();
    const work = works[index], card = cards[index];
    const post = work.source?.split('/').pop();
    const extra = albums[post];
    if (!extra?.length) return;
    const photos = [work.poster || work.file, ...extra.map(n => 'portfolio/albums/' + post + '-' + n + '.jpg')];
    const stack = document.createElement('div');
    stack.className = 'album-stack';
    stack.setAttribute('role', 'img');
    const depth = photos.length >= 5 ? 2 : 1;
    const album = {card, work, stack, photos, depth, current: 0, moving: false, pending: [], animations: [], reveal: [], wheelDelta: 0, lastWheel: -Infinity};
    albumState = album;
    labelPhoto(album);
    for (let slot = -depth; slot <= depth; slot++) addFrame(album, slot, slot);
    card.prepend(stack);
    card.classList.add('has-album');
    if (reduced) return;
    for (const frame of stack.children) {
      const distance = Math.abs(Number(frame.dataset.slot));
      if (!distance) continue;
      album.reveal.push(frame.animate(
        [{transform: 'translateY(0) scale(.97)', opacity: 0}, frameAppearance(frame)],
        {duration: 380 + distance * 55, easing: 'cubic-bezier(.2,.76,.28,1)'}
      ));
    }
  }

  function finishReveal(album) {
    for (const animation of album.reveal) animation.cancel();
    album.reveal = [];
  }

  function wrapPhoto(album, index) {
    return ((index % album.photos.length) + album.photos.length) % album.photos.length;
  }

  function addFrame(album, slot, index) {
    const frame = document.createElement('img');
    frame.className = 'album-frame';
    frame.alt = '';
    frame.draggable = false;
    frame.src = album.photos[wrapPhoto(album, index)];
    placeFrame(frame, slot);
    album.stack.append(frame);
    return frame;
  }

  function placeFrame(frame, slot) {
    frame.dataset.slot = slot;
    paintFrame(frame, slot);
    frame.style.opacity = Math.abs(slot) > 2 ? 0 : 1;
  }

  function paintFrame(frame, slot) {
    const distance = Math.min(Math.abs(slot), 3);
    const brightness = [1, .57, .34, .25];
    const near = Math.floor(distance), far = Math.ceil(distance);
    const light = brightness[near] + (brightness[far] - brightness[near]) * (distance - near);
    frame.style.setProperty('--reel-y', (slot * 10) + '%');
    frame.style.setProperty('--reel-scale', 1 - distance * .065);
    frame.style.setProperty('--reel-light', light);
    frame.style.zIndex = 100 - Math.round(distance * 20);
  }

  function previewDrag(album, distance) {
    if (album.moving) return;
    finishReveal(album);
    const step = Math.max(1, album.stack.getBoundingClientRect().height * .1);
    const progress = .64 * distance / (Math.abs(distance) + step * .55);
    for (const frame of album.stack.children) {
      paintFrame(frame, Number(frame.dataset.slot) + progress);
    }
  }

  function labelPhoto(album) {
    album.stack.setAttribute('aria-label', album.work.title + ' — фото ' + (album.current + 1));
  }

  function frameAppearance(frame) {
    const {transform, filter, opacity, zIndex} = getComputedStyle(frame);
    return {transform, filter, opacity, zIndex};
  }

  function settleAlbum(album, direction) {
    if (album.moving) {
      if (direction) album.pending.push(direction);
      return;
    }
    finishReveal(album);
    const {stack, depth} = album;
    if (direction) {
      const slot = (depth + 1) * direction;
      addFrame(album, slot, album.current + slot).style.opacity = 0;
      album.current = wrapPhoto(album, album.current + direction);
      labelPhoto(album);
    }
    const frames = Array.from(stack.children);
    const start = reduced ? [] : frames.map(frameAppearance);
    album.moving = true;
    stopVideo();
    for (const frame of frames) {
      const slot = Number(frame.dataset.slot) - direction;
      placeFrame(frame, slot);
      if (Math.abs(slot) > depth) frame.style.opacity = 0;
    }
    function finish() {
      if (album !== albumState) return;
      for (const frame of frames) {
        if (Math.abs(Number(frame.dataset.slot)) > depth) frame.remove();
      }
      album.animations = [];
      album.moving = false;
      const next = album.pending.shift();
      if (next) settleAlbum(album, next);
      else if (album.current === 0 && album.work.type === 'video') showVideo(active);
    }
    if (reduced) {
      finish();
      return;
    }
    album.animations = frames.map((frame, index) => frame.animate(
      [start[index], frameAppearance(frame)],
      {duration: reelDuration, easing: 'cubic-bezier(.22,.72,.28,1)'}
    ));
    Promise.allSettled(album.animations.map(animation => animation.finished)).then(finish);
  }

  const close = document.createElement('button');
  close.type = 'button'; close.className = 'gallery-close'; close.setAttribute('aria-label', 'Закрыть просмотр'); close.textContent = '×';
  gallery.append(close);

  function stopVideo() {
    grid.querySelectorAll('video').forEach(video => { video.pause(); video.remove(); });
  }
  function showVideo(index) {
    stopVideo();
    const work = works[index];
    if (!isOpen || work.type !== 'video') return;
    const video = document.createElement('video');
    video.src = work.file; video.poster = work.poster; video.muted = true; video.defaultMuted = true; video.autoplay = true; video.loop = true; video.playsInline = true; video.preload = 'auto';
    video.setAttribute('aria-label', work.title);
    video.addEventListener('click', event => event.stopPropagation());
    cards[index].querySelector('.portfolio-preview').append(video);
    video.play().catch(() => {});
  }
  function nearestSlot(index) {
    const base = Math.round(target);
    let delta = wrap(index - wrap(base));
    if (delta > works.length / 2) delta -= works.length;
    return base + delta;
  }
  function setActive(index) {
    index = wrap(index);
    if (active === index) return;
    active = index;
    if (isOpen) { showVideo(active); showAlbum(active); }
  }
  function open(index) {
    if (opening || isOpen) return;
    const startY = window.scrollY;
    const rect = gallery.getBoundingClientRect();
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const destination = Math.max(0, Math.min(maxY, startY + rect.top + rect.height / 2 - window.innerHeight / 2));
    const focus = document.activeElement;
    const duration = reduced ? 0 : Math.min(650, Math.max(280, Math.abs(destination - startY) * .55));
    const request = {frame: 0};
    opening = request;
    target = nearestSlot(index);
    wake();

    function activate() {
      if (opening !== request) return;
      opening = null;
      window.scrollTo({top: destination, behavior: 'instant'});
      active = wrap(index);
      isOpen = true;
      previousFocus = focus;
      savedOverflow = {body: document.body.style.overflow, html: document.documentElement.style.overflow};
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      gallery.classList.add('is-open');
      gallery.setAttribute('role', 'dialog');
      gallery.setAttribute('aria-modal', 'true');
      close.tabIndex = 0;
      close.focus({preventScroll: true});
      showVideo(active);
      showAlbum(active);
      wake();
    }
    if (!duration || Math.abs(destination - startY) < 2) {
      activate();
      return;
    }
    let started;
    function scrollToGallery(now) {
      if (opening !== request) return;
      if (started === undefined) started = now;
      const progress = Math.min(1, (now - started) / duration);
      const ease = 1 - Math.pow(1 - progress, 3);
      window.scrollTo({top: startY + (destination - startY) * ease, behavior: 'instant'});
      if (progress < 1) request.frame = requestAnimationFrame(scrollToGallery);
      else activate();
    }
    request.frame = requestAnimationFrame(scrollToGallery);
  }

  function cancelOpening() {
    if (!opening) return;
    cancelAnimationFrame(opening.frame);
    opening = null;
    wake();
  }

  function closeGallery() {
    if (!isOpen) return;
    isOpen = false; gallery.classList.remove('is-open'); close.tabIndex = -1; stopVideo(); clearAlbum();
    gallery.setAttribute('role', 'region');
    gallery.removeAttribute('aria-modal');
    if (savedOverflow) {
      document.body.style.overflow = savedOverflow.body;
      document.documentElement.style.overflow = savedOverflow.html;
      savedOverflow = null;
    }
    if (previousFocus && previousFocus.isConnected) previousFocus.focus({preventScroll: true});
    previousFocus = null;
    wake();
  }
  close.addEventListener('click', closeGallery); close.tabIndex = -1;
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (opening) { event.preventDefault(); cancelOpening(); return; }
    if (!isOpen || gallery.contains(event.target)) return;
    event.preventDefault();
    closeGallery();
  });

  const cards = works.map((work, index) => {
    const card = document.createElement('div'); card.className = 'portfolio-card';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'portfolio-card-button';
    button.setAttribute('aria-label', `${work.type === 'video' ? 'Смотреть видео' : 'Открыть фото'}: ${work.title}`);
    const preview = document.createElement('span'); preview.className = 'portfolio-preview';
    const image = document.createElement('img');
    const nearInitialCard = index <= 2 || index >= works.length - 2;
    image.decoding = 'async';
    image.fetchPriority = nearInitialCard ? 'auto' : 'low';
    image.loading = mobile.matches ? 'lazy' : 'eager';
    image.src = work.poster || work.file;
    image.alt = '';
    image.draggable = false;
    preview.append(image);
    if (work.type === 'video') { const play = document.createElement('span'); play.className = 'portfolio-play'; play.setAttribute('aria-hidden', 'true'); preview.append(play); }
    const caption = document.createElement('span'); caption.className = 'portfolio-caption';
    const category = document.createElement('strong'); category.textContent = categories[work.category].label;
    const name = document.createElement('span'); name.className = 'portfolio-detail'; name.textContent = work.title;
    caption.append(category, name); button.append(preview, caption); card.append(button); grid.append(card);
    button.addEventListener('click', event => {
      if (suppressClick && event.detail) return;
      if (mobile.matches && isOpen) return;
      if (isOpen && index === active) closeGallery();
      else open(index);
    });
    button.addEventListener('focus', () => {
      if (mobile.matches && isOpen) return;
      if (drag || (mobile.matches && !button.matches(':focus-visible'))) return;
      target = nearestSlot(index);
      if (isOpen) setActive(index);
      wake();
    });
    return card;
  });

  function cardSpacing() {
    if (mobile.matches) return cards[0].offsetWidth + 12;
    return gallery.clientWidth >= 900 ? gallery.clientWidth * .19 : cards[0].offsetWidth * (gallery.clientWidth < 600 ? 1.2 : 1.32);
  }
  let drawnPosition, drawnOpenAmount, drawnActive, drawnIsOpen;
  function draw() {
    drawnPosition = position;
    drawnOpenAmount = openAmount;
    drawnActive = active;
    drawnIsOpen = isOpen;
    const width = gallery.clientWidth;
    const cardWidth = cards[0].offsetWidth;
    const spacing = cardSpacing();
    const flat = mobile.matches;
    cards.forEach((card, index) => {
      const offset = wrap(index - position + works.length / 2) - works.length / 2;
      const x = offset * spacing;
      if (flat && !isOpen) {
        card.style.transform = `translateX(calc(-50% + ${x}px))`;
        card.style.opacity = '1';
        return;
      }
      const radius = Math.max(width * 1.8, spacing * 3.2);
      const angle = Math.asin(Math.max(-1, Math.min(1, x / radius)));
      const arcY = radius * (1 - Math.cos(angle));
      const focus = index === active ? openAmount : 0;
      const scale = 1 + focus * (width < 600 ? .12 : .2);
      card.style.transform = `translate(-50%, -50%) translate(${x}px, ${arcY * (1 - focus)}px) rotate(${angle * (1 - focus)}rad) scale(${scale})`;
      const edge = Math.max(0, Math.min(1, (width / 2 + cardWidth * .25 - Math.abs(x)) / (cardWidth * .55)));
      card.style.opacity = String(edge * (index === active ? 1 : 1 - openAmount * .92));
      card.style.zIndex = String(index === active && isOpen ? 20 : 10 - Math.round(Math.abs(offset)));
      card.classList.toggle('is-focused', isOpen && index === active);
    });
  }
  function animate(now) {
    frame = 0;
    if ((!visible && !isOpen) || document.hidden) { lastTime = 0; return; }
    const dt = lastTime ? Math.min((now - lastTime) / 1000, .05) : 0; lastTime = now;
    const autoScroll = !isOpen && !opening && !reduced && !drag && !gallery.querySelector(':focus-visible') && !gallery.matches(':focus-visible');
    if (autoScroll) target += mobile.matches ? (24 * dt) / cardSpacing() : dt * .075;
    const follow = reduced ? 1 : 1 - Math.exp(-dt * 9);
    position += (target - position) * follow;
    openAmount += ((isOpen ? 1 : 0) - openAmount) * (reduced ? 1 : 1 - Math.exp(-dt * 8));
    if (Math.abs(target - position) < .0001) position = target;
    if (Math.abs((isOpen ? 1 : 0) - openAmount) < .001) openAmount = isOpen ? 1 : 0;
    if (position !== drawnPosition || openAmount !== drawnOpenAmount || active !== drawnActive || isOpen !== drawnIsOpen) draw();
    if (autoScroll || position !== target || openAmount !== (isOpen ? 1 : 0)) frame = requestAnimationFrame(animate);
    else lastTime = 0;
  }
  function wake() { if (!frame && (visible || isOpen) && !document.hidden) frame = requestAnimationFrame(animate); }
  function settle() { target = Math.round(target); if (isOpen) setActive(target); wake(); }
  gallery.addEventListener('keydown', e => {
    if (e.target instanceof HTMLVideoElement) return;
    if (e.key === 'Escape') { e.preventDefault(); closeGallery(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); if (mobile.matches && isOpen) return; target = Math.round(target) + (e.key === 'ArrowLeft' ? -1 : 1); if (isOpen) setActive(target); wake(); }
  });
  gallery.addEventListener('focusout', wake);
  motionPreference.addEventListener('change', event => {
    reduced = event.matches;
    wake();
  });
  window.addEventListener('wheel', cancelOpening, {passive: true});
  window.addEventListener('touchstart', cancelOpening, {passive: true});
  gallery.addEventListener('wheel', e => {
    if (!isOpen || drag || e.ctrlKey) return;
    const now = performance.now();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? gallery.clientHeight : 1;
    const horizontal = e.deltaX || (e.shiftKey ? e.deltaY : 0);
    if (horizontal && (e.shiftKey || Math.abs(horizontal) > Math.abs(e.deltaY))) {
      e.preventDefault();
      if (mobile.matches) return;
      if (now - lastHorizontalWheel > 160 || Math.sign(horizontal) !== Math.sign(horizontalWheel)) {
        horizontalWheel = 0;
      }
      lastHorizontalWheel = now;
      horizontalWheel += horizontal * unit;
      if (Math.abs(horizontalWheel) < 36 || now - lastWorkStep < 300) return;
      target = Math.round(target) + Math.sign(horizontalWheel);
      horizontalWheel = 0;
      lastWorkStep = now;
      setActive(target);
      wake();
      return;
    }
    const album = albumState;
    if (!album || !e.deltaY || !e.target.closest('.is-focused .portfolio-preview')) return;
    e.preventDefault();
    const delta = e.deltaY * unit;
    if (now - album.lastWheel > 160 || Math.sign(delta) !== Math.sign(album.wheelDelta)) {
      album.wheelDelta = 0;
    }
    album.lastWheel = now;
    album.wheelDelta += delta;
    if (Math.abs(album.wheelDelta) < 36 || album.moving) return;
    album.wheelDelta = 0;
    settleAlbum(album, Math.sign(delta));
  }, {passive: false});
  gallery.addEventListener('pointerdown', e => {
    if (drag || e.button !== 0 || e.target.closest('.gallery-close')) return;
    const album = isOpen && e.target.closest('.is-focused .portfolio-preview') ? albumState : null;
    if (!album && e.target.closest('video')) return;
    if (mobile.matches && !isOpen) target = position;
    drag = {
      id: e.pointerId, x: e.clientX, y: e.clientY, start: target, axis: null,
      album,
    };
    suppressClick = false;
  });
  function dragAxis(album, dx, dy) {
    if (mobile.matches && isOpen && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) return 'blocked';
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) return 'horizontal';
    if (album && Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) return 'vertical';
    return null;
  }

  gallery.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.axis) {
      drag.axis = dragAxis(drag.album, dx, dy);
      if (!drag.axis) return;
      gallery.setPointerCapture(e.pointerId);
      gallery.classList.add('dragging');
      if (drag.axis === 'vertical') stopVideo();
    }
    if (drag.axis === 'vertical') {
      if (drag.album === albumState) previewDrag(drag.album, dy);
      return;
    }
    if (drag.axis === 'blocked') return;
    target = drag.start - dx / cardSpacing();
    if (isOpen) setActive(Math.round(target));
    wake();
  });
  function endDrag(e) {
    if (!drag || drag.id !== e.pointerId) return;
    const {album, x, y, start} = drag;
    const dx = e.clientX - x, dy = e.clientY - y;
    const released = e.type === 'pointerup';
    const axis = drag.axis || (released && dragAxis(album, dx, dy));
    drag = null;
    suppressClick = Boolean(axis);
    gallery.classList.remove('dragging');
    if (axis === 'blocked') { wake(); return; }
    if (axis === 'horizontal') {
      if (released) {
        target = start - dx / cardSpacing();
        if (isOpen && Math.abs(dx) >= 40 && Math.round(target) === Math.round(start)) {
          target = Math.round(start) - Math.sign(dx);
        }
      }
      if (mobile.matches && !reduced) wake();
      else settle();
      return;
    }
    if (axis === 'vertical' && album === albumState) {
      const direction = released && Math.abs(dy) >= 24 ? -Math.sign(dy) : 0;
      settleAlbum(album, direction);
    }
    wake();
  }
  gallery.addEventListener('pointerup', endDrag); gallery.addEventListener('pointercancel', endDrag);
  gallery.addEventListener('lostpointercapture', event => {
    if (event.target === gallery) endDrag(event);
  });
  gallery.addEventListener('click', e => { if (!suppressClick && (e.target === grid || e.target === gallery)) closeGallery(); });
  mobile.addEventListener('change', () => {
    if (mobile.matches) {
      cancelOpening();
      drag = null;
      suppressClick = false;
      gallery.classList.remove('dragging');
      closeGallery();
      openAmount = 0;
      cards.forEach(card => { card.style.zIndex = ''; card.classList.remove('is-focused'); });
    }
    draw();
    wake();
  });
  new ResizeObserver(draw).observe(gallery);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; lastTime = 0; if (visible) wake(); }).observe(gallery);
  document.addEventListener('visibilitychange', () => { lastTime = 0; wake(); });
  draw();
})();
