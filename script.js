/* A small, dependency-free interaction layer for the research portfolio. */
(() => {
  'use strict';
  document.documentElement.classList.add('js');

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  const menuButton = document.querySelector('[data-menu-toggle]');
  const navigation = document.getElementById('navigation');
  const closeMenu = () => {
    menuButton?.setAttribute('aria-expanded', 'false');
    navigation?.classList.remove('is-open');
  };
  menuButton?.addEventListener('click', () => {
    const expanded = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!expanded));
    navigation.classList.toggle('is-open', !expanded);
  });
  navigation?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      menuButton.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.site-header')) closeMenu();
  });

  // Keep the active section legible without changing keyboard focus or history.
  if ('IntersectionObserver' in window) {
    const navigationLinks = [...document.querySelectorAll('[data-section-link]')];
    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navigationLinks.forEach(link => {
          if (link.hash === '#' + entry.target.id) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-15% 0px -60% 0px', threshold: 0 });
    navigationLinks.forEach(link => {
      const section = document.querySelector(link.hash);
      if (section) sectionObserver.observe(section);
    });
  }

  // Demos stay on demand; only one recording plays at a time.
  const videos = [...document.querySelectorAll('video')];
  videos.forEach(video => video.addEventListener('play', () => {
    videos.forEach(other => { if (other !== video) other.pause(); });
  }));
  document.querySelectorAll('details').forEach(details => {
    details.addEventListener('toggle', () => {
      if (!details.open) details.querySelectorAll('video').forEach(video => video.pause());
    });
  });

  const canvas = document.getElementById('perception-field');
  const context = canvas?.getContext('2d');
  if (!context) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pauseButton = document.querySelector('[data-motion-toggle]');
  const field = document.querySelector('.instrument-field');
  const fieldCaption = document.getElementById('field-caption');
  const fieldCode = document.getElementById('field-code');
  const modeButtons = [...document.querySelectorAll('[data-field-mode]')];
  const modes = {
    perception: { code: '01 / PERCEPTION', caption: 'How do we perceive the space around us?', color: [231, 143, 80] },
    immersion: { code: '02 / IMMERSION', caption: 'How can a virtual world respond to our attention?', color: [188, 202, 159] },
    embodiment: { code: '03 / EMBODIMENT', caption: 'How can human behavior inform robot learning?', color: [231, 143, 80] }
  };
  let mode = 'perception';
  let width = 0;
  let height = 0;
  let rotation = 0.4;
  let frame = 0;
  let lastTime = 0;
  let isVisible = true;
  let paused = reducedMotion.matches;
  let pointer = { x: 0.5, y: 0.5, active: false };

  function project(x, y, z) {
    const angle = rotation + (pointer.x - 0.5) * 0.3;
    const rx = x * Math.cos(angle) - z * Math.sin(angle);
    const rz = x * Math.sin(angle) + z * Math.cos(angle);
    const tilt = -0.23 + (pointer.y - 0.5) * 0.15;
    const ry = y * Math.cos(tilt) - rz * Math.sin(tilt);
    const depth = y * Math.sin(tilt) + rz * Math.cos(tilt);
    const scale = Math.min(width * 0.365, height * 0.36) * (3.8 / (3.8 - depth));
    return { x: width / 2 + rx * scale, y: height / 2 + ry * scale, depth };
  }

  function point(u, v) {
    if (mode === 'immersion') {
      const radius = 0.73 + 0.27 * Math.cos(v);
      return project(radius * Math.cos(u), 0.38 * Math.sin(v), radius * Math.sin(u));
    }
    if (mode === 'embodiment') {
      const radius = 0.82 + 0.12 * Math.sin(3 * u + v * 2);
      return project(radius * Math.sin(v) * Math.cos(u), 1.08 * Math.cos(v), radius * Math.sin(v) * Math.sin(u));
    }
    return project(Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u));
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    const [r, g, b] = modes[mode].color;
    const color = alpha => `rgba(${r},${g},${b},${alpha})`;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width * 0.43, height * 0.43);

    // Fine crosshairs and a circular scale recall plotting instruments.
    context.strokeStyle = 'rgba(196,205,169,0.16)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(centerX, 22); context.lineTo(centerX, height - 22);
    context.moveTo(22, centerY); context.lineTo(width - 22, centerY);
    context.stroke();
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.stroke();
    for (let tick = 0; tick < 72; tick++) {
      const a = tick / 72 * Math.PI * 2;
      const length = tick % 6 === 0 ? 8 : 3;
      context.beginPath();
      context.moveTo(centerX + Math.cos(a) * radius, centerY + Math.sin(a) * radius);
      context.lineTo(centerX + Math.cos(a) * (radius + length), centerY + Math.sin(a) * (radius + length));
      context.stroke();
    }

    const rows = mode === 'immersion' ? 20 : 22;
    const columns = 40;
    const vRange = mode === 'immersion' ? Math.PI * 2 : Math.PI;
    const points = [];
    for (let row = 0; row <= rows; row++) {
      const ring = [];
      for (let column = 0; column <= columns; column++) {
        ring.push(point(column / columns * Math.PI * 2, row / rows * vRange));
      }
      points.push(ring);
    }
    function connect(a, b) {
      context.strokeStyle = color(0.16 + Math.max(0, (a.depth + b.depth) / 2 + 1) * 0.23);
      context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
    }
    context.lineWidth = 0.8;
    points.forEach((ring, row) => ring.forEach((p, column) => {
      if (column < columns) connect(p, ring[column + 1]);
      if (row < rows && column % 2 === 0) connect(p, points[row + 1][column]);
      if (row % 3 === 0 && column % 4 === 0 && p.depth > 0) {
        context.fillStyle = color(0.9);
        context.fillRect(p.x - 1.4, p.y - 1.4, 2.8, 2.8);
      }
    }));

    // The focus marker follows input; it is a conceptual pointer, not eye tracking.
    const focusX = pointer.active ? pointer.x * width : width * 0.65;
    const focusY = pointer.active ? pointer.y * height : height * 0.37;
    context.strokeStyle = 'rgba(240,237,218,0.75)';
    context.lineWidth = 1;
    context.beginPath(); context.arc(focusX, focusY, 12, 0, Math.PI * 2); context.stroke();
    context.beginPath();
    context.moveTo(focusX - 19, focusY); context.lineTo(focusX - 8, focusY);
    context.moveTo(focusX + 8, focusY); context.lineTo(focusX + 19, focusY);
    context.moveTo(focusX, focusY - 19); context.lineTo(focusX, focusY - 8);
    context.moveTo(focusX, focusY + 8); context.lineTo(focusX, focusY + 19);
    context.stroke();
  }

  function animate(time) {
    frame = 0;
    if (paused || !isVisible || document.hidden) return;
    if (lastTime) rotation += Math.min(time - lastTime, 50) * 0.00012;
    lastTime = time;
    draw();
    frame = requestAnimationFrame(animate);
  }
  function syncAnimation() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    draw();
    if (!paused && isVisible && !document.hidden) frame = requestAnimationFrame(animate);
    pauseButton.textContent = paused ? 'Play motion' : 'Pause motion';
    pauseButton.setAttribute('aria-pressed', String(paused));
  }
  function resize() {
    const bounds = field.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }
  field.addEventListener('pointermove', event => {
    const bounds = field.getBoundingClientRect();
    pointer = { x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height, active: true };
    if (paused || reducedMotion.matches) draw();
  }, { passive: true });
  field.addEventListener('pointerleave', () => {
    pointer = { x: 0.5, y: 0.5, active: false };
    if (paused) draw();
  });
  modeButtons.forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.fieldMode;
    modeButtons.forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    fieldCode.textContent = modes[mode].code;
    fieldCaption.textContent = modes[mode].caption;
    draw();
  }));
  pauseButton.addEventListener('click', () => { paused = !paused; syncAnimation(); });
  reducedMotion.addEventListener('change', () => { paused = reducedMotion.matches; syncAnimation(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) videos.forEach(video => video.pause());
    syncAnimation();
  });
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(field);
  else window.addEventListener('resize', resize);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      isVisible = entries[0].isIntersecting;
      syncAnimation();
    }).observe(canvas);
  }
  resize();
  syncAnimation();
})();
