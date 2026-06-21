(() => {
  'use strict';

  /* ═══════════════════════════════════════════
     WORLD CONFIG
  ═══════════════════════════════════════════ */
  const SCENE_NATURAL_W = 736;
  const SCENE_NATURAL_H = 1308;
  const WORLD_W = 1320;
  const WORLD_H = Math.round(WORLD_W * (SCENE_NATURAL_H / SCENE_NATURAL_W));

  const FAIRY_W = 58;                 // on-screen sprite width (cursor-scale)
  const FAIRY_ASPECT = 344 / 260;      // sprite natural h/w
  const FAIRY_H = FAIRY_W * FAIRY_ASPECT;

  const MOVE_SPEED = 300;             // world px / second
  const CAMERA_LERP = 0.085;
  const TRIGGER_RADIUS = 95;          // world px — proximity to "discover" a checkpoint
  const EDGE_MARGIN = 42;             // keep fairy slightly inside the painted border

  /* ═══════════════════════════════════════════
     CHECKPOINT DATA
  ═══════════════════════════════════════════ */
  const CHECKPOINTS = [
    {
      id: 'about', type: 'about', icon: '⛩', label: 'Welcome',
      xPct: 60, yPct: 31,
    },
    {
      id: 'resume', type: 'resume', icon: '🏮', label: 'Résumé',
      xPct: 58, yPct: 42,
    },
    {
      id: 'certificate', type: 'certificate', icon: '🎴', label: 'Japanese Certificate',
      xPct: 25, yPct: 44,
    },
    {
      id: 'enchanted-forest', type: 'project', icon: '🌿', label: 'Enchanted Forest',
      xPct: 48, yPct: 49,
      repo: 'https://github.com/Kawaii-sama/affirmationGarden',
      tagline: 'A wellness garden of daily affirmations',
      desc: 'A full-stack MERN wellness app, built so every visit plants something kind in your day. The interface leans soft and botanical, while the backend handles users, streaks and saved affirmations behind the scenes.',
      tech: ['React', 'Node.js', 'Express', 'MongoDB', 'Vercel', 'Render', 'Railway'],
    },
    {
      id: 'device-management', type: 'project', icon: '🌸', label: 'Device Management',
      xPct: 58, yPct: 62,
      repo: 'https://github.com/Kawaii-sama/myDeviceManagement',
      tagline: 'Inventory & device tracking, kept tidy',
      desc: 'A MERN-based inventory and device-tracking platform with REST APIs and MongoDB-backed workflows for keeping tabs on hardware end to end — from check-in to assignment.',
      tech: ['React', 'Node.js', 'Express', 'MongoDB', 'REST API', 'Vercel', 'Render'],
    },
    {
      id: 'kawaii-catalog', type: 'project', icon: '🍡', label: 'Kawaii Catalog',
      xPct: 85, yPct: 64,
      repo: 'https://github.com/Kawaii-sama/KawaiiCatalogItem',
      tagline: 'A pastel little shelf for cataloguing items',
      desc: 'A kawaii-styled catalog app for organising and showcasing items with a soft, playful interface — built in the same pastel spirit as the rest of this scroll. Open the repository for the full build.',
      tech: ['JavaScript', 'MERN Stack'],
    },
    {
      id: 'slay-translator', type: 'project', icon: '🦋', label: 'Lingo · slayTranslator',
      xPct: 22, yPct: 77,
      repo: 'https://github.com/Kawaii-sama/slayTranslator',
      tagline: 'Speak every language of the heart',
      desc: 'A dreamy, shoujo-styled real-time translator with voice input, language swap, quick phrases, translation history, and a petal-soft light/dark theme — 35+ languages, powered by Google Translate.',
      tech: ['JavaScript', 'Web Speech API', 'Google Translate API', 'CSS'],
    },
    {
      id: 'contact', type: 'contact', icon: '🪷', label: "Journey's End",
      xPct: 47, yPct: 91,
    },
  ];

  /* ═══════════════════════════════════════════
     DOM REFS
  ═══════════════════════════════════════════ */
  const titleScreen = document.getElementById('title-screen');
  const beginBtn = document.getElementById('begin-btn');
  const gameRoot = document.getElementById('game-root');
  const viewportEl = document.getElementById('viewport');
  const worldEl = document.getElementById('world');
  const checkpointLayer = document.getElementById('checkpoint-layer');
  const fairyEl = document.getElementById('fairy');
  const trailCanvas = document.getElementById('trail-canvas');
  const trailCtx = trailCanvas.getContext('2d');
  const progressCountEl = document.getElementById('progress-count');
  const progressTotalEl = document.getElementById('progress-total');
  const proximityPrompt = document.getElementById('proximity-prompt');
  const proximityPromptText = document.getElementById('proximity-prompt-text');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalEl = document.getElementById('modal');
  const modalContent = document.getElementById('modal-content');
  const modalClose = document.getElementById('modal-close');
  const toastEl = document.getElementById('toast');
  const joystickBase = document.querySelector('.joystick__base');
  const joystickKnob = document.getElementById('joystick-knob');

  worldEl.style.setProperty('--world-w', WORLD_W + 'px');
  worldEl.style.setProperty('--world-h', WORLD_H + 'px');
  worldEl.style.width = WORLD_W + 'px';
  worldEl.style.height = WORLD_H + 'px';
  fairyEl.style.setProperty('--fairy-w', FAIRY_W + 'px');
  fairyEl.style.width = FAIRY_W + 'px';

  progressTotalEl.textContent = CHECKPOINTS.length;

  /* ═══════════════════════════════════════════
     BUILD CHECKPOINT MARKERS
  ═══════════════════════════════════════════ */
  const checkpointState = new Map(); // id -> { data, el, worldX, worldY, visited }

  CHECKPOINTS.forEach((cp) => {
    const el = document.createElement('div');
    el.className = 'checkpoint';
    el.style.left = cp.xPct + '%';
    el.style.top = cp.yPct + '%';
    el.dataset.id = cp.id;
    el.innerHTML = `
      <div class="checkpoint__ring">
        <span class="checkpoint__pulse" aria-hidden="true"></span>
        <span aria-hidden="true">${cp.icon}</span>
      </div>
      <span class="checkpoint__label">${cp.label}</span>
    `;
    el.addEventListener('click', () => openModal(cp.id));
    checkpointLayer.appendChild(el);

    checkpointState.set(cp.id, {
      data: cp,
      el,
      worldX: (cp.xPct / 100) * WORLD_W,
      worldY: (cp.yPct / 100) * WORLD_H,
      visited: false,
    });
  });

  /* ═══════════════════════════════════════════
     INPUT
  ═══════════════════════════════════════════ */
  const keys = Object.create(null);
  let joyVec = { x: 0, y: 0 };
  let gameStarted = false;

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      keys[k] = true;
      if (gameStarted) e.preventDefault();
    }
    if ((k === 'e' || k === 'enter') && gameStarted) {
      e.preventDefault();
      if (nearCheckpointId) openModal(nearCheckpointId);
    }
    if (k === 'escape') closeModal();
  }, { passive: false });

  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      keys[k] = false;
    }
  });

  function readKeyVector() {
    let x = 0, y = 0;
    if (keys['w'] || keys['arrowup']) y -= 1;
    if (keys['s'] || keys['arrowdown']) y += 1;
    if (keys['a'] || keys['arrowleft']) x -= 1;
    if (keys['d'] || keys['arrowright']) x += 1;
    return { x, y };
  }

  /* Touch joystick */
  let joyActive = false;
  let joyTouchId = null;
  const JOY_RADIUS = 40;

  function joyStart(clientX, clientY, id) {
    joyActive = true;
    joyTouchId = id;
    updateJoyKnob(0, 0);
  }
  function joyMove(clientX, clientY) {
    if (!joyActive) return;
    const rect = joystickBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > JOY_RADIUS) {
      dx = (dx / dist) * JOY_RADIUS;
      dy = (dy / dist) * JOY_RADIUS;
    }
    updateJoyKnob(dx, dy);
    joyVec = { x: dx / JOY_RADIUS, y: dy / JOY_RADIUS };
  }
  function joyEnd() {
    joyActive = false;
    joyTouchId = null;
    joyVec = { x: 0, y: 0 };
    updateJoyKnob(0, 0);
  }
  function updateJoyKnob(dx, dy) {
    joystickKnob.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
  }

  joystickBase.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    joyStart(t.clientX, t.clientY, t.identifier);
    e.preventDefault();
  }, { passive: false });

  window.addEventListener('touchmove', (e) => {
    if (!joyActive) return;
    for (const t of e.changedTouches) {
      if (t.identifier === joyTouchId) { joyMove(t.clientX, t.clientY); e.preventDefault(); }
    }
  }, { passive: false });

  window.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyTouchId) joyEnd();
    }
  });

  /* ═══════════════════════════════════════════
     CAMERA / FAIRY STATE
  ═══════════════════════════════════════════ */
  let fairyX = WORLD_W * 0.5;
  let fairyY = WORLD_H * 0.07;
  let camX = 0, camY = 0;
  let nearCheckpointId = null;
  let lastTime = performance.now();

  function viewportSize() {
    return { w: window.innerWidth, h: window.innerHeight };
  }

  function clampCamera(target, worldSize, viewSize) {
    if (worldSize <= viewSize) return (worldSize - viewSize) / 2;
    return Math.min(Math.max(target, 0), worldSize - viewSize);
  }

  function resizeCanvas() {
    trailCanvas.width = window.innerWidth * window.devicePixelRatio;
    trailCanvas.height = window.innerHeight * window.devicePixelRatio;
    trailCanvas.style.width = window.innerWidth + 'px';
    trailCanvas.style.height = window.innerHeight + 'px';
    trailCtx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  /* ═══════════════════════════════════════════
     PARTICLE TRAIL
  ═══════════════════════════════════════════ */
  const particles = [];
  let spawnAccumulator = 0;

  function spawnParticle(sx, sy, moving) {
    const angle = Math.random() * Math.PI * 2;
    const spread = moving ? 10 : 4;
    particles.push({
      x: sx + (Math.random() - 0.5) * 8,
      y: sy + (Math.random() - 0.5) * 8,
      vx: Math.cos(angle) * spread * 0.18,
      vy: Math.sin(angle) * spread * 0.18 - 6,
      life: 0,
      maxLife: 620 + Math.random() * 420,
      size: 1.6 + Math.random() * 2.4,
      hue: Math.random() < 0.5 ? '255,225,150' : '255,200,110',
    });
  }

  function updateAndDrawParticles(dt, sx, sy, moving) {
    spawnAccumulator += dt;
    const spawnInterval = moving ? 16 : 90;
    while (spawnAccumulator > spawnInterval) {
      spawnParticle(sx, sy, moving);
      spawnAccumulator -= spawnInterval;
    }

    trailCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    trailCtx.globalCompositeOperation = 'lighter';

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) { particles.splice(i, 1); continue; }
      p.x += p.vx * (dt / 16);
      p.y += p.vy * (dt / 16);
      p.vy += 0.002 * dt; // gentle gravity drift

      const t = p.life / p.maxLife;
      const alpha = Math.sin((1 - t) * Math.PI * 0.5) * 0.9;
      const size = p.size * (1.3 - t * 0.8);

      trailCtx.beginPath();
      const grad = trailCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 3.2);
      grad.addColorStop(0, `rgba(${p.hue},${alpha})`);
      grad.addColorStop(1, `rgba(${p.hue},0)`);
      trailCtx.fillStyle = grad;
      trailCtx.arc(p.x, p.y, size * 3.2, 0, Math.PI * 2);
      trailCtx.fill();

      trailCtx.beginPath();
      trailCtx.fillStyle = `rgba(255,250,225,${alpha})`;
      trailCtx.arc(p.x, p.y, size * 0.55, 0, Math.PI * 2);
      trailCtx.fill();
    }

    trailCtx.globalCompositeOperation = 'source-over';
  }

  /* ═══════════════════════════════════════════
     MAIN LOOP
  ═══════════════════════════════════════════ */
  function tick(now) {
    const dt = Math.min(now - lastTime, 48);
    lastTime = now;

    if (gameStarted && !isModalOpen) {
      const kv = readKeyVector();
      let vx = kv.x + joyVec.x;
      let vy = kv.y + joyVec.y;
      const mag = Math.hypot(vx, vy);
      const moving = mag > 0.05;
      if (moving) {
        vx /= mag; vy /= mag;
        const dist = MOVE_SPEED * (dt / 1000);
        fairyX += vx * dist;
        fairyY += vy * dist;
        fairyX = Math.min(Math.max(fairyX, EDGE_MARGIN), WORLD_W - EDGE_MARGIN);
        fairyY = Math.min(Math.max(fairyY, EDGE_MARGIN), WORLD_H - EDGE_MARGIN);
        fairyEl.classList.toggle('is-flipped', vx < -0.15);
      }

      const vp = viewportSize();
      const targetCamX = clampCamera(fairyX - vp.w / 2, WORLD_W, vp.w);
      const targetCamY = clampCamera(fairyY - vp.h / 2, WORLD_H, vp.h);
      camX += (targetCamX - camX) * CAMERA_LERP;
      camY += (targetCamY - camY) * CAMERA_LERP;

      worldEl.style.transform = `translate3d(${-camX}px, ${-camY}px, 0)`;
      fairyEl.style.transform = `translate3d(${fairyX - FAIRY_W / 2}px, ${fairyY - FAIRY_H * 0.5}px, 0)`;

      const screenX = fairyX - camX;
      const screenY = fairyY - camY + FAIRY_H * 0.18;
      updateAndDrawParticles(dt, screenX, screenY, moving);

      updateProximity(screenX, screenY - FAIRY_H * 0.3);
    }

    requestAnimationFrame(tick);
  }

  /* ═══════════════════════════════════════════
     PROXIMITY / DISCOVERY
  ═══════════════════════════════════════════ */
  const discovered = new Set();

  function updateProximity(fairyScreenX, fairyScreenY) {
    let closest = null;
    let closestDist = Infinity;

    checkpointState.forEach((cp) => {
      const dx = cp.worldX - fairyX;
      const dy = cp.worldY - fairyY;
      const dist = Math.hypot(dx, dy);
      const isNear = dist < TRIGGER_RADIUS;
      cp.el.classList.toggle('is-near', isNear);
      if (isNear && dist < closestDist) { closest = cp; closestDist = dist; }
      if (isNear && !discovered.has(cp.data.id)) {
        discovered.add(cp.data.id);
        progressCountEl.textContent = discovered.size;
        showToast(`✦ Discovered: ${cp.data.label}`);
      }
    });

    nearCheckpointId = closest ? closest.data.id : null;

    if (closest) {
      proximityPrompt.hidden = false;
      proximityPromptText.innerHTML = `Press <kbd>E</kbd> — ${closest.data.label}`;
      const cx = closest.worldX - camX;
      const cy = closest.worldY - camY;
      proximityPrompt.style.left = cx + 'px';
      proximityPrompt.style.top = cy + 'px';
    } else {
      proximityPrompt.hidden = true;
    }
  }

  /* ═══════════════════════════════════════════
     TOAST
  ═══════════════════════════════════════════ */
  let toastTimer = null;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    toastEl.classList.remove('is-showing');
    void toastEl.offsetWidth; // restart animation
    toastEl.classList.add('is-showing');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2400);
  }

  /* ═══════════════════════════════════════════
     MODAL CONTENT
  ═══════════════════════════════════════════ */
  let isModalOpen = false;

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderModal(cp) {
    const d = cp.data;
    if (d.type === 'about') {
      return `
        <p class="mc-eyebrow">⛩ Welcome traveller</p>
        <h2 id="modal-title" class="mc-title">Pratibha Aggarwal</h2>
        <p class="mc-tagline">Software Developer &amp; Engineer</p>
        <p class="mc-body">A Computer Science Engineering student at Chandigarh University (CGPA 7.22), building with the MERN stack, REST APIs and MongoDB, and shipping to modern cloud platforms. Lately also picking up Japanese, one Marugoto lesson at a time — and still finding time for 13+ dance competitions along the way.</p>
        <div class="mc-tags">
          ${['JavaScript','React','Node.js','Express','MongoDB','Java','C++','Python'].map(t => `<span class="mc-tag">${t}</span>`).join('')}
        </div>
        <p class="mc-body" style="margin-bottom:0;">Glide on through the scroll — every lantern below holds a project, a résumé or a small certificate of a language still being learned.</p>
      `;
    }
    if (d.type === 'resume') {
      return `
        <p class="mc-eyebrow">🏮 The pavilion archive</p>
        <h2 id="modal-title" class="mc-title">Résumé</h2>
        <p class="mc-tagline">Every leaf of experience, pressed onto one page</p>
        <p class="mc-body">A one-page summary of Pratibha's skills, projects, education and achievements — ready to download or open in a new tab.</p>
        <div class="mc-actions">
          <a class="mc-btn mc-btn--primary" href="assets/Pratibha_Resume.pdf" download>⬇ Download Résumé</a>
          <a class="mc-btn mc-btn--ghost" href="assets/Pratibha_Resume.pdf" target="_blank" rel="noopener">↗ Open in new tab</a>
        </div>
      `;
    }
    if (d.type === 'certificate') {
      return `
        <p class="mc-eyebrow">🎴 A small lantern, lit</p>
        <h2 id="modal-title" class="mc-title">Japanese Language Certificate</h2>
        <p class="mc-tagline">まるごと A1-1（かつどう）自習コース</p>
        <div class="mc-figure"><img src="assets/certificate_preview.jpg" alt="JF Japanese e-Learning Minato — Marugoto A1-1 (Katsudoo) Self-Study Course completion certificate for Pratibha Aggarwal, dated June 16, 2026" /></div>
        <p class="mc-body">Marugoto A1-1 (Katsudoo) Self-Study Course, completed via JF Japanese e-Learning <em>Minato</em> on June 16, 2026 — basic Japanese reading, listening and conversational understanding.</p>
        <div class="mc-actions">
          <a class="mc-btn mc-btn--primary" href="assets/Pratibha_Japanese_Certificate.pdf" download>⬇ Download Certificate</a>
        </div>
      `;
    }
    if (d.type === 'project') {
      return `
        <p class="mc-eyebrow">${d.icon} Checkpoint discovered</p>
        <h2 id="modal-title" class="mc-title">${escapeHtml(d.label)}</h2>
        <p class="mc-tagline">${escapeHtml(d.tagline)}</p>
        <p class="mc-body">${escapeHtml(d.desc)}</p>
        <div class="mc-tags">${d.tech.map(t => `<span class="mc-tag">${escapeHtml(t)}</span>`).join('')}</div>
        <div class="mc-actions">
          <a class="mc-btn mc-btn--primary" href="${d.repo}" target="_blank" rel="noopener">↗ View on GitHub</a>
        </div>
      `;
    }
    if (d.type === 'contact') {
      return `
        <p class="mc-eyebrow">🪷 The journey ends here, for now</p>
        <h2 id="modal-title" class="mc-title">Let's talk</h2>
        <p class="mc-tagline">Thank you for wandering the whole scroll</p>
        <div class="mc-list">
          <div class="mc-list-item"><span class="mc-list-icon">✉</span> <a href="mailto:pratibhaaggarwal32@gmail.com">pratibhaaggarwal32@gmail.com</a></div>
          <div class="mc-list-item"><span class="mc-list-icon">☎</span> +91 6378344107</div>
          <div class="mc-list-item"><span class="mc-list-icon">📍</span> Chandigarh, India</div>
          <div class="mc-list-item"><span class="mc-list-icon">⌥</span> <a href="https://github.com/Kawaii-sama" target="_blank" rel="noopener">github.com/Kawaii-sama</a></div>
        </div>
        <div class="mc-divider"></div>
        <div class="mc-actions">
          <a class="mc-btn mc-btn--primary" href="mailto:pratibhaaggarwal32@gmail.com">✉ Send an email</a>
        </div>
      `;
    }
    return '';
  }

  function openModal(id) {
    const cp = checkpointState.get(id);
    if (!cp) return;
    cp.visited = true;
    cp.el.classList.add('is-visited');
    if (!discovered.has(id)) {
      discovered.add(id);
      progressCountEl.textContent = discovered.size;
    }
    modalContent.innerHTML = renderModal(cp);
    modalBackdrop.hidden = false;
    requestAnimationFrame(() => modalBackdrop.classList.add('is-open'));
    isModalOpen = true;
    modalClose.focus();
  }

  function closeModal() {
    if (!isModalOpen) return;
    modalBackdrop.classList.remove('is-open');
    isModalOpen = false;
    setTimeout(() => { modalBackdrop.hidden = true; }, 280);
  }

  modalClose.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });

  /* ═══════════════════════════════════════════
     START
  ═══════════════════════════════════════════ */
  function beginJourney() {
    titleScreen.classList.add('is-hidden');
    gameRoot.removeAttribute('aria-hidden');
    gameStarted = true;
    lastTime = performance.now();
  }
  beginBtn.addEventListener('click', beginJourney);

  function returnToTitle() {
    closeModal();
    gameStarted = false;
    titleScreen.classList.remove('is-hidden');
    gameRoot.setAttribute('aria-hidden', 'true');
    fairyX = WORLD_W * 0.5;
    fairyY = WORLD_H * 0.07;
    camX = 0; camY = 0;
    discovered.clear();
    progressCountEl.textContent = '0';
    particles.length = 0;
    checkpointState.forEach((cp) => {
      cp.visited = false;
      cp.el.classList.remove('is-visited', 'is-near');
    });
  }
  document.getElementById('restart-btn').addEventListener('click', returnToTitle);

  requestAnimationFrame(tick);
//})();
