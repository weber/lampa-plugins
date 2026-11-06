(function () {
  'use strict';

  var VERSION = '2.0.0';
  var DEBUG = false;
  var STYLE_ID = 'fpb-style';
  var STORAGE_KEY = 'fpb_quick_sources';
  var MAX_SOURCES = 3;
  var DEFAULT_KEYS = ['filmix', 'lampac', 'torrent'];
  var COLOR_PREF = { filmix: 'blue', lampac: 'green', torrent: 'pink' };
  var COLOR_ORDER = ['blue', 'green', 'pink'];
  var startInstance = null;
  var currentRoot = null;
  var currentActivity = null;

  var CSS = [
    '.full-start__button.fpb-btn{color:#fff;}',
    '.full-start__button.fpb-color-blue{background-color:#2563eb;}',
    '.full-start__button.fpb-color-green{background-color:#16a34a;}',
    '.full-start__button.fpb-color-pink{background-color:#db2777;}',
    '.full-start__button.fpb-color-blue.focus,.full-start__button.fpb-color-blue.hover{background-color:#1d4ed8;color:#fff;}',
    '.full-start__button.fpb-color-green.focus,.full-start__button.fpb-color-green.hover{background-color:#15803d;color:#fff;}',
    '.full-start__button.fpb-color-pink.focus,.full-start__button.fpb-color-pink.hover{background-color:#be185d;color:#fff;}',
    '.full-start-new__buttons .full-start__button.fpb-label span{display:inline !important;}',
    '.full-start-new__buttons .full-start__button.button--book span{display:none !important;}',
    '.full-start-new__buttons .full-start__button.fpb-btn{padding-left:.75em;padding-right:.75em;margin-right:.5em;}',
    '.full-start-new__buttons .full-start__button.fpb-btn > svg + span{margin-left:.5em;}'
  ].join('');

  function debug() {
    if (!DEBUG || typeof console === 'undefined' || !console.log) return;

    var args = Array.prototype.slice.call(arguments);
    args.unshift('[fpb]');

    try {
      console.log.apply(console, args);
    } catch (e) {}
  }

  function translate(key) {
    return window.Lampa && Lampa.Lang && typeof Lampa.Lang.translate === 'function'
      ? Lampa.Lang.translate(key)
      : key;
  }

  function notify(text) {
    if (window.Lampa && Lampa.Noty && typeof Lampa.Noty.show === 'function') {
      Lampa.Noty.show(text);
    }
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.type = 'text/css';
    style.textContent = CSS;

    (document.head || document.getElementsByTagName('head')[0] || document.documentElement).appendChild(style);
  }

  function stripTags(value) {
    return String(value || '').replace(/<[^>]*>/g, ' ');
  }

  function normalizedName(value) {
    return stripTags(value)
      .replace(/\bv?\d+(?:\.\d+)+\b/gi, ' ')
      .replace(/\b\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}\b/g, ' ')
      .replace(/\s+\d+$/, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function displayName(value) {
    return stripTags(value)
      .replace(/\bv?\d+(?:\.\d+)+\b/gi, ' ')
      .replace(/\b\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}\b/g, ' ')
      .replace(/\s+\d+$/, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function rawName(btn) {
    return String(btn.data('subtitle') || btn.attr('data-subtitle') || btn.text() || '');
  }

  function sourceKeyOf(btn) {
    if (!btn || !btn.length) return null;
    if (btn.hasClass('view--trailer')) return null;
    if (btn.hasClass('view--torrent')) return 'torrent';
    if (btn.hasClass('view--bwa')) return 'bwa';
    if (btn.hasClass('view--online_mod')) return 'online_mod';
    if (btn.hasClass('shots-view-button')) return 'shots';
    if (btn.hasClass('wtch--button')) return 'wtch';

    var key = normalizedName(rawName(btn));

    if (key) return key;

    var classes = String(btn.attr('class') || '').split(/\s+/).filter(function (cls) {
      return cls && ['full-start__button', 'selector', 'view--online', 'lampac--button'].indexOf(cls) === -1;
    });

    return classes.join('_').toLowerCase() || null;
  }

  function labelFor(btn, key) {
    var names = {
      torrent: 'Torrent',
      filmix: 'Filmix',
      lampac: 'Lampac',
      bwa: 'BWA',
      online_mod: 'online_mod',
      shots: 'Shots',
      wtch: 'Witch'
    };

    if (names[key]) return names[key];

    var label = displayName(rawName(btn)) || key;

    return label.length > 14 ? label.slice(0, 13) + '…' : label;
  }

  function findAllSources(root) {
    var map = {};

    if (!root || !root.length) return map;

    root.find('.buttons--container > .full-start__button').not('.hide').each(function () {
      var btn = $(this);

      if (btn.hasClass('view--trailer')) return;

      var key = sourceKeyOf(btn);

      if (!key) return;
      if (!map[key]) map[key] = btn;
    });

    return map;
  }

  function availableKeys(root) {
    var map = findAllSources(root);
    var result = {};

    Object.keys(map).forEach(function (key) {
      result[key] = true;
    });

    return result;
  }

  function getSelectedKeys() {
    var raw = null;

    try {
      raw = Lampa.Storage.get(STORAGE_KEY, null);
    } catch (e) {}

    if (!Array.isArray(raw)) raw = DEFAULT_KEYS.slice();

    return raw.filter(function (key) {
      return typeof key === 'string' && key;
    }).slice(0, MAX_SOURCES);
  }

  function saveSelectedKeys(keys) {
    try {
      Lampa.Storage.set(STORAGE_KEY, keys.slice(0, MAX_SOURCES));
    } catch (e) {}
  }

  function getSelectedSources(root) {
    var selected = getSelectedKeys();
    var map = findAllSources(root);
    var list = [];

    selected.forEach(function (key) {
      if (map[key] && list.length < MAX_SOURCES) {
        list.push({
          key: key,
          btn: map[key],
          label: labelFor(map[key], key)
        });
      }
    });

    return list;
  }

  function assignColors(sources) {
    var used = {};

    sources.forEach(function (source) {
      if (COLOR_PREF[source.key]) used[COLOR_PREF[source.key]] = true;
    });

    var next = 0;

    return sources.map(function (source) {
      var color = COLOR_PREF[source.key];

      if (!color) {
        while (next < COLOR_ORDER.length && used[COLOR_ORDER[next]]) next++;

        color = COLOR_ORDER[next] || COLOR_ORDER[0];
        used[color] = true;
      }

      return {
        key: source.key,
        btn: source.btn,
        label: source.label,
        color: color
      };
    });
  }

  function drawCheckbox(item, element) {
    item.addClass('selectbox-item--checkbox');

    if (!item.find('.selectbox-item__checkbox').length) {
      item.append('<div class="selectbox-item__checkbox"></div>');
    }

    item.toggleClass('selectbox-item--checked', !!element.checked);
  }

  function updateCheckbox(target, checked) {
    var item = $(target).closest('.selectbox-item');

    if (item.length) item.toggleClass('selectbox-item--checked', checked);
  }

  function activeRoot() {
    try {
      var active = Lampa.Activity && Lampa.Activity.active ? Lampa.Activity.active() : null;

      if (active && active.component === 'full' && active.activity) {
        return active.activity.render();
      }
    } catch (e) {}

    return null;
  }

  function refreshCurrentCard() {
    if (!currentRoot || !currentRoot.length || !document.body.contains(currentRoot[0])) return;

    inject(currentRoot, currentActivity, assignColors(getSelectedSources(currentRoot)));
  }

  function toggleQuickSource(element, target) {
    if (!element || !element.fpbKey) return;

    var key = element.fpbKey;
    var selected = getSelectedKeys();
    var index = selected.indexOf(key);
    var label = labelFor(element.btn, key);

    if (index >= 0) {
      selected.splice(index, 1);
      element.checked = false;
      saveSelectedKeys(selected);
      updateCheckbox(target, false);
      notify('Убрано: ' + label);
      refreshCurrentCard();
      return;
    }

    if (selected.length >= MAX_SOURCES) {
      var available = availableKeys(currentRoot);
      var replaceIndex = -1;

      for (var i = 0; i < selected.length; i++) {
        if (!available[selected[i]]) {
          replaceIndex = i;
          break;
        }
      }

      if (replaceIndex >= 0) {
        selected.splice(replaceIndex, 1);
      } else {
        notify('Максимум 3 источника');
        return;
      }
    }

    selected.push(key);
    element.checked = true;
    saveSelectedKeys(selected);
    updateCheckbox(target, true);
    notify('Добавлено: ' + label);
    refreshCurrentCard();
  }

  function isSourcePanel(options) {
    if (!options) return false;
    if (options.title === translate('settings_rest_source')) return true;

    return Array.isArray(options.items) && options.items.some(function (item) {
      return item && item.btn;
    });
  }

  function decorateSourcePanel(options) {
    if (!options || !Array.isArray(options.items)) return;

    var root = activeRoot();

    if (root && root.length) {
      currentRoot = root;

      var start = root.find('.fpb-start-card').first().data('fpb-start');

      if (start) currentActivity = start;
    }

    var sourceTitle = translate('settings_rest_source');

    if (!sourceTitle || sourceTitle === 'settings_rest_source') sourceTitle = 'Источник';

    options.title = sourceTitle + ' · удержание OK (до 3)';

    var selected = getSelectedKeys();

    options.items.forEach(function (item) {
      if (!item || !item.btn || !item.btn.length) return;

      var key = sourceKeyOf(item.btn);

      if (!key) return;

      item.fpbKey = key;
      item.checked = selected.indexOf(key) >= 0;
      item.onDraw = drawCheckbox;
    });

    options.onLong = function (element, target) {
      toggleQuickSource(element, target);
    };
  }

  function installSelectWrapper() {
    if (!window.Lampa || !Lampa.Select || typeof Lampa.Select.show !== 'function') return false;

    window.__fpbIsSourcePanel = isSourcePanel;
    window.__fpbDecorateSourcePanel = decorateSourcePanel;

    if (!window.__fpbSelectWrapped) {
      var original = Lampa.Select.show;

      Lampa.Select.show = function (options) {
        if (window.__fpbIsSourcePanel && window.__fpbIsSourcePanel(options)) {
          window.__fpbDecorateSourcePanel(options);
        }

        return original.apply(this, arguments);
      };

      window.__fpbSelectWrapped = true;
    }

    return true;
  }

  function makeButton(source, activity, root) {
    var btn = source.btn.clone();

    btn.removeAttr('id');
    btn.removeClass('hide view--torrent view--online view--online_mod view--bwa lampac--button wtch--button shots-view-button view--trailer button--priority');
    btn.addClass('selector source-direct-button fpb-btn fpb-label fpb-color-' + source.color);
    btn.attr('data-fpb-key', source.key);
    btn.find('span').first().text(source.label);
    btn.off();

    btn.on('hover:enter', function (event) {
      if (event && event.preventDefault) event.preventDefault();

      var target = findAllSources(root)[source.key];

      if (target && target.length) {
        debug('click', source.key);
        target.trigger('hover:enter', [{}]);
      } else {
        notify('Источник недоступен: ' + source.label);
      }
    });

    btn.on('hover:focus', function () {
      if (activity) activity.last = this;
    });

    return btn;
  }

  function clean(cont) {
    cont.find('.button--reaction, .button--subscribe, .button--options, .button--priority').remove();
    cont.find('.button--play').addClass('fpb-label');
    cont.find('.button--book').removeClass('fpb-label');
  }

  function observe(cont) {
    if (typeof MutationObserver === 'undefined') return;
    if (cont.data('fpb-observed')) return;

    cont.data('fpb-observed', true);

    var observer = new MutationObserver(function () {
      clean(cont);
    });

    observer.observe(cont[0], { childList: true });
  }

  function inject(root, activity, sources) {
    var cont = root.find('.full-start-new__buttons').first();
    if (!cont.length) return;

    root.find('.buttons--container > .full-start__button').removeClass('selector');
    cont.find('.source-direct-button').remove();
    clean(cont);
    observe(cont);

    var play = cont.find('.button--play').first();
    var ref = play.length ? play : null;

    sources.forEach(function (source) {
      var btn = makeButton(source, activity, root);

      if (ref) ref.before(btn);
      else cont.append(btn);
    });

    cont.find('.button--play').addClass('fpb-label');
    cont.find('.button--book').removeClass('fpb-label');

    debug('injected:', sources.map(function (source) { return source.key; }).join(','));
  }

  function schedule(root, activity) {
    currentRoot = root;
    currentActivity = activity;

    var attempts = 0;
    var lastSig = null;

    function tick() {
      if (!root || !root.length || !document.body.contains(root[0])) return;

      var sources = assignColors(getSelectedSources(root));
      var sig = sources.map(function (source) {
        return source.key + ':' + sourceKeyOf(source.btn);
      }).join('#');

      if (sig !== lastSig) {
        lastSig = sig;
        inject(root, activity, sources);
      }

      if (attempts++ < 20) setTimeout(tick, 150);
    }

    tick();
  }

  function init() {
    if (!window.Lampa || !Lampa.Listener || typeof Lampa.Listener.follow !== 'function') return false;
    if (window.__fpbVersion === VERSION) return true;

    if (window.__fpbHandler && typeof Lampa.Listener.remove === 'function') {
      Lampa.Listener.remove('full', window.__fpbHandler);
    }

    window.__fpbVersion = VERSION;

    try {
      var oldBox = document.getElementById('fpb-debug-box');

      if (oldBox && oldBox.parentNode) oldBox.parentNode.removeChild(oldBox);
    } catch (e) {}

    try {
      if (Lampa.Storage && Lampa.Storage.get('full_btn_priority', '')) {
        Lampa.Storage.set('full_btn_priority', '');
      }
    } catch (e) {}

    injectStyle();

    if (!installSelectWrapper()) {
      var selectAttempts = 0;
      var selectTimer = setInterval(function () {
        if (installSelectWrapper() || ++selectAttempts > 50) clearInterval(selectTimer);
      }, 200);
    }

    function onFull(e) {
      if (!e) return;

      if (e.type === 'start') {
        startInstance = null;
        return;
      }

      if (e.type === 'build' && e.name === 'start') {
        startInstance = e.item || null;

        if (startInstance && startInstance.html && startInstance.html.length) {
          startInstance.html.addClass('fpb-start-card').data('fpb-start', startInstance);
        }

        return;
      }

      if (e.type !== 'complite' || !e.object || !e.object.activity) return;

      var root = e.object.activity.render();
      var start = root.find('.fpb-start-card').first().data('fpb-start') || startInstance;

      schedule(root, start);
    }

    window.__fpbHandler = onFull;
    Lampa.Listener.follow('full', onFull);

    try {
      var active = Lampa.Activity && Lampa.Activity.active ? Lampa.Activity.active() : null;

      if (active && active.component === 'full' && active.activity) {
        var root = active.activity.render();
        var start = root.find('.fpb-start-card').first().data('fpb-start') || null;

        schedule(root, start);
      }
    } catch (e) {}

    debug('loaded', VERSION);
    return true;
  }

  if (!init()) {
    var attempts = 0;
    var timer = setInterval(function () {
      if (init() || ++attempts > 100) clearInterval(timer);
    }, 200);
  }
})();
