(function () {
  'use strict';

  var VERSION = '1.2.0';
  var TITLE_KEY = 'title_continue';
  var FALLBACK_TITLE = 'Продолжить просмотр';
  var DEBUG = false;

  function debug() {
    if (!DEBUG || typeof console === 'undefined' || !console.log) return;

    var args = Array.prototype.slice.call(arguments);
    args.unshift('[history-first]');

    try {
      console.log.apply(console, args);
    } catch (e) {}
  }

  function continueTitle() {
    return window.Lampa && Lampa.Lang && typeof Lampa.Lang.translate === 'function'
      ? Lampa.Lang.translate(TITLE_KEY)
      : FALLBACK_TITLE;
  }

  function titles(rows) {
    if (!Array.isArray(rows)) return String(rows);

    return rows.map(function (row) {
      return row && row.title ? row.title : '?';
    }).join(' | ');
  }

  function isContinueCallback(fn) {
    if (typeof fn !== 'function') return false;

    try {
      return String(fn).indexOf(TITLE_KEY) !== -1;
    } catch (e) {
      return false;
    }
  }

  function callbackLabel(fn) {
    if (typeof fn !== 'function') return typeof fn;
    return isContinueCallback(fn) ? 'CONTINUE' : 'other';
  }

  function moveContinueFirst(rows) {
    if (!Array.isArray(rows) || rows.length < 2) return rows;

    var title = continueTitle();

    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      if (!row || typeof row.title !== 'string') continue;

      if (row.title === title || row.title === FALLBACK_TITLE) {
        rows.splice(i, 1);
        rows.unshift(row);
        break;
      }
    }

    return rows;
  }

  function moveContinueInCalls(calls) {
    if (!Array.isArray(calls)) return -1;

    for (var i = 0; i < calls.length; i++) {
      if (!isContinueCallback(calls[i])) continue;

      if (i > 0) calls.splice(0, 0, calls.splice(i, 1)[0]);
      return i;
    }

    return -1;
  }

  function patchApi() {
    if (!window.Lampa || !Lampa.Api || typeof Lampa.Api.category !== 'function') return false;
    if (Lampa.Api._lampacHistoryFirst === VERSION) return true;

    var original = Lampa.Api.category;

    Lampa.Api.category = function (params, oncomplite, onerror) {
      if (typeof oncomplite !== 'function') return original.apply(this, arguments);

      return original.call(this, params, function (rows) {
        debug('Api.category before:', titles(rows));
        var result = moveContinueFirst(rows);
        debug('Api.category after:', titles(result));
        return oncomplite(result);
      }, onerror);
    };

    Lampa.Api._lampacHistoryFirst = VERSION;
    debug('patched Lampa.Api.category', VERSION);
    return true;
  }

  function patchContentRows() {
    if (!window.Lampa || !Lampa.ContentRows || typeof Lampa.ContentRows.call !== 'function') return false;
    if (Lampa.ContentRows._lampacHistoryFirst === VERSION) return true;

    var original = Lampa.ContentRows.call;

    Lampa.ContentRows.call = function (screen, params, calls) {
      var result = original.apply(this, arguments);

      if (screen === 'category') {
        var index = moveContinueInCalls(calls);
        debug('ContentRows.call category: continue index', index, 'order:', Array.isArray(calls) ? calls.map(callbackLabel).join(' > ') : calls);
      }

      return result;
    };

    Lampa.ContentRows._lampacHistoryFirst = VERSION;
    debug('patched Lampa.ContentRows.call', VERSION);
    return true;
  }

  function apply() {
    var api = patchApi();
    var rows = patchContentRows();

    return api && rows;
  }

  debug('loaded', VERSION, 'Lampa=' + !!window.Lampa, 'Api=' + !!(window.Lampa && Lampa.Api && Lampa.Api.category), 'ContentRows=' + !!(window.Lampa && Lampa.ContentRows && Lampa.ContentRows.call));

  if (!apply()) {
    var attempts = 0;
    var timer = setInterval(function () {
      attempts++;

      if (apply()) {
        debug('retry success after', attempts);
        clearInterval(timer);
        return;
      }

      if (attempts % 20 === 0) debug('retry attempt', attempts);
      if (attempts > 100) {
        debug('retry gave up after', attempts);
        clearInterval(timer);
      }
    }, 200);
  }
})();
