(() => {
  'use strict';

  const stories = Array.isArray(window.LOVE_STORIES) ? window.LOVE_STORIES : [];
  const app = document.querySelector('#story-app');
  const intro = document.querySelector('#intro');
  const reader = document.querySelector('#reader');
  const ending = document.querySelector('#reality-ending');
  const viewport = document.querySelector('#story-viewport');
  const track = document.querySelector('#story-track');
  const dots = document.querySelector('#progress-dots');
  const startButton = document.querySelector('#start-story');
  const restartButton = document.querySelector('#restart-story');
  const endingRestartButton = document.querySelector('#ending-restart');
  const previousButton = document.querySelector('#previous-story');
  const nextButton = document.querySelector('#next-story');
  const currentNumber = document.querySelector('#current-number');
  const totalNumber = document.querySelector('#total-number');
  const liveRegion = document.querySelector('#live-region');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const musicToggle = document.querySelector('#music-toggle');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let current = 0;
  let started = false;
  let endingOpen = false;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let pointerDeltaX = 0;
  let dragging = false;
  let gestureAxis = 'idle';
  let musicEnabled = true;
  let activeAudio = null;
  let activeAudioIndex = -1;
  let preloadedAudio = null;
  let preloadedAudioIndex = -1;
  let imagePreloadTimer = 0;
  const targetMusicVolume = 0.52;

  const faNumber = (number) => new Intl.NumberFormat('fa-IR', { useGrouping: false }).format(number);

  const createText = (tag, className, value) => {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = value;
    return element;
  };

  const render = () => {
    totalNumber.textContent = faNumber(stories.length);

    stories.forEach((story, index) => {
      const slide = document.createElement('article');
      slide.className = 'story-slide';
      slide.id = `chapter-${story.id}`;
      slide.dataset.index = String(index);
      slide.setAttribute('role', 'tabpanel');
      slide.setAttribute('aria-hidden', index === 0 ? 'false' : 'true');
      slide.style.setProperty('--slide-bg', story.theme.bg);
      slide.style.setProperty('--slide-panel', story.theme.panel);
      slide.style.setProperty('--slide-accent', story.theme.accent);
      slide.style.setProperty('--slide-ink', story.theme.ink);
      slide.style.setProperty('--slide-muted', story.theme.muted);
      slide.style.setProperty('--image-position', story.imagePosition || 'center');
      slide.style.setProperty('--image-fit', story.imageFit || 'cover');

      const visual = document.createElement('div');
      visual.className = 'story-visual';
      if (story.futureFrame) {
        visual.classList.add('story-visual--future');
        const frame = document.createElement('div');
        frame.className = 'future-photo future-photo--story';
        frame.setAttribute('role', 'img');
        frame.setAttribute('aria-label', 'قاب عکس آینده‌ی رضا و عسل');
        frame.append(createText('span', 'future-photo__heart', '♡'));
        frame.append(createText('p', 'future-photo__title', story.futureFrame.title));
        frame.append(createText('p', '', story.futureFrame.body));
        frame.append(createText('p', 'future-photo__waiting', story.futureFrame.waiting));
        visual.append(frame);
      } else {
        const image = document.createElement('img');
        if (index === 0) image.src = story.image;
        else image.dataset.src = story.image;
        image.alt = `تصویر فصل ${faNumber(index + 1)}: ${story.title}`;
        image.width = 1360;
        image.height = 1700;
        image.decoding = 'async';
        image.loading = index === 0 ? 'eager' : 'lazy';
        if (index === 0) image.fetchPriority = 'high';
        visual.append(image);
      }

      const panel = document.createElement('div');
      panel.className = 'story-panel';
      const inner = document.createElement('div');
      inner.className = 'story-panel__inner';
      inner.append(createText('p', 'story-eyebrow', story.eyebrow));
      const title = createText('h2', 'story-title', story.title);
      if (index === 0) title.id = 'story-title';
      inner.append(title);

      const copy = document.createElement('div');
      copy.className = 'story-copy';
      story.paragraphs.forEach((paragraph) => copy.append(createText('p', '', paragraph)));
      inner.append(copy);
      inner.append(createText('p', 'story-punchline', story.punchline));
      panel.append(inner);
      slide.append(visual, panel);
      track.append(slide);

      const dot = document.createElement('button');
      dot.className = 'progress-dot';
      dot.type = 'button';
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', `رفتن به فصل ${faNumber(index + 1)}: ${story.title}`);
      dot.setAttribute('aria-controls', slide.id);
      dot.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      dot.addEventListener('click', () => goTo(index));
      dots.append(dot);
    });
  };

  const applyTheme = (story) => {
    Object.entries(story.theme).forEach(([key, value]) => app.style.setProperty(`--${key}`, value));
    themeMeta.setAttribute('content', story.theme.bg);
  };

  const loadStoryImage = (index) => {
    const image = track.children[index]?.querySelector('img[data-src]');
    if (!image?.dataset.src) return;
    image.src = image.dataset.src;
    delete image.dataset.src;
  };

  const preloadAround = (index) => {
    loadStoryImage(index);
    window.clearTimeout(imagePreloadTimer);
    imagePreloadTimer = window.setTimeout(() => loadStoryImage(index + 1), 1600);
  };

  const setMusicUI = (state = 'ready') => {
    const enabled = musicEnabled;
    musicToggle.setAttribute('aria-pressed', String(enabled));
    musicToggle.classList.toggle('is-loading', enabled && state === 'loading');
    const label = enabled ? 'قطع موسیقی' : 'پخش موسیقی';
    musicToggle.setAttribute('aria-label', label);
    musicToggle.title = label;
  };

  const fadeAudio = (audio, destination, duration, onComplete) => {
    if (!audio) return;
    if (audio._fadeFrame) cancelAnimationFrame(audio._fadeFrame);
    const startVolume = audio.volume;
    const startedAt = performance.now();
    const safeDuration = reduceMotion ? 40 : duration;

    const step = (now) => {
      const progress = Math.min(1, (now - startedAt) / safeDuration);
      const nextVolume = startVolume + (destination - startVolume) * progress;
      audio.volume = Math.max(0, Math.min(1, nextVolume));
      if (progress < 1) audio._fadeFrame = requestAnimationFrame(step);
      else {
        audio._fadeFrame = 0;
        onComplete?.();
      }
    };
    audio._fadeFrame = requestAnimationFrame(step);
  };

  const discardAudio = (audio, immediate = false) => {
    if (!audio) return;
    const finish = () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    };
    if (immediate) finish();
    else fadeAudio(audio, 0, 650, finish);
  };

  const clearPreloadedAudio = () => {
    discardAudio(preloadedAudio, true);
    preloadedAudio = null;
    preloadedAudioIndex = -1;
  };

  const preloadNextAudio = (index) => {
    if (!musicEnabled || !started) return;
    const nextIndex = index + 1;
    const nextSource = stories[nextIndex]?.audio;
    if (!nextSource || preloadedAudioIndex === nextIndex) return;

    clearPreloadedAudio();
    const audio = new Audio(nextSource);
    audio.preload = 'auto';
    audio.playsInline = true;
    audio.loop = true;
    audio.volume = 0;
    preloadedAudio = audio;
    preloadedAudioIndex = nextIndex;
    audio.load();
  };

  const switchStoryAudio = (index) => {
    const source = stories[index]?.audio;
    if (!started || !source) return;

    if (!musicEnabled) {
      if (activeAudioIndex !== index) {
        discardAudio(activeAudio, true);
        activeAudio = null;
        activeAudioIndex = -1;
      }
      return;
    }

    if (activeAudio && activeAudioIndex === index) {
      if (activeAudio.ended) activeAudio.currentTime = 0;
      setMusicUI(activeAudio.readyState < 3 ? 'loading' : 'playing');
      activeAudio.play().then(() => {
        fadeAudio(activeAudio, targetMusicVolume, 700);
        if (activeAudio.readyState >= 4) preloadNextAudio(index);
      }).catch(() => setMusicUI('ready'));
      return;
    }

    const previousAudio = activeAudio;
    let audio;
    if (preloadedAudio && preloadedAudioIndex === index) {
      audio = preloadedAudio;
      preloadedAudio = null;
      preloadedAudioIndex = -1;
    } else {
      clearPreloadedAudio();
      audio = new Audio(source);
      audio.preload = 'none';
    }
    audio.playsInline = true;
    audio.loop = true;
    audio.volume = 0;
    activeAudio = audio;
    activeAudioIndex = index;
    setMusicUI('loading');

    audio.addEventListener('playing', () => {
      if (audio !== activeAudio || !musicEnabled) return;
      setMusicUI('playing');
      fadeAudio(audio, targetMusicVolume, 1200);
    });
    audio.addEventListener('waiting', () => {
      if (audio === activeAudio && musicEnabled) setMusicUI('loading');
    });
    audio.addEventListener('progress', () => {
      if (audio !== activeAudio || !musicEnabled || !audio.buffered.length) return;
      const bufferedUntil = audio.buffered.end(audio.buffered.length - 1);
      if (bufferedUntil - audio.currentTime >= 45) preloadNextAudio(index);
    });
    audio.addEventListener('canplaythrough', () => {
      if (audio === activeAudio && musicEnabled) preloadNextAudio(index);
    }, { once: true });
    audio.addEventListener('error', () => {
      if (audio === activeAudio) setMusicUI('ready');
    });

    discardAudio(previousAudio);
    audio.play().catch(() => setMusicUI('ready'));
  };

  const stopStoryAudio = (immediate = false) => {
    discardAudio(activeAudio, immediate);
    clearPreloadedAudio();
    activeAudio = null;
    activeAudioIndex = -1;
    setMusicUI('ready');
  };

  const toggleMusic = () => {
    musicEnabled = !musicEnabled;
    setMusicUI(musicEnabled ? 'loading' : 'ready');
    if (musicEnabled) switchStoryAudio(current);
    else if (activeAudio) {
      clearPreloadedAudio();
      const audio = activeAudio;
      fadeAudio(audio, 0, 450, () => audio.pause());
    }
  };

  function goTo(index, announce = true) {
    const nextIndex = Math.max(0, Math.min(stories.length - 1, index));
    const chapterChanged = nextIndex !== current;
    current = nextIndex;
    track.classList.remove('is-dragging');
    track.style.transform = `translate3d(-${current * 100}%, 0, 0)`;
    applyTheme(stories[current]);
    preloadAround(current);

    currentNumber.textContent = faNumber(current + 1);
    previousButton.disabled = current === 0;
    nextButton.textContent = current === stories.length - 1 ? 'از اول بخونیم' : 'فصل بعد';

    [...track.children].forEach((slide, slideIndex) => {
      slide.setAttribute('aria-hidden', slideIndex === current ? 'false' : 'true');
      const panel = slide.querySelector('.story-panel');
      if (panel && slideIndex === current && chapterChanged) panel.scrollTop = 0;
    });
    [...dots.children].forEach((dot, dotIndex) => dot.setAttribute('aria-selected', dotIndex === current ? 'true' : 'false'));

    const story = stories[current];
    history.replaceState(null, '', `#${story.id}`);
    document.title = `${story.title} — رضا برای عسل`;
    if (announce) liveRegion.textContent = `فصل ${faNumber(current + 1)} از ${faNumber(stories.length)}، ${story.title}`;
    switchStoryAudio(current);
  }

  const start = () => {
    started = true;
    endingOpen = false;
    ending.classList.remove('is-visible');
    ending.setAttribute('aria-hidden', 'true');
    intro.classList.add('is-hidden');
    intro.setAttribute('aria-hidden', 'true');
    reader.setAttribute('aria-hidden', 'false');
    const hashIndex = stories.findIndex((story) => `#${story.id}` === location.hash);
    goTo(hashIndex >= 0 ? hashIndex : 0, false);
    window.setTimeout(() => viewport.focus({ preventScroll: true }), reduceMotion ? 10 : 650);
  };

  const restart = () => {
    started = false;
    stopStoryAudio();
    goTo(0, false);
    endingOpen = false;
    ending.classList.remove('is-visible');
    ending.setAttribute('aria-hidden', 'true');
    ending.scrollTop = 0;
    reader.setAttribute('aria-hidden', 'true');
    intro.classList.remove('is-hidden');
    intro.removeAttribute('aria-hidden');
    history.replaceState(null, '', location.pathname);
    document.title = 'دوازده جهان، یک عسل';
    startButton.focus();
  };

  const showEnding = () => {
    started = false;
    stopStoryAudio();
    endingOpen = true;
    reader.setAttribute('aria-hidden', 'true');
    ending.classList.add('is-visible');
    ending.setAttribute('aria-hidden', 'false');
    ending.scrollTop = 0;
    themeMeta.setAttribute('content', '#f4eadc');
    history.replaceState(null, '', '#reality');
    document.title = 'دنیای واقعی خودمون — رضا برای عسل';
    liveRegion.textContent = 'پایان قصه؛ دنیای واقعی رضا و عسل';
    window.setTimeout(() => ending.querySelector('h2').focus?.({ preventScroll: true }), 50);
  };

  const next = () => {
    if (current === stories.length - 1) goTo(0);
    else goTo(current + 1);
  };
  const previous = () => { if (current > 0) goTo(current - 1); };

  const pointerDown = (event) => {
    if (!started || event.button > 0) return;
    dragging = true;
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    pointerDeltaX = 0;
    gestureAxis = 'pending';
  };

  const pointerMove = (event) => {
    if (!dragging) return;
    const deltaX = event.clientX - pointerStartX;
    const deltaY = event.clientY - pointerStartY;
    const distanceX = Math.abs(deltaX);
    const distanceY = Math.abs(deltaY);

    if (gestureAxis === 'pending') {
      if (Math.max(distanceX, distanceY) < 8) return;
      gestureAxis = distanceX > distanceY * 1.15 ? 'horizontal' : 'vertical';
      if (gestureAxis === 'vertical') {
        dragging = false;
        return;
      }
      try { viewport.setPointerCapture?.(event.pointerId); } catch (_) { /* لمس مصنوعی یا پایان‌یافته */ }
    }

    if (gestureAxis !== 'horizontal') return;
    pointerDeltaX = deltaX;
    track.classList.add('is-dragging');
    track.style.transform = `translate3d(calc(-${current * 100}% + ${deltaX}px), 0, 0)`;
  };

  const pointerUp = () => {
    if (gestureAxis !== 'horizontal') {
      dragging = false;
      gestureAxis = 'idle';
      pointerDeltaX = 0;
      return;
    }
    dragging = false;
    gestureAxis = 'idle';
    track.classList.remove('is-dragging');
    if (pointerDeltaX < -48 && current < stories.length - 1) goTo(current + 1);
    else if (pointerDeltaX > 48 && current > 0) goTo(current - 1);
    else goTo(current, false);
    pointerDeltaX = 0;
  };

  const pointerCancel = () => {
    dragging = false;
    gestureAxis = 'idle';
    pointerDeltaX = 0;
    track.classList.remove('is-dragging');
    track.style.transform = `translate3d(-${current * 100}%, 0, 0)`;
  };

  render();
  applyTheme(stories[0]);
  previousButton.disabled = true;
  reader.setAttribute('aria-hidden', 'true');

  startButton.addEventListener('click', start);
  musicToggle.addEventListener('click', toggleMusic);
  restartButton.addEventListener('click', restart);
  endingRestartButton.addEventListener('click', restart);
  nextButton.addEventListener('click', next);
  previousButton.addEventListener('click', previous);
  viewport.addEventListener('pointerdown', pointerDown);
  viewport.addEventListener('pointermove', pointerMove);
  viewport.addEventListener('pointerup', pointerUp);
  viewport.addEventListener('pointercancel', pointerCancel);

  document.addEventListener('visibilitychange', () => {
    if (!activeAudio || !musicEnabled) return;
    if (document.hidden) activeAudio.pause();
    else if (started) activeAudio.play().catch(() => {});
  });

  document.addEventListener('keydown', (event) => {
    if (endingOpen && event.key === 'Escape') {
      restart();
      return;
    }
    if (!started && (event.key === 'Enter' || event.key === ' ')) return;
    if (!started) return;
    if (event.key === 'ArrowLeft') next();
    if (event.key === 'ArrowRight') previous();
    if (event.key === 'Home') goTo(0);
    if (event.key === 'End') goTo(stories.length - 1);
    if (event.key === 'Escape') restart();
  });
})();
