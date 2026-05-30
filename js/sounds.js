'use strict';

// ─── AUDIO CONTEXT ────────────────────────────────────────────
var _aegisAudioCtx = null;

function _ac() {
  if (!_aegisAudioCtx) {
    try {
      _aegisAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) { return null; }
  }
  if (_aegisAudioCtx.state === 'suspended') {
    _aegisAudioCtx.resume().catch(function() {});
  }
  return _aegisAudioCtx;
}

// Helper: create one oscillator segment. freqEnd triggers a linear freq sweep.
function _tone(freq, type, vol, startAt, dur, freqEnd) {
  var ctx = _ac();
  if (!ctx) return;
  try {
    var osc  = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startAt);
    if (freqEnd !== undefined) {
      osc.frequency.linearRampToValueAtTime(freqEnd, startAt + dur);
    }
    gain.gain.setValueAtTime(vol, startAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
    osc.start(startAt);
    osc.stop(startAt + dur + 0.01);
  } catch (_) {}
}

// ─── UI SOUNDS ────────────────────────────────────────────────
function playNavClick() {
  var ctx = _ac();
  if (!ctx) return;
  _tone(800, 'sine', 0.10, ctx.currentTime, 0.08);
}

function playSuccess() {
  var ctx = _ac();
  if (!ctx) return;
  var t = ctx.currentTime;
  _tone(600, 'sine', 0.15, t,        0.10);
  _tone(900, 'sine', 0.15, t + 0.12, 0.10);
}

function playScanStart() {
  var ctx = _ac();
  if (!ctx) return;
  _tone(400, 'square', 0.10, ctx.currentTime, 0.15);
}

// ─── ALERT SOUNDS ─────────────────────────────────────────────
function playCriticalAlert() {
  var ctx = _ac();
  if (!ctx) return;
  var t = ctx.currentTime;
  _tone(200, 'sawtooth', 0.30, t,        0.20);
  _tone(200, 'sawtooth', 0.30, t + 0.30, 0.20);
  _tone(200, 'sawtooth', 0.30, t + 0.60, 0.20);
}

function playWarningAlert() {
  var ctx = _ac();
  if (!ctx) return;
  var t = ctx.currentTime;
  _tone(350, 'triangle', 0.20, t,        0.15);
  _tone(350, 'triangle', 0.20, t + 0.25, 0.15);
}

function playInfoBlip() {
  var ctx = _ac();
  if (!ctx) return;
  _tone(500, 'sine', 0.10, ctx.currentTime, 0.10);
}

function playVPNDrop() {
  var ctx = _ac();
  if (!ctx) return;
  _tone(600, 'sine', 0.25, ctx.currentTime, 0.40, 200);
}

function playIPChanged() {
  var ctx = _ac();
  if (!ctx) return;
  _tone(800, 'sine', 0.20, ctx.currentTime, 0.30, 400);
}

// ─── BRIEFING SOUNDS ──────────────────────────────────────────
function playBriefingStart() {
  var ctx = _ac();
  if (!ctx) return;
  try {
    var t    = ctx.currentTime;
    var osc  = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    osc.start(t);
    osc.stop(t + 0.85);
  } catch (_) {}
}

function playBriefingComplete() {
  var ctx = _ac();
  if (!ctx) return;
  var t = ctx.currentTime;
  _tone(400, 'sine', 0.20, t,        0.15);
  _tone(600, 'sine', 0.20, t + 0.17, 0.15);
  _tone(800, 'sine', 0.20, t + 0.34, 0.15);
}

// ─── SETTINGS GATE ────────────────────────────────────────────
// Returns true if the given sound category is enabled in settings.
// Defaults to true until settings are loaded.
function isSoundEnabled(category) {
  try {
    if (typeof currentSettings !== 'undefined' && currentSettings.sounds) {
      return currentSettings.sounds[category] !== false;
    }
  } catch (_) {}
  return true;
}
