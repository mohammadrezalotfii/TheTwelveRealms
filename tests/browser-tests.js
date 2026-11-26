(() => {
  'use strict';

  const frame = document.querySelector('#app-frame');
  const results = document.querySelector('#results');
  const summary = document.querySelector('#summary');
  const tests = [];
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const test = (name, run) => tests.push({ name, run });
  const assert = (condition, message) => { if (!condition) throw new Error(message); };

  test('۱۲ فصل و ۱۲ نقطه‌ی پیشرفت ساخته می‌شود', async (win) => {
    assert(win.LOVE_STORIES.length === 12, 'تعداد داستان‌ها ۱۲ نیست');
    assert(win.document.querySelectorAll('.story-slide').length === 12, 'تعداد اسلایدها ۱۲ نیست');
    assert(win.document.querySelectorAll('.progress-dot').length === 12, 'تعداد نقاط پیشرفت ۱۲ نیست');
  });

  test('سند فارسی و راست‌به‌چپ است', async (win) => {
    assert(win.document.documentElement.lang === 'fa', 'زبان سند fa نیست');
    assert(win.document.documentElement.dir === 'rtl', 'جهت سند rtl نیست');
  });

  test('فونت انتخابی پینار بارگذاری می‌شود', async (win) => {
    await win.document.fonts.ready;
    assert(win.document.fonts.check('30px "Pinar Local"'), 'فونت پینار بارگذاری نشد');
  });

  test('همه‌ی تصاویر داستان سالم‌اند', async (win) => {
    const checks = await Promise.all(win.LOVE_STORIES.filter((story) => story.image).map((story) => new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = story.image;
    })));
    assert(checks.every(Boolean), 'حداقل یک تصویر بارگذاری نشد');
  });

  test('صفحه وابستگی خارجی ندارد', async (win) => {
    const external = [...win.document.querySelectorAll('[src],[href]')]
      .map((node) => node.getAttribute('src') || node.getAttribute('href'))
      .filter((value) => /^https?:/i.test(value || ''));
    assert(external.length === 0, `وابستگی خارجی: ${external.join(', ')}`);
  });

  test('شروع داستان صفحه‌ی معرفی را می‌بندد', async (win) => {
    win.document.querySelector('#start-story').click();
    await wait(50);
    assert(win.document.querySelector('#intro').classList.contains('is-hidden'), 'صفحه معرفی بسته نشد');
    assert(win.document.querySelector('#reader').getAttribute('aria-hidden') === 'false', 'خواننده فعال نشد');
  });

  test('رفتن به فصل بعد، شماره و تم را تغییر می‌دهد', async (win) => {
    const app = win.document.querySelector('#story-app');
    const oldTheme = app.style.getPropertyValue('--bg');
    win.document.querySelector('#next-story').click();
    await wait(30);
    assert(win.document.querySelector('#current-number').textContent === '۲', 'شماره فصل تغییر نکرد');
    assert(app.style.getPropertyValue('--bg') !== oldTheme, 'تم تغییر نکرد');
  });

  test('دکمه فصل قبل کار می‌کند', async (win) => {
    win.document.querySelector('#previous-story').click();
    assert(win.document.querySelector('#current-number').textContent === '۱', 'بازگشت به فصل قبل انجام نشد');
  });

  test('انتخاب نقطه‌ی پیشرفت به فصل مربوط می‌رود', async (win) => {
    win.document.querySelectorAll('.progress-dot')[3].click();
    assert(win.document.querySelector('#current-number').textContent === '۴', 'فصل چهارم انتخاب نشد');
    assert(win.document.querySelectorAll('.story-slide[aria-hidden="false"]').length === 1, 'باید فقط یک اسلاید فعال باشد');
  });

  test('کلیدهای جهت‌دار فصل را عوض می‌کنند', async (win) => {
    win.document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    assert(win.document.querySelector('#current-number').textContent === '۵', 'کلید جهت‌دار عمل نکرد');
  });

  test('کشیدن افقی اسلاید را تغییر می‌دهد', async (win) => {
    const viewport = win.document.querySelector('#story-viewport');
    viewport.dispatchEvent(new PointerEvent('pointerdown', { clientX: 310, clientY: 300, button: 0, pointerId: 1, bubbles: true }));
    viewport.dispatchEvent(new PointerEvent('pointermove', { clientX: 190, clientY: 302, pointerId: 1, bubbles: true }));
    viewport.dispatchEvent(new PointerEvent('pointerup', { clientX: 190, clientY: 302, pointerId: 1, bubbles: true }));
    assert(win.document.querySelector('#current-number').textContent === '۶', 'حرکت کشیدن افقی عمل نکرد');
  });

  test('ادامه‌ی اسکرول عمودی متن را به ابتدای قصه برنمی‌گرداند', async (win) => {
    const panel = win.document.querySelector('.story-slide[aria-hidden="false"] .story-panel');
    const target = Math.min(120, panel.scrollHeight - panel.clientHeight);
    assert(target > 0, 'پنل برای آزمون اسکرول ارتفاع کافی ندارد');
    panel.scrollTop = target;
    const before = panel.scrollTop;
    panel.dispatchEvent(new PointerEvent('pointerdown', { clientX: 210, clientY: 520, button: 0, pointerId: 2, bubbles: true }));
    panel.dispatchEvent(new PointerEvent('pointermove', { clientX: 213, clientY: 430, pointerId: 2, bubbles: true }));
    panel.dispatchEvent(new PointerEvent('pointerup', { clientX: 213, clientY: 430, pointerId: 2, bubbles: true }));
    assert(panel.scrollTop === before, `موقعیت اسکرول از ${before} به ${panel.scrollTop} تغییر کرد`);
    assert(win.document.querySelector('#current-number').textContent === '۶', 'اسکرول عمودی فصل را تغییر داد');
  });

  test('فصل دوازدهم داخل اسلایدر است و از ابتدا ادامه می‌دهد', async (win) => {
    win.document.querySelectorAll('.progress-dot')[11].click();
    assert(win.document.querySelector('#current-number').textContent === '۱۲', 'فصل دوازدهم انتخاب نشد');
    assert(win.document.querySelector('.story-slide[aria-hidden="false"] .future-photo'), 'قاب آینده در فصل دوازدهم وجود ندارد');
    assert(win.document.querySelector('#next-story').textContent === 'از اول بخونیم', 'متن دکمه پایانی درست نیست');
    win.document.querySelector('#next-story').click();
    assert(win.document.querySelector('#current-number').textContent === '۱', 'داستان از ابتدا شروع نشد');
  });

  test('متن همه‌ی فصل‌ها کامل و داخل پنل است', async (win) => {
    const panels = [...win.document.querySelectorAll('.story-panel')];
    const invalid = panels.filter((panel) => !panel.innerText.trim() || panel.scrollWidth > panel.clientWidth + 1);
    assert(invalid.length === 0, `${invalid.length} پنل خالی یا دارای بیرون‌زدگی است`);
  });

  test('کنترل‌های لمسی حداقل ۴۴ پیکسل ارتفاع دارند', async (win) => {
    const invalid = [...win.document.querySelectorAll('button')]
      .filter((button) => button.getBoundingClientRect().height > 0 && button.getBoundingClientRect().height < 44);
    assert(invalid.length === 0, `${invalid.length} کنترل کوچک‌تر از ۴۴ پیکسل است`);
  });

  test('صفحه‌ی موبایل سرریز افقی ندارد', async (win) => {
    const doc = win.document.documentElement;
    assert(doc.scrollWidth <= doc.clientWidth + 1, `عرض محتوا ${doc.scrollWidth} و عرض صفحه ${doc.clientWidth} است`);
  });

  test('حالت کاهش حرکت تعریف شده است', async (win) => {
    const css = await win.fetch('styles.css').then((response) => response.text());
    assert(css.includes('prefers-reduced-motion'), 'قانون reduced motion وجود ندارد');
  });

  frame.addEventListener('load', async () => {
    const win = frame.contentWindow;
    const outcomes = [];
    for (const current of tests) {
      try {
        await current.run(win);
        outcomes.push({ name: current.name, passed: true });
      } catch (error) {
        outcomes.push({ name: current.name, passed: false, error: error.message });
      }
    }

    results.innerHTML = outcomes.map((outcome) => (
      `<li class="${outcome.passed ? 'pass' : 'fail'}">${outcome.passed ? '✓' : '✕'} ${outcome.name}${outcome.error ? ` — ${outcome.error}` : ''}</li>`
    )).join('');
    const passed = outcomes.filter((outcome) => outcome.passed).length;
    summary.textContent = `${passed} از ${outcomes.length} آزمون با موفقیت انجام شد.`;
    summary.dataset.passed = String(passed);
    summary.dataset.total = String(outcomes.length);
    document.title = passed === outcomes.length ? 'PASS — Story tests' : 'FAIL — Story tests';
  }, { once: true });
})();
