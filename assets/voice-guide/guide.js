/* 預錄曉臻語音試作。僅介紹網頁入口，不提供即時法律判斷。 */
(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('voice-guide-data').textContent);
  const dock = document.getElementById('voice-guide');
  const audio = document.getElementById('guide-audio');
  const toggle = document.getElementById('guide-toggle');
  const replay = document.getElementById('guide-replay');
  const launcher = document.getElementById('guide-launcher');
  const collapse = document.getElementById('guide-collapse');
  const title = document.getElementById('guide-title');
  const copy = document.getElementById('guide-copy');
  const status = document.getElementById('guide-status');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let enabled = false;
  let expanded = false;
  let current = null;
  let playing = null;
  let ticket = 0;
  let timer = null;
  let candidate = null;
  const cooldown = new Map();
  const COOLDOWN = 20000;
  const DWELL = 1000;
  function setStatus(message) { status.textContent = message; }
  function stop() {
    ticket++;
    audio.onplaying = audio.onended = audio.onerror = audio.onpause = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    playing = null;
    dock.classList.remove('speaking');
  }
  function cancelPending() {
    clearTimeout(timer);
    timer = null;
    candidate = null;
  }
  function setExpanded(value) {
    expanded = value;
    dock.hidden = !value;
    launcher.hidden = value;
    launcher.setAttribute('aria-expanded', String(value));
    document.body.classList.toggle('guide-open', value);
    if (!value) {
      cancelPending();
      stop();
      // 收合即靜音，避免畫面縮起來後仍在背景講話。
      enabled = false;
      updateToggle();
    }
  }
  function updateToggle() {
    toggle.textContent = enabled ? '關閉語音' : '開啟語音導覽';
    toggle.setAttribute('aria-pressed', String(enabled));
    dock.classList.toggle('voice-enabled', enabled);
    replay.disabled = !current;
    replay.textContent = enabled ? '重播' : '朗讀這段';
  }
  function show(id) {
    if (!data[id]) return;
    current = id;
    title.textContent = data[id].title;
    copy.textContent = data[id].text;
    document.querySelectorAll('.guide-target').forEach(el => el.classList.remove('guide-target'));
    if (id !== 'welcome') {
      document.querySelectorAll(`.mapview:not([hidden]) .spot[data-key="${id}"]`).forEach(el => el.classList.add('guide-target'));
    }
    replay.disabled = false;
    updateToggle();
  }
  async function speak(id, force = false, oneShot = false) {
    if ((!enabled && !oneShot) || !expanded || document.hidden || !data[id]) return;
    if (!force && (playing === id || Date.now() - (cooldown.get(id) || 0) < COOLDOWN)) {
      if (playing !== id) setStatus('剛剛介紹過了，可按「重播」再聽一次');
      return;
    }
    stop();
    const own = ticket;
    playing = id;
    audio.src = data[id].src;
    setStatus('正在載入聲音…');
    audio.onplaying = () => {
      if (ticket !== own) return;
      cooldown.set(id, Date.now());
      dock.classList.toggle('speaking', !reducedMotion.matches);
      setStatus('曉臻正在介紹');
    };
    audio.onended = () => {
      if (ticket !== own) return;
      playing = null;
      dock.classList.remove('speaking');
      setStatus(enabled ? '停留另一個分區，繼續探索' : '這段已播放完畢');
    };
    const failed = () => {
      if (ticket !== own) return;
      playing = null;
      dock.classList.remove('speaking');
      setStatus('聲音無法播放；仍可閱讀文字，或按「重播」再試');
    };
    audio.onerror = failed;
    try {
      await audio.play();
    } catch (error) {
      if (ticket !== own || error.name === 'AbortError') return;
      playing = null;
      dock.classList.remove('speaking');
      setStatus(error.name === 'NotAllowedError'
        ? '瀏覽器暫停了聲音，請按「重播」播放'
        : '聲音暫時無法播放，可閱讀文字或重試');
    }
  }
  function announce(id, force = false) {
    if (!expanded || !data[id]) return;
    show(id);
    if (enabled) speak(id, force);
    else setStatus('目前靜音，可開啟語音或單獨朗讀這段');
  }
  toggle.addEventListener('click', () => {
    cancelPending();
    enabled = !enabled;
    updateToggle();
    if (enabled) {
      show(current || 'welcome');
      // 第一段在明確的使用者點擊中播放，啟用行動瀏覽器的音訊。
      speak(current, true);
    } else {
      stop();
      setStatus('已關閉語音，文字導覽仍可使用');
    }
  });
  replay.addEventListener('click', () => {
    if (current) speak(current, true, true);
  });
  collapse.addEventListener('click', () => {
    setExpanded(false);
    launcher.focus({preventScroll: true});
  });
  launcher.addEventListener('click', () => {
    setExpanded(true);
    setStatus('語音尚未開啟');
    toggle.focus({preventScroll: true});
  });
  document.querySelectorAll('.mapview .spot').forEach(spot => {
    const id = spot.dataset.key;
    spot.addEventListener('pointerenter', event => {
      if (event.pointerType === 'touch' || !expanded) return;
      cancelPending();
      if (playing && playing !== id) stop();
      candidate = spot;
      timer = setTimeout(() => {
        timer = null;
        if (candidate === spot && !spot.closest('.mapview').hidden) announce(id);
      }, DWELL);
    });
    spot.addEventListener('pointerleave', () => {
      if (candidate === spot) cancelPending();
    });
    spot.addEventListener('click', () => {
      cancelPending();
      announce(id);
    });
    // 鍵盤的Enter與Space本來就用來選取章節；同時導覽，焦點本身不發聲。
    spot.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        cancelPending();
        announce(id);
      }
    });
  });
  document.querySelectorAll('.map-wrap').forEach(wrap => {
    wrap.addEventListener('pointerdown', () => { cancelPending(); stop(); }, {passive: true});
    wrap.addEventListener('pointerleave', () => { cancelPending(); stop(); }, {passive: true});
    wrap.addEventListener('wheel', () => { cancelPending(); stop(); }, {passive: true});
  });
  document.querySelectorAll('.view-switch button, [data-zoom]').forEach(button => {
    button.addEventListener('click', () => {
      cancelPending(); stop();
      document.querySelectorAll('.guide-target').forEach(el => el.classList.remove('guide-target'));
      if (expanded) setStatus('已切換畫面，請選另一個分區');
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelPending(); stop(); }
  });
  window.addEventListener('pagehide', () => { cancelPending(); stop(); });
  updateToggle();
  setExpanded(expanded);
})();
