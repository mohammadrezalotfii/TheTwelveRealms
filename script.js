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
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let current = 0;
  let started = false;
  let endingOpen = false;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let pointerDeltaX = 0;
  let dragging = false;
  let gestureAxis = 'idle';

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
        image.src = story.image;
        image.alt = `تصویر فصل ${faNumber(index + 1)}: ${story.title}`;
        image.width = 1360;
        image.height = 1700;
        image.decoding = 'async';
        image.loading = index < 2 ? 'eager' : 'lazy';
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

  const preloadAround = (index) => {
    [index - 1, index + 1].forEach((candidate) => {
      if (!stories[candidate]?.image) return;
      const image = new Image();
      image.src = stories[candidate].image;
    });
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
    goTo(0, false);
    started = false;
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
  restartButton.addEventListener('click', restart);
  endingRestartButton.addEventListener('click', restart);
  nextButton.addEventListener('click', next);
  previousButton.addEventListener('click', previous);
  viewport.addEventListener('pointerdown', pointerDown);
  viewport.addEventListener('pointermove', pointerMove);
  viewport.addEventListener('pointerup', pointerUp);
  viewport.addEventListener('pointercancel', pointerCancel);

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
