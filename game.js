/* DeepRecall — a daily "rare answer" trivia dive.
 * Plain browser JavaScript, no dependencies. The matching/scoring/seeding
 * helpers are also exported under Node so tools/ can reuse them. */
(function (root) {
  'use strict';

  /* =========================================================================
   * CONFIG — every tunable number lives here.
   * ======================================================================= */
  const CONFIG = {
    roundsPerRun: 7,
    roundSeconds: 20,
    lowTimeSeconds: 5,          // timer turns red + ticks below this
    maxDepth: 2800,             // meters reached by a perfect run
    revealDelayMs: 650,         // suspense before the tier pops
    descentMs: 1800,            // how long the dive animation takes
    nextGuardMs: 400,           // ignore "next" this soon after submitting
    // Auto-correct: how many typos (edits) are forgiven, by word length.
    // An edit is an insert, delete, substitution or swap of two neighbors.
    autocorrect: {
      enabled: true,
      rules: [
        { minLength: 5, maxDistance: 1 },
        { minLength: 9, maxDistance: 2 },
      ],
      squashDoubles: true,      // "acomodation" ~ "accommodation" (doubled-letter slips)
      keepFirstLetter: true,    // typos rarely hit the first letter; stops "Monkey" -> Donkey
      suggestOnAmbiguous: true, // close to several answers -> "Did you mean...?"
      maxSuggestions: 3,
    },
    tiers: {
      common:     { label: 'Common',     points: 10,  color: '#b9c3cd', emoji: '⬜', blurb: 'The first answer almost everyone thinks of.' },
      familiar:   { label: 'Familiar',   points: 25,  color: '#5fd38d', emoji: '🟩', blurb: 'Well known, but not the very first pick.' },
      uncommon:   { label: 'Uncommon',   points: 50,  color: '#4fb3ff', emoji: '🟦', blurb: 'You had to think for a second.' },
      rare:       { label: 'Rare',       points: 75,  color: '#b493ff', emoji: '🟪', blurb: 'Few divers come up with this one.' },
      very_rare:  { label: 'Very Rare',  points: 90,  color: '#ff9f43', emoji: '🟧', blurb: 'Deep knowledge. Seriously impressive.' },
      legendary:  { label: 'Legendary',  points: 100, color: '#ffd84d', emoji: '🟨', blurb: 'Valid, and almost nobody says it.' },
      too_clever: { label: 'Too Clever', points: 15,  color: '#ff7eb6', emoji: '🌀', blurb: 'Technically valid, but an edge case: a loophole, a technicality or a disputed case. Not wrong, just a small reward.' },
      invalid:    { label: 'Not in the bank', points: 0, color: '#ff6b6b', emoji: '🟥', blurb: 'Not in our answer bank. The box clears and you can keep guessing until your air runs out.' },
      timeout:    { label: 'Out of air', points: 0, color: '#7d8a97', emoji: '⬛', blurb: 'The timer ran out.' },
    },
    rarityOrder: ['common', 'familiar', 'uncommon', 'rare', 'very_rare', 'legendary'],
    // Depth zones as fractions of maxDepth (so they scale if maxDepth changes).
    zones: [
      { at: 0,    label: 'Sunlight Zone', rank: 'Sunlit Snorkeler' },
      { at: 0.1,  label: 'Twilight Zone', rank: 'Twilight Explorer' },
      { at: 0.35, label: 'Midnight Zone', rank: 'Midnight Navigator' },
      { at: 0.65, label: 'Abyssal Zone',  rank: 'Abyssal Pioneer' },
      { at: 0.9,  label: 'Hadal Zone',    rank: 'Hadal Legend' },
    ],
    perfectRank: 'Trench Floor: Perfect Dive',
    dailyEpoch: '2026-01-01',   // Daily Dive #1
    dailySalt: 'deeprecall',    // change to reshuffle every future daily
    recentUnlimitedMemory: 21,  // avoid repeating this many recent prompts
    storagePrefix: 'deeprecall:v1:',
    dataUrl: 'data/prompts.json',
    fallbackScript: 'data/prompts.js',
  };

  const MAX_ROUND_POINTS = Math.max(...CONFIG.rarityOrder.map((t) => CONFIG.tiers[t].points));
  const MAX_RUN_POINTS = MAX_ROUND_POINTS * CONFIG.roundsPerRun;
  const METERS_PER_POINT = CONFIG.maxDepth / MAX_RUN_POINTS;
  const ROUND_MS = CONFIG.roundSeconds * 1000;

  /* =========================================================================
   * Matching
   * ======================================================================= */
  const CHAR_FOLDS = { 'ł': 'l', 'ø': 'o', 'æ': 'ae', 'œ': 'oe', 'ß': 'ss', 'đ': 'd', 'ð': 'd', 'þ': 'th', 'ı': 'i' };

  /** Lowercase, strip accents/punctuation/articles, collapse whitespace. */
  function normalize(str) {
    let s = String(str == null ? '' : str).toLowerCase();
    s = s.replace(/[łøæœßđðþı]/g, (c) => CHAR_FOLDS[c]);
    s = s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
    // Keep meaning that punctuation would otherwise erase (C++ vs C# vs C).
    s = s.replace(/&/g, ' and ').replace(/\+/g, ' plus ').replace(/#/g, ' sharp ');
    s = s.replace(/['’‘`]/g, '');
    s = s.replace(/[^a-z0-9]+/g, ' ').trim();
    const words = s.split(' ').filter((w) => w && w !== 'the');
    if (words.length > 1 && (words[0] === 'a' || words[0] === 'an')) words.shift();
    return words.join(' ');
  }

  /** Lookup key: normalized with spaces removed, so "fire fox" == "firefox". */
  function compactKey(normalized) {
    return normalized.replace(/ /g, '');
  }

  function stripOptionalWords(normalized, optionalWords) {
    if (!optionalWords || !optionalWords.length) return normalized;
    return normalized.split(' ').filter((w) => !optionalWords.includes(w)).join(' ');
  }

  /** Levenshtein distance that also counts one adjacent swap as a single edit. */
  function editDistance(a, b, cap) {
    if (Math.abs(a.length - b.length) > cap) return cap + 1;
    const rows = [];
    for (let i = 0; i <= a.length; i++) {
      rows[i] = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        if (i === 0) { rows[0][j] = j; continue; }
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let d = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, rows[i - 2][j - 2] + 1);
        rows[i][j] = d;
        if (d < rowMin) rowMin = d;
      }
      if (i > 0 && rowMin > cap) return cap + 1;
    }
    return rows[a.length][b.length];
  }

  /** Build the lookup structure for one prompt. Returns { exact, keys, conflicts }. */
  function buildIndex(prompt) {
    const exact = new Map();
    const conflicts = [];
    const optional = (prompt.optionalWords || []).map(normalize);
    const add = (key, answer, weak) => {
      if (!key) return;
      const existing = exact.get(key);
      if (existing && existing !== answer) {
        if (!weak) conflicts.push({ key, a: existing.text, b: answer.text });
        return;
      }
      exact.set(key, answer);
    };
    // Strong keys (text + aliases) win over keys made by dropping optional words.
    for (const answer of prompt.answers) {
      for (const form of [answer.text].concat(answer.aliases || [])) add(compactKey(normalize(form)), answer, false);
    }
    for (const answer of prompt.answers) {
      for (const form of [answer.text].concat(answer.aliases || [])) {
        add(compactKey(stripOptionalWords(normalize(form), optional)), answer, true);
      }
    }
    return { exact, keys: Array.from(exact.keys()), optional, conflicts };
  }

  /** Typos forgiven for a word of this length (0 = none). */
  function allowedEdits(length) {
    let allowed = 0;
    for (const rule of CONFIG.autocorrect.rules) if (length >= rule.minLength) allowed = Math.max(allowed, rule.maxDistance);
    return allowed;
  }

  function squashDoubles(s) {
    return s.replace(/(.)\1+/g, '$1');
  }

  /**
   * Auto-correct: find the answer(s) closest to a misspelled input.
   * Digits are never treated as typos (Henry 4 vs Henry 5).
   * Returns { answer, fuzzy: true } for one clear winner, { suggestions } when
   * several answers are equally close, or null.
   */
  function autocorrect(index, variants) {
    const ac = CONFIG.autocorrect;
    if (!ac.enabled) return null;
    let bestD = Infinity;
    let found = [];
    for (const v of variants) {
      const cap = /\d/.test(v) ? 0 : allowedEdits(v.length);
      if (!cap) continue;
      const vSquashed = squashDoubles(v);
      for (const key of index.keys) {
        if (/\d/.test(key) || (ac.keepFirstLetter && key[0] !== v[0])) continue;
        const limit = Math.min(cap, allowedEdits(key.length));
        if (!limit) continue;
        // A doubled-letter slip ranks just ahead of a single real typo.
        const d = ac.squashDoubles && squashDoubles(key) === vSquashed ? 0.5 : editDistance(v, key, limit);
        if (d > limit || d > bestD) continue;
        if (d < bestD) { bestD = d; found = []; }
        const answer = index.exact.get(key);
        if (!found.includes(answer)) found.push(answer);
      }
    }
    if (found.length === 1) return { answer: found[0], fuzzy: true };
    if (found.length > 1) return { suggestions: found.slice(0, ac.maxSuggestions) };
    return null;
  }

  /** Find the answer a player meant. Returns { answer, fuzzy }, { suggestions } or null. */
  function matchAnswer(prompt, index, input) {
    const norm = normalize(input);
    if (!norm) return null;
    const variants = [];
    const push = (v) => { if (v && !variants.includes(v)) variants.push(v); };
    push(compactKey(norm));
    push(compactKey(stripOptionalWords(norm, index.optional)));

    for (const v of variants) if (index.exact.has(v)) return { answer: index.exact.get(v), fuzzy: false };

    // Singular/plural tolerance ("cows" -> "cow", "bagel" -> "bagels").
    for (const v of variants) {
      const forms = [v + 's', v + 'es'];
      if (v.length > 3 && v.endsWith('es')) forms.push(v.slice(0, -2));
      if (v.length > 2 && v.endsWith('s')) forms.push(v.slice(0, -1));
      for (const f of forms) if (index.exact.has(f)) return { answer: index.exact.get(f), fuzzy: false };
    }

    return autocorrect(index, variants);
  }

  /* =========================================================================
   * Scoring
   * ======================================================================= */
  function scoreAnswer(prompt, index, input) {
    const match = matchAnswer(prompt, index, input);
    if (!match || !match.answer) return { tier: 'invalid', points: 0, answer: null, fuzzy: false, suggestions: match ? match.suggestions : null };
    return resultFor(match.answer, match.fuzzy);
  }

  function resultFor(answer, fuzzy) {
    const tier = CONFIG.tiers[answer.tier] ? answer.tier : 'common';
    return { tier, points: CONFIG.tiers[tier].points, answer, fuzzy };
  }

  function metersForPoints(points) {
    return Math.round(points * METERS_PER_POINT);
  }

  function runPoints(run) {
    return run.results.reduce((sum, r) => sum + r.points, 0);
  }

  function zoneFor(fraction) {
    let zone = CONFIG.zones[0];
    for (const z of CONFIG.zones) if (fraction >= z.at) zone = z;
    return zone;
  }

  function rankFor(points) {
    if (points >= MAX_RUN_POINTS) return CONFIG.perfectRank;
    return zoneFor(metersForPoints(points) / CONFIG.maxDepth).rank;
  }

  /** Rarest answer the player did not give (for the "best you missed" hint). */
  function bestMissedAnswer(prompt, givenText) {
    for (let i = CONFIG.rarityOrder.length - 1; i >= 0; i--) {
      const tier = CONFIG.rarityOrder[i];
      const pick = prompt.answers.find((a) => a.tier === tier && a.text !== givenText);
      if (pick) return pick;
    }
    return null;
  }

  /* =========================================================================
   * Dates + seeded daily selection
   * ======================================================================= */
  function pad2(n) { return String(n).padStart(2, '0'); }

  /** Local calendar date as YYYY-MM-DD (the daily rolls over at local midnight). */
  function dateKeyFor(date) {
    const d = date || new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function keyToUtcMs(key) {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  }

  function shiftDateKey(key, days) {
    const d = new Date(keyToUtcMs(key) + days * 86400000);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }

  function dailyNumber(key) {
    return Math.round((keyToUtcMs(key) - keyToUtcMs(CONFIG.dailyEpoch)) / 86400000) + 1;
  }

  /** xmur3-style string hash -> 32-bit seed. */
  function hashString(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }

  /** mulberry32 PRNG: deterministic floats in [0, 1). */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(list, rng) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Same prompts for everyone on the same date (given the same prompt bank). */
  function dailyPromptIds(prompts, key) {
    const ids = prompts.map((p) => p.id).sort((a, b) => a - b);
    const rng = mulberry32(hashString(`${CONFIG.dailySalt}|${key}`));
    return shuffle(ids, rng).slice(0, CONFIG.roundsPerRun);
  }

  /* =========================================================================
   * Share text (no spoilers: tiers only)
   * ======================================================================= */
  function formatMeters(m) {
    return `${Math.round(m).toLocaleString('en-US')} m`;
  }

  function buildShareText(run) {
    const points = runPoints(run);
    const meters = metersForPoints(points);
    const title = run.mode === 'daily' ? `DeepRecall Daily #${run.dailyNumber}` : 'DeepRecall Unlimited';
    const row = run.results.map((r) => CONFIG.tiers[r.tier].emoji).join('');
    return [
      `${title} 🤿`,
      row,
      `${formatMeters(meters)} · ${points}/${MAX_RUN_POINTS} pts`,
      rankFor(points),
    ].join('\n');
  }

  const api = {
    CONFIG, MAX_RUN_POINTS, METERS_PER_POINT,
    normalize, compactKey, editDistance, allowedEdits, buildIndex, matchAnswer, scoreAnswer,
    metersForPoints, zoneFor, rankFor, bestMissedAnswer,
    dateKeyFor, shiftDateKey, dailyNumber, hashString, mulberry32, dailyPromptIds, buildShareText,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;
  root.DeepRecall = api;

  /* =========================================================================
   * Storage (localStorage, failure-tolerant)
   * ======================================================================= */
  const Store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(CONFIG.storagePrefix + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(CONFIG.storagePrefix + key, JSON.stringify(value)); } catch (e) { /* storage full or blocked */ }
    },
    remove(key) {
      try { localStorage.removeItem(CONFIG.storagePrefix + key); } catch (e) { /* ignore */ }
    },
  };

  function defaultStats() {
    return { runsPlayed: 0, totalScore: 0, bestDepth: 0, bestScore: 0, dailyRuns: 0, streak: 0, bestStreak: 0, lastDailyKey: null, tiers: {} };
  }

  function loadStats() {
    return Object.assign(defaultStats(), Store.get('stats', {}));
  }

  function currentStreak(stats, today) {
    if (!stats.lastDailyKey) return 0;
    return stats.lastDailyKey === today || stats.lastDailyKey === shiftDateKey(today, -1) ? stats.streak : 0;
  }

  function recordCompletedRun(run) {
    const stats = loadStats();
    const points = runPoints(run);
    stats.runsPlayed += 1;
    stats.totalScore += points;
    stats.bestScore = Math.max(stats.bestScore, points);
    stats.bestDepth = Math.max(stats.bestDepth, metersForPoints(points));
    for (const r of run.results) {
      stats.tiers[r.tier] = (stats.tiers[r.tier] || 0) + 1;
      if (r.misses) stats.tiers.invalid = (stats.tiers.invalid || 0) + r.misses;
    }

    if (run.mode === 'daily') {
      stats.dailyRuns += 1;
      if (stats.lastDailyKey !== run.dateKey) {
        stats.streak = stats.lastDailyKey === shiftDateKey(run.dateKey, -1) ? stats.streak + 1 : 1;
        stats.lastDailyKey = run.dateKey;
      }
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
      const daily = Store.get('daily', {});
      daily[run.dateKey] = { points, tiers: run.results.map((r) => r.tier) };
      Store.set('daily', daily);
      Store.set('lastDaily', run);
    }
    Store.set('stats', stats);
  }

  /* =========================================================================
   * Data
   * ======================================================================= */
  const Data = { prompts: [], byId: new Map(), indexes: new Map(), bankId: '' };

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Could not load ${src}`));
      document.head.appendChild(s);
    });
  }

  async function loadPrompts() {
    // fetch() is blocked on file:// pages, so go straight to the script fallback there.
    if (location.protocol !== 'file:') {
      try {
        const res = await fetch(CONFIG.dataUrl, { cache: 'no-cache' });
        if (res.ok) return await res.json();
      } catch (e) { /* fall through to the bundled copy */ }
    }
    if (!Array.isArray(root.DEEPRECALL_PROMPTS)) await loadScript(CONFIG.fallbackScript);
    if (!Array.isArray(root.DEEPRECALL_PROMPTS)) throw new Error('No prompt data found');
    return root.DEEPRECALL_PROMPTS;
  }

  function setPrompts(list) {
    Data.prompts = list.filter((p) => p && Number.isFinite(p.id) && p.prompt && Array.isArray(p.answers) && p.answers.length);
    Data.byId = new Map(Data.prompts.map((p) => [p.id, p]));
    Data.indexes = new Map();
    // Fingerprint of the bank, so a dive saved under a different bank isn't resumed with the wrong prompts.
    Data.bankId = hashString(Data.prompts.map((p) => `${p.id}:${p.prompt}`).join('|')).toString(36);
  }

  function indexFor(prompt) {
    if (!Data.indexes.has(prompt.id)) Data.indexes.set(prompt.id, buildIndex(prompt));
    return Data.indexes.get(prompt.id);
  }

  /* =========================================================================
   * Run state
   * ======================================================================= */
  let run = null;

  function pickUnlimitedIds() {
    const recent = Store.get('recent', []);
    const rng = Math.random;
    const fresh = shuffle(Data.prompts.filter((p) => !recent.includes(p.id)).map((p) => p.id), rng);
    const stale = shuffle(Data.prompts.filter((p) => recent.includes(p.id)).map((p) => p.id), rng);
    const ids = fresh.concat(stale).slice(0, CONFIG.roundsPerRun);
    Store.set('recent', ids.concat(recent).slice(0, CONFIG.recentUnlimitedMemory));
    return ids;
  }

  function createRun(mode) {
    const today = dateKeyFor();
    return {
      v: 1,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      mode,
      bank: Data.bankId,
      dateKey: today,
      dailyNumber: dailyNumber(today),
      promptIds: mode === 'daily' ? dailyPromptIds(Data.prompts, today) : pickUnlimitedIds(),
      round: 0,
      phase: 'round', // 'round' | 'result' | 'done'
      remainingMs: ROUND_MS,
      results: [],
    };
  }

  function isValidRun(r) {
    return r && r.v === 1 && r.bank === Data.bankId && Array.isArray(r.promptIds) && r.promptIds.length === CONFIG.roundsPerRun &&
      r.promptIds.every((id) => Data.byId.has(id)) && Array.isArray(r.results) &&
      r.round >= 0 && r.round < CONFIG.roundsPerRun && ['round', 'result', 'done'].includes(r.phase);
  }

  function saveRun() {
    if (run && run.phase !== 'done') Store.set('run', run);
  }

  function currentPrompt() {
    return Data.byId.get(run.promptIds[run.round]);
  }

  /* =========================================================================
   * Sound (generated WebAudio tones, no asset files)
   * ======================================================================= */
  const Sound = {
    ctx: null,
    muted: false,
    ensure() {
      if (this.muted) return null;
      if (!this.ctx) {
        const AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) return null;
        try { this.ctx = new AC(); } catch (e) { return null; }
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    },
    tone(freq, at, dur, opts) {
      const o = Object.assign({ type: 'sine', gain: 0.12, slideTo: null }, opts);
      const ctx = this.ctx;
      const t0 = ctx.currentTime + at;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = o.type;
      osc.frequency.setValueAtTime(freq, t0);
      if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(o.gain, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    },
    whoosh(dur) {
      const ctx = this.ctx;
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + dur);
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      src.buffer = buf;
      src.connect(filter).connect(g).connect(ctx.destination);
      src.start();
    },
    play(name, tier) {
      const ctx = this.ensure();
      if (!ctx) return;
      const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
      switch (name) {
        case 'submit': this.tone(440, 0, 0.12, { type: 'triangle', slideTo: 660 }); break;
        case 'tick': this.tone(1200, 0, 0.04, { type: 'square', gain: 0.03 }); break;
        case 'reveal': {
          if (tier === 'too_clever') { this.tone(620, 0, 0.18, { type: 'triangle' }); this.tone(520, 0.14, 0.28, { type: 'triangle' }); break; }
          const steps = CONFIG.rarityOrder.indexOf(tier) + 1;
          for (let i = 0; i < steps; i++) this.tone(scale[i], i * 0.075, 0.22 + (i === steps - 1 ? 0.25 : 0), { type: 'sine', gain: 0.1 });
          break;
        }
        case 'invalid': this.tone(260, 0, 0.35, { type: 'sawtooth', gain: 0.05, slideTo: 150 }); break;
        case 'timeout': this.tone(330, 0, 0.5, { type: 'sine', slideTo: 110 }); break;
        case 'descend': this.whoosh(1.2); this.tone(180, 0, 1.2, { type: 'sine', gain: 0.06, slideTo: 70 }); break;
        case 'finish': [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, i * 0.12, 0.6, { gain: 0.08 })); break;
        case 'click': this.tone(700, 0, 0.05, { type: 'triangle', gain: 0.05 }); break;
        default: break;
      }
    },
  };

  /* =========================================================================
   * DOM helpers
   * ======================================================================= */
  const $ = (id) => document.getElementById(id);
  const reducedMotionQuery = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reducedMotion = () => reducedMotionQuery.matches;

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'style') for (const [prop, val] of Object.entries(v)) node.style.setProperty(prop.startsWith('--') ? prop : prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), val);
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of [].concat(children || [])) if (c != null) node.append(c);
    return node;
  }

  function tierBadge(tier, extraClass) {
    const t = CONFIG.tiers[tier];
    return el('span', { class: `tier-badge ${extraClass || ''}`, 'data-tier': tier, style: { '--tier': t.color } }, [
      el('span', { class: 'tier-dot', 'aria-hidden': 'true' }),
      t.label,
    ]);
  }

  let liveTimer = 0;
  function announce(text) {
    const live = $('live');
    live.textContent = '';
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => { live.textContent = text; }, 60);
  }

  const SCREENS = ['home', 'round', 'summary', 'stats'];
  function showScreen(name) {
    for (const s of SCREENS) $(`screen-${s}`).hidden = s !== name;
    document.body.dataset.screen = name;
    if (name !== 'round') stopTimer();
    window.scrollTo(0, 0);
  }

  function focusNoScroll(node) {
    if (node) try { node.focus({ preventScroll: true }); } catch (e) { node.focus(); }
  }

  /* =========================================================================
   * Ocean visuals: gradient, parallax layers, sub, gauge, particles
   * ======================================================================= */
  const Ocean = {
    shownMeters: 0,
    targetMeters: 0,
    counterRaf: 0,
    canvas: null,
    ctx: null,
    bubbles: [],
    snow: [],
    boostUntil: 0,
    w: 0,
    h: 0,
    raf: 0,

    init() {
      this.canvas = $('particles');
      this.ctx = this.canvas.getContext('2d');
      this.buildGauge();
      this.resize();
      root.addEventListener('resize', () => this.resize());
      const onMotionChange = () => { this.stopLoop(); this.startLoop(); };
      if (reducedMotionQuery.addEventListener) reducedMotionQuery.addEventListener('change', onMotionChange);
      this.startLoop();
    },

    buildGauge() {
      $('gauge').setAttribute('aria-valuemax', String(CONFIG.maxDepth));
      $('timer').setAttribute('aria-valuemax', String(CONFIG.roundSeconds));
      const marks = $('gauge-marks');
      marks.textContent = '';
      for (const z of CONFIG.zones) {
        marks.append(el('li', { class: 'gauge-mark', style: { top: `${z.at * 100}%` } }, [
          el('span', { class: 'gauge-mark-label' }, [z.label, el('small', { text: formatMeters(z.at * CONFIG.maxDepth) })]),
        ]));
      }
      marks.append(el('li', { class: 'gauge-mark gauge-mark-end', style: { top: '100%' } }, [
        el('span', { class: 'gauge-mark-label' }, ['Trench floor', el('small', { text: formatMeters(CONFIG.maxDepth) })]),
      ]));
    },

    fraction(meters) {
      return Math.max(0, Math.min(1, meters / CONFIG.maxDepth));
    },

    /** Move the whole scene to a depth. Animated unless instant or reduced motion. */
    setDepth(meters, instant) {
      const animate = !instant && !reducedMotion() && meters !== this.targetMeters;
      const goingDown = meters > this.targetMeters;
      this.targetMeters = meters;
      const f = this.fraction(meters);
      const rootStyle = document.documentElement.style;
      document.body.classList.toggle('no-transition', !animate);
      rootStyle.setProperty('--depth', f.toFixed(4));
      rootStyle.setProperty('--descent-ms', `${CONFIG.descentMs}ms`);
      // Layers in style.css read --depth; force a reflow so a no-transition jump applies immediately.
      if (!animate) void document.body.offsetHeight;
      document.body.classList.remove('no-transition');

      const zone = zoneFor(f);
      $('gauge').setAttribute('aria-valuenow', String(Math.round(meters)));
      $('gauge').setAttribute('aria-valuetext', `${formatMeters(meters)}, ${zone.label}`);
      $('gauge-zone').textContent = zone.label;

      if (animate && goingDown) {
        this.boostUntil = performance.now() + CONFIG.descentMs;
        const sub = $('sub');
        sub.classList.remove('diving');
        void sub.offsetWidth;
        sub.classList.add('diving');
      }
      this.animateCounter(animate ? CONFIG.descentMs : 0);
      if (reducedMotion()) this.drawFrame(performance.now());
    },

    animateCounter(duration) {
      cancelAnimationFrame(this.counterRaf);
      const from = this.shownMeters;
      const to = this.targetMeters;
      const start = performance.now();
      const step = (now) => {
        const t = duration ? Math.min(1, (now - start) / duration) : 1;
        const eased = 1 - Math.pow(1 - t, 3);
        this.shownMeters = from + (to - from) * eased;
        const text = formatMeters(this.shownMeters);
        $('gauge-value').textContent = text;
        for (const n of document.querySelectorAll('[data-depth-readout]')) n.textContent = text;
        if (t < 1) this.counterRaf = requestAnimationFrame(step);
      };
      step(start);
    },

    resize() {
      const dpr = Math.min(root.devicePixelRatio || 1, 2);
      this.w = root.innerWidth;
      this.h = root.innerHeight;
      this.canvas.width = Math.round(this.w * dpr);
      this.canvas.height = Math.round(this.h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const area = this.w * this.h;
      const bubbleCount = Math.min(70, Math.round(area / 16000));
      const snowCount = Math.min(90, Math.round(area / 12000));
      this.bubbles = Array.from({ length: bubbleCount }, () => this.newBubble(true));
      this.snow = Array.from({ length: snowCount }, () => this.newSnow(true));
      if (reducedMotion()) this.drawFrame(performance.now());
    },

    newBubble(anywhere) {
      const z = Math.random(); // 0 = far, 1 = near (parallax)
      return {
        x: Math.random() * this.w,
        y: anywhere ? Math.random() * this.h : this.h + 10 + Math.random() * 40,
        r: 1.2 + z * 4.5,
        speed: 18 + z * 55,
        wobble: 4 + Math.random() * 10,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.15 + z * 0.4,
      };
    },

    newSnow(anywhere) {
      const z = Math.random();
      return {
        x: Math.random() * this.w,
        y: anywhere ? Math.random() * this.h : -5,
        r: 0.6 + z * 1.6,
        speed: 4 + z * 14,
        drift: (Math.random() - 0.5) * 8,
        alpha: 0.2 + z * 0.5,
      };
    },

    startLoop() {
      let last = performance.now();
      if (reducedMotion()) { this.drawFrame(last); return; }
      const loop = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        this.update(dt, now);
        this.drawFrame(now);
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    },

    stopLoop() {
      cancelAnimationFrame(this.raf);
    },

    update(dt, now) {
      const boosting = now < this.boostUntil;
      const boost = boosting ? 1 + 5 * ((this.boostUntil - now) / CONFIG.descentMs) : 1;
      for (let i = 0; i < this.bubbles.length; i++) {
        const b = this.bubbles[i];
        b.y -= b.speed * boost * dt;
        b.phase += dt * 1.5;
        if (b.y < -12) this.bubbles[i] = this.newBubble(false);
      }
      for (let i = 0; i < this.snow.length; i++) {
        const s = this.snow[i];
        // Marine snow sinks slowly, but streams upward past the sub while it dives.
        s.y += (boosting ? -s.speed * (boost - 1) * 3 : s.speed) * dt;
        s.x += s.drift * dt;
        if (s.y > this.h + 5 || s.y < -10 || s.x < -5 || s.x > this.w + 5) {
          this.snow[i] = this.newSnow(false);
          if (boosting) this.snow[i].y = this.h + 5;
        }
      }
    },

    drawFrame(now) {
      const ctx = this.ctx;
      const f = this.fraction(this.shownMeters);
      ctx.clearRect(0, 0, this.w, this.h);
      // Bubbles thin out with depth; marine snow appears as the light fades.
      const bubbleAlpha = 1 - f * 0.6;
      const visibleBubbles = Math.ceil(this.bubbles.length * (1 - f * 0.5));
      for (let i = 0; i < visibleBubbles; i++) {
        const b = this.bubbles[i];
        const x = b.x + Math.sin(b.phase) * b.wobble;
        ctx.beginPath();
        ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(210, 240, 255, ${b.alpha * bubbleAlpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${b.alpha * bubbleAlpha * 0.9})`;
        ctx.fill();
      }
      const snowAlpha = Math.max(0, Math.min(1, (f - 0.12) * 2));
      if (snowAlpha > 0) {
        ctx.fillStyle = '#e8f2ff';
        for (const s of this.snow) {
          ctx.globalAlpha = s.alpha * snowAlpha;
          ctx.fillRect(s.x, s.y, s.r, s.r);
        }
        ctx.globalAlpha = 1;
      }
    },
  };

  /* =========================================================================
   * Timer
   * ======================================================================= */
  const timer = { raf: 0, deadline: 0, running: false, lastSave: 0, lowWarned: false, lastTickSecond: null };

  function startTimer(ms) {
    stopTimer();
    timer.deadline = performance.now() + ms;
    timer.running = true;
    timer.lowWarned = ms <= CONFIG.lowTimeSeconds * 1000;
    timer.lastTickSecond = null;
    $('round-card').classList.toggle('is-low', timer.lowWarned);
    const loop = (now) => {
      if (!timer.running) return;
      const remaining = Math.max(0, timer.deadline - now);
      run.remainingMs = remaining;
      renderTimer(remaining);
      if (remaining <= CONFIG.lowTimeSeconds * 1000) {
        if (!timer.lowWarned) {
          timer.lowWarned = true;
          $('round-card').classList.add('is-low');
          announce(`${CONFIG.lowTimeSeconds} seconds of air left.`);
        }
        const sec = Math.ceil(remaining / 1000);
        if (sec !== timer.lastTickSecond && sec > 0) { timer.lastTickSecond = sec; Sound.play('tick'); }
      }
      if (now - timer.lastSave > 1000) { timer.lastSave = now; saveRun(); }
      if (remaining <= 0) { stopTimer(); handleTimeout(); return; }
      timer.raf = requestAnimationFrame(loop);
    };
    timer.raf = requestAnimationFrame(loop);
  }

  function stopTimer() {
    timer.running = false;
    cancelAnimationFrame(timer.raf);
  }

  function renderTimer(remaining) {
    const frac = Math.max(0, Math.min(1, remaining / ROUND_MS));
    $('timer-fill').style.transform = `scaleX(${frac})`;
    $('timer-text').textContent = `${Math.ceil(remaining / 1000)}s`;
    $('timer').setAttribute('aria-valuenow', String(Math.ceil(remaining / 1000)));
  }

  /* =========================================================================
   * Round flow
   * ======================================================================= */
  let paused = false;
  let revealTimer = 0;
  let submittedAt = 0;

  function beginRun(mode) {
    run = createRun(mode);
    saveRun();
    Ocean.setDepth(0, true);
    showRoundScreen(false);
  }

  /** Show the current round. paused=true hides the prompt until the player continues. */
  function showRoundScreen(startPaused) {
    showScreen('round');
    renderRoundHeader();
    if (run.phase === 'result') {
      renderRoundBody();
      showResult(run.results[run.round], false);
      return;
    }
    renderRoundBody();
    setPaused(startPaused);
  }

  function setPaused(value) {
    paused = value;
    $('round-card').classList.toggle('is-paused', paused);
    $('pause-overlay').hidden = !paused;
    $('prompt-text').setAttribute('aria-hidden', paused ? 'true' : 'false');
    renderTimer(run.remainingMs);
    const input = $('answer-input');
    focusNoScroll(input);
    if (paused) {
      $('submit-btn').textContent = 'Continue';
      announce(`Dive paused on round ${run.round + 1}. Press Enter to continue.`);
    } else {
      $('submit-btn').textContent = 'Dive';
      announce(`Round ${run.round + 1}. ${currentPrompt().prompt}. ${Math.ceil(run.remainingMs / 1000)} seconds.`);
      startTimer(run.remainingMs);
    }
  }

  function renderRoundHeader() {
    $('round-mode').textContent = run.mode === 'daily' ? `Daily #${run.dailyNumber}` : 'Unlimited';
    $('round-count').textContent = `Round ${Math.min(run.round + 1, CONFIG.roundsPerRun)} / ${CONFIG.roundsPerRun}`;
    $('round-score').textContent = `${runPoints(run)} pts`;
    const pips = $('round-pips');
    pips.textContent = '';
    for (let i = 0; i < CONFIG.roundsPerRun; i++) {
      const r = run.results[i];
      const label = r ? `Round ${i + 1}: ${CONFIG.tiers[r.tier].label}` : i === run.round ? `Round ${i + 1}: current` : `Round ${i + 1}: not played`;
      pips.append(el('li', {
        class: `pip ${r ? 'pip-done' : ''} ${i === run.round && !r ? 'pip-current' : ''}`,
        style: r ? { '--tier': CONFIG.tiers[r.tier].color } : null,
        title: label,
      }, el('span', { class: 'sr-only', text: label })));
    }
  }

  function renderRoundBody() {
    clearTimeout(revealTimer);
    const prompt = currentPrompt();
    $('prompt-text').textContent = prompt.prompt;
    const input = $('answer-input');
    input.value = run.phase === 'result' ? (run.results[run.round] || {}).input || '' : '';
    input.readOnly = run.phase === 'result';
    $('round-card').classList.remove('is-low', 'shake', 'is-miss');
    $('round-form').classList.toggle('is-locked', run.phase === 'result');
    $('result-panel').hidden = true;
    $('miss-text').hidden = true;
    hideSuggestions();
    $('submit-btn').hidden = run.phase === 'result';
    renderTimer(run.phase === 'result' ? 0 : run.remainingMs);
  }

  function submitAnswer() {
    if (!run || run.phase !== 'round' || paused) return;
    const input = $('answer-input');
    if (!normalize(input.value)) {
      const card = $('round-card');
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
      announce('Type an answer first.');
      return;
    }
    const prompt = currentPrompt();
    const raw = input.value.trim().slice(0, 80);
    const outcome = scoreAnswer(prompt, indexFor(prompt), raw);
    // Close to several answers: let the player pick instead of scoring zero.
    // The timer keeps running while they choose.
    if (outcome.suggestions && outcome.suggestions.length && CONFIG.autocorrect.suggestOnAmbiguous) {
      showSuggestions(outcome.suggestions, raw);
      return;
    }
    if (outcome.tier === 'invalid') { rejectAnswer(raw); return; }
    stopTimer();
    Sound.play('submit');
    commitResult(outcome, raw);
  }

  /** Wrong answer: shake, clear the box, and keep the round going until something lands or the air runs out. */
  function rejectAnswer(raw) {
    run.misses = (run.misses || 0) + 1;
    saveRun();
    const input = $('answer-input');
    input.value = '';
    focusNoScroll(input);
    const card = $('round-card');
    card.classList.remove('shake', 'is-miss');
    void card.offsetWidth;
    card.classList.add('shake', 'is-miss');
    const miss = $('miss-text');
    miss.textContent = `“${raw}” isn't in the bank. Try again!`;
    miss.hidden = false;
    Sound.play('invalid');
    announce(`${raw} isn't in the bank. Try again.`);
  }

  function showSuggestions(answers, raw) {
    const list = $('suggest-list');
    list.textContent = '';
    answers.forEach((answer) => {
      const btn = el('button', { class: 'btn btn-ghost suggest-btn', type: 'button', text: answer.text });
      btn.addEventListener('click', () => chooseSuggestion(answer, raw));
      list.append(btn);
    });
    const none = el('button', { class: 'btn btn-ghost btn-small suggest-none', type: 'button', text: 'None of these' });
    none.addEventListener('click', () => chooseSuggestion(null, raw));
    list.append(none);
    $('suggest-text').textContent = `“${raw}” is close to more than one answer. Did you mean…`;
    $('suggest-panel').hidden = false;
    Sound.play('click');
    announce(`Did you mean ${answers.map((a) => a.text).join(' or ')}? Choose one, or keep typing.`);
    focusNoScroll(list.querySelector('button'));
  }

  function hideSuggestions() {
    $('suggest-panel').hidden = true;
    $('suggest-list').textContent = '';
  }

  function chooseSuggestion(answer, raw) {
    if (!run || run.phase !== 'round') return;
    hideSuggestions();
    if (answer) { stopTimer(); Sound.play('submit'); }
    if (answer) commitResult(resultFor(answer, true), raw);
    else rejectAnswer(raw);
  }

  function handleTimeout() {
    if (!run || run.phase !== 'round') return;
    hideSuggestions();
    Sound.play('timeout');
    commitResult({ tier: 'timeout', points: 0, answer: null, fuzzy: false }, '');
  }

  function commitResult(outcome, rawInput) {
    hideSuggestions();
    const result = {
      promptId: run.promptIds[run.round],
      prompt: currentPrompt().prompt,
      input: rawInput,
      answer: outcome.answer ? outcome.answer.text : null,
      tier: outcome.tier,
      points: outcome.points,
      fuzzy: outcome.fuzzy,
      misses: run.misses || 0,
    };
    run.misses = 0;
    $('miss-text').hidden = true;
    $('round-card').classList.remove('is-miss');
    run.results[run.round] = result;
    run.phase = 'result';
    run.remainingMs = ROUND_MS;
    saveRun();
    submittedAt = performance.now();

    const input = $('answer-input');
    input.readOnly = true;
    $('round-form').classList.add('is-locked', 'pulse');
    setTimeout(() => $('round-form').classList.remove('pulse'), 500);
    $('submit-btn').hidden = true;
    renderRoundHeader();
    showResult(result, true);
  }

  function plural(n, one, many) {
    return `${n} ${n === 1 ? one : many}`;
  }

  function wasAutocorrected(result) {
    return !!(result.fuzzy && result.answer && normalize(result.input) !== normalize(result.answer));
  }

  function resultMessage(result) {
    const t = CONFIG.tiers[result.tier];
    const fixed = wasAutocorrected(result) ? `Auto-corrected “${result.input}” → ${result.answer}. ` : '';
    switch (result.tier) {
      case 'timeout': return `Out of air! The timer ran out${result.misses ? ` after ${plural(result.misses, 'wrong guess', 'wrong guesses')}` : ''}, so no points this round.`;
      case 'invalid': return `Hmm, “${result.input}” isn't in our answer bank. No points this time, but keep diving.`;
      case 'too_clever': return `${fixed}${result.answer}: technically valid, just an edge case. The judges admire it, but it's only a small reward.`;
      default: return fixed ? `${fixed}${t.blurb}` : `${result.answer}. ${t.blurb}`;
    }
  }

  function showResult(result, animate) {
    const panel = $('result-panel');
    const t = CONFIG.tiers[result.tier];
    const meters = metersForPoints(result.points);
    panel.hidden = false;
    panel.style.setProperty('--tier', t.color);
    panel.classList.remove('revealed');
    $('result-badge-slot').textContent = '';
    $('result-points').textContent = '';
    $('result-message').textContent = '';
    $('result-depth').textContent = '';
    $('result-reveal-hint').hidden = !animate;
    $('next-btn').textContent = run.round + 1 >= CONFIG.roundsPerRun ? 'See your dive' : 'Next dive';
    focusNoScroll($('answer-input'));

    const reveal = () => {
      $('result-reveal-hint').hidden = true;
      $('result-badge-slot').append(tierBadge(result.tier, 'tier-badge-lg'));
      $('result-points').textContent = `+${result.points} pts`;
      $('result-depth').textContent = meters ? `▼ ${formatMeters(meters)} deeper` : 'No descent this round';
      $('result-message').textContent = resultMessage(result);
      panel.classList.add('revealed');
      announce(`${t.label}. ${resultMessage(result)} Plus ${result.points} points. Press Enter for the next dive.`);
      Ocean.setDepth(metersForPoints(runPoints(run)), !animate);
      if (animate) {
        if (result.points > 0) {
          Sound.play('reveal', result.tier);
          setTimeout(() => Sound.play('descend'), 350);
        } else if (result.tier === 'invalid') {
          Sound.play('invalid');
        }
      }
    };
    clearTimeout(revealTimer);
    if (animate && !reducedMotion()) revealTimer = setTimeout(reveal, CONFIG.revealDelayMs);
    else reveal();
  }

  function nextRound() {
    if (!run || run.phase !== 'result') return;
    if (performance.now() - submittedAt < CONFIG.nextGuardMs) return;
    clearTimeout(revealTimer);
    // Make sure the depth reflects this round even if the reveal was skipped.
    const depth = metersForPoints(runPoints(run));
    if (Ocean.targetMeters !== depth) Ocean.setDepth(depth, false);
    run.round += 1;
    if (run.round >= CONFIG.roundsPerRun) { finishRun(); return; }
    run.phase = 'round';
    run.remainingMs = ROUND_MS;
    saveRun();
    Sound.play('click');
    showRoundScreen(false);
  }

  function finishRun() {
    stopTimer();
    run.round = CONFIG.roundsPerRun - 1;
    run.phase = 'done';
    recordCompletedRun(run);
    Store.remove('run');
    const finished = run;
    run = null;
    Sound.play('finish');
    showSummary(finished);
  }

  /** Daily dives can't be restarted, so abandoning one locks in the rounds played so far. */
  function abandonRun() {
    if (!run) return;
    stopTimer();
    if (run.mode === 'daily') {
      for (let i = 0; i < CONFIG.roundsPerRun; i++) {
        if (!run.results[i]) run.results[i] = { promptId: run.promptIds[i], input: '', answer: null, tier: 'timeout', points: 0, fuzzy: false };
      }
      run.phase = 'done';
      recordCompletedRun(run);
    }
    Store.remove('run');
    run = null;
  }

  function surface() {
    if (run) {
      if (run.phase === 'round' && !paused) run.remainingMs = Math.max(0, timer.deadline - performance.now());
      stopTimer();
      saveRun();
    }
    showHome();
  }

  /* =========================================================================
   * Home
   * ======================================================================= */
  function timeUntilTomorrow() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const mins = Math.max(1, Math.ceil((next - now) / 60000));
    return `${Math.floor(mins / 60)}h ${pad2(mins % 60)}m`;
  }

  function showHome() {
    showScreen('home');
    renderHome();
    Ocean.setDepth(run ? metersForPoints(runPoints(run)) : 0, false);
    focusNoScroll($('btn-daily'));
  }

  function renderHome() {
    const today = dateKeyFor();
    const playedToday = !!Store.get('daily', {})[today];
    const dailyBtn = $('btn-daily');
    const dailyLabel = $('btn-daily-sub');
    const resume = $('resume-banner');

    if (run) {
      resume.hidden = false;
      $('resume-text').textContent = `${run.mode === 'daily' ? `Daily #${run.dailyNumber}` : 'Unlimited'} dive in progress: round ${run.round + 1} of ${CONFIG.roundsPerRun}, ${formatMeters(metersForPoints(runPoints(run)))} deep.`;
    } else {
      resume.hidden = true;
    }

    if (run && run.mode === 'daily') {
      dailyLabel.textContent = 'Resume today\'s dive';
    } else if (playedToday) {
      const rec = Store.get('daily', {})[today];
      dailyLabel.textContent = `Done: ${formatMeters(metersForPoints(rec.points))} · next in ${timeUntilTomorrow()}`;
    } else {
      dailyLabel.textContent = `Dive #${dailyNumber(today)} · same 7 prompts for everyone`;
    }
    dailyBtn.dataset.state = playedToday && !(run && run.mode === 'daily') ? 'done' : 'ready';
    $('btn-unlimited-sub').textContent = run && run.mode === 'unlimited' ? 'Resume your dive' : 'Random prompts, no limit';
  }

  function confirmReplaceRun() {
    if (!run) return true;
    const msg = run.mode === 'daily'
      ? 'Abandon today\'s Daily Dive? Unplayed rounds will count as out of air.'
      : 'Abandon your current Unlimited dive?';
    if (!root.confirm(msg)) return false;
    abandonRun();
    return true;
  }

  function onDailyClick() {
    Sound.ensure();
    const today = dateKeyFor();
    if (run && run.mode === 'daily') { showRoundScreen(true); return; }
    if (Store.get('daily', {})[today]) {
      const last = Store.get('lastDaily', null);
      if (last && last.dateKey === today && Array.isArray(last.results)) showSummary(last);
      else announce('You have already completed today\'s Daily Dive.');
      return;
    }
    if (!confirmReplaceRun()) return;
    beginRun('daily');
  }

  function onUnlimitedClick() {
    Sound.ensure();
    if (run && run.mode === 'unlimited') { showRoundScreen(true); return; }
    if (!confirmReplaceRun()) return;
    beginRun('unlimited');
  }

  /* =========================================================================
   * Summary
   * ======================================================================= */
  function showSummary(finished) {
    showScreen('summary');
    const points = runPoints(finished);
    const meters = metersForPoints(points);
    Ocean.setDepth(meters, false);

    $('summary-title').textContent = finished.mode === 'daily' ? `Daily Dive #${finished.dailyNumber}` : 'Unlimited Dive';
    $('summary-rank').textContent = rankFor(points);
    $('summary-depth').textContent = formatMeters(meters);
    $('summary-score').textContent = `${points} / ${MAX_RUN_POINTS} pts`;
    $('summary-zone').textContent = zoneFor(meters / CONFIG.maxDepth).label;

    const list = $('summary-rounds');
    list.textContent = '';
    finished.results.forEach((r, i) => {
      const byId = Data.byId.get(r.promptId);
      const prompt = byId && (!r.prompt || byId.prompt === r.prompt) ? byId : null;
      const missed = prompt ? bestMissedAnswer(prompt, r.answer) : null;
      const youSaid = r.tier === 'timeout' ? 'No answer (out of air)'
        : r.answer && normalize(r.input) !== normalize(r.answer) ? `“${r.input}” → ${r.answer}`
          : r.answer || `“${r.input}”`;
      const missedLabel = missed
        ? (r.tier === 'legendary' ? 'Another legendary: ' : 'Rarest answer you missed: ')
        : '';
      list.append(el('li', { class: 'summary-round', style: { '--tier': CONFIG.tiers[r.tier].color } }, [
        el('div', { class: 'summary-round-head' }, [
          el('span', { class: 'summary-round-num', text: `${i + 1}` }),
          el('span', { class: 'summary-round-prompt', text: prompt ? prompt.prompt : r.prompt || 'Unknown prompt' }),
          el('span', { class: 'summary-round-pts', text: `+${r.points}` }),
        ]),
        el('div', { class: 'summary-round-body' }, [
          tierBadge(r.tier),
          el('span', { class: 'summary-round-answer', text: youSaid }),
          r.misses ? el('span', { class: 'summary-round-misses', text: `after ${plural(r.misses, 'miss', 'misses')}` }) : null,
        ]),
        missed ? el('p', { class: 'summary-round-missed' }, [
          missedLabel,
          el('strong', { text: missed.text }),
          ` (${CONFIG.tiers[missed.tier].label})`,
        ]) : null,
      ]));
    });

    $('share-text').value = buildShareText(finished);
    $('copy-status').textContent = '';
    $('summary-next-daily').hidden = finished.mode !== 'daily';
    $('summary-next-daily').textContent = `Next Daily Dive in ${timeUntilTomorrow()}.`;
    announce(`Dive complete. You reached ${formatMeters(meters)} with ${points} points. Rank: ${rankFor(points)}.`);
    focusNoScroll($('summary-heading'));
  }

  async function copyShare() {
    const text = $('share-text').value;
    let ok = false;
    try {
      if (navigator.clipboard && root.isSecureContext) { await navigator.clipboard.writeText(text); ok = true; }
    } catch (e) { ok = false; }
    if (!ok) {
      const ta = $('share-text');
      ta.focus();
      ta.select();
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    }
    const msg = ok ? 'Copied! Paste it anywhere.' : 'Select the text above and copy it.';
    $('copy-status').textContent = msg;
    announce(msg);
  }

  /* =========================================================================
   * Stats
   * ======================================================================= */
  function showStats() {
    showScreen('stats');
    renderStats();
    focusNoScroll($('stats-heading'));
  }

  function renderStats() {
    const stats = loadStats();
    const today = dateKeyFor();
    const avg = stats.runsPlayed ? Math.round(stats.totalScore / stats.runsPlayed) : 0;
    const tiles = [
      ['Runs played', String(stats.runsPlayed)],
      ['Best depth', formatMeters(stats.bestDepth)],
      ['Average score', `${avg} / ${MAX_RUN_POINTS}`],
      ['Daily streak', `${currentStreak(stats, today)} 🔥`],
      ['Best streak', String(stats.bestStreak)],
      ['Dailies done', String(stats.dailyRuns)],
    ];
    const grid = $('stats-grid');
    grid.textContent = '';
    for (const [label, value] of tiles) {
      grid.append(el('div', { class: 'stat-tile' }, [
        el('span', { class: 'stat-value', text: value }),
        el('span', { class: 'stat-label', text: label }),
      ]));
    }

    const order = CONFIG.rarityOrder.slice().reverse().concat(['too_clever', 'invalid', 'timeout']);
    const max = Math.max(1, ...order.map((t) => stats.tiers[t] || 0));
    const hist = $('stats-hist');
    hist.textContent = '';
    for (const tier of order) {
      const count = stats.tiers[tier] || 0;
      const t = CONFIG.tiers[tier];
      hist.append(el('li', { class: 'hist-row', style: { '--tier': t.color } }, [
        el('span', { class: 'hist-label', text: t.label }),
        el('span', { class: 'hist-track', 'aria-hidden': 'true' }, el('span', { class: 'hist-bar', style: { width: `${(count / max) * 100}%` } })),
        el('span', { class: 'hist-count', text: String(count) }),
      ]));
    }
    $('stats-empty').hidden = stats.runsPlayed > 0;
  }

  function resetStats() {
    if (!root.confirm('Reset all stats and daily history? This cannot be undone.')) return;
    Store.remove('stats');
    Store.remove('daily');
    Store.remove('lastDaily');
    renderStats();
    announce('Stats reset.');
  }

  /* =========================================================================
   * How to Play
   * ======================================================================= */
  function buildHowTo() {
    const list = $('howto-tiers');
    list.textContent = '';
    const tiers = CONFIG.rarityOrder.concat(['too_clever', 'invalid']);
    for (const tier of tiers) {
      const t = CONFIG.tiers[tier];
      list.append(el('li', { class: 'howto-tier', style: { '--tier': t.color } }, [
        tierBadge(tier),
        el('span', { class: 'howto-points', text: `${t.points} pts` }),
        el('span', { class: 'howto-blurb', text: t.blurb }),
      ]));
    }
    $('howto-rules').textContent =
      `Each dive has ${CONFIG.roundsPerRun} rounds of ${CONFIG.roundSeconds} seconds. Every point takes you ` +
      `${METERS_PER_POINT.toFixed(0)} m deeper, so a perfect run reaches ${formatMeters(CONFIG.maxDepth)}.`;
  }

  function openHowTo() {
    const dlg = $('howto');
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
    focusNoScroll($('howto-close'));
  }

  function closeHowTo() {
    const dlg = $('howto');
    if (typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
  }

  /* =========================================================================
   * Settings
   * ======================================================================= */
  function applyMute(muted) {
    Sound.muted = muted;
    const btn = $('mute-btn');
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    btn.setAttribute('aria-label', muted ? 'Sound off. Turn sound on' : 'Sound on. Turn sound off');
    btn.querySelector('.mute-icon').textContent = muted ? '🔇' : '🔊';
    Store.set('settings', Object.assign(Store.get('settings', {}), { muted }));
  }

  /* =========================================================================
   * Wiring + boot
   * ======================================================================= */
  function wireEvents() {
    $('btn-daily').addEventListener('click', onDailyClick);
    $('btn-unlimited').addEventListener('click', onUnlimitedClick);
    $('btn-howto').addEventListener('click', openHowTo);
    $('btn-stats').addEventListener('click', showStats);
    $('resume-btn').addEventListener('click', () => { Sound.ensure(); showRoundScreen(true); });
    $('abandon-btn').addEventListener('click', () => {
      if (!confirmReplaceRun()) return;
      renderHome();
      Ocean.setDepth(0, false);
      focusNoScroll($('btn-daily'));
    });

    $('round-form').addEventListener('submit', (e) => {
      e.preventDefault();
      Sound.ensure();
      if (!run) return;
      if (run.phase === 'result') nextRound();
      else if (paused) setPaused(false);
      else submitAnswer();
    });
    $('answer-input').addEventListener('input', () => { if (!$('suggest-panel').hidden) hideSuggestions(); });
    $('pause-overlay').addEventListener('click', () => { Sound.ensure(); setPaused(false); });
    $('next-btn').addEventListener('click', () => { submittedAt = 0; nextRound(); });
    $('surface-btn').addEventListener('click', surface);

    $('copy-btn').addEventListener('click', copyShare);
    $('summary-again').addEventListener('click', onUnlimitedClick);
    $('summary-home').addEventListener('click', showHome);
    $('stats-back').addEventListener('click', showHome);
    $('stats-reset').addEventListener('click', resetStats);

    $('howto-close').addEventListener('click', closeHowTo);
    $('howto').addEventListener('click', (e) => { if (e.target === $('howto')) closeHowTo(); });
    $('mute-btn').addEventListener('click', () => { applyMute(!Sound.muted); Sound.play('click'); });

    // Persist the clock if the tab is hidden or closed mid-round.
    const persist = () => {
      if (run && run.phase === 'round' && timer.running) run.remainingMs = Math.max(0, timer.deadline - performance.now());
      saveRun();
    };
    document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
    root.addEventListener('pagehide', persist);

    // Keep keyboard focus in the answer box while a round is on screen.
    document.addEventListener('keydown', (e) => {
      if (document.body.dataset.screen !== 'round' || $('howto').open) return;
      const input = $('answer-input');
      if (document.activeElement !== input && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) focusNoScroll(input);
    });

    setInterval(() => { if (document.body.dataset.screen === 'home') renderHome(); }, 30000);
  }

  function showFatal(message) {
    const box = $('fatal');
    box.hidden = false;
    $('fatal-text').textContent = message;
    for (const s of SCREENS) $(`screen-${s}`).hidden = true;
  }

  async function init() {
    applyMute(!!Store.get('settings', {}).muted);
    Ocean.init();
    buildHowTo();
    wireEvents();
    let list;
    try {
      list = await loadPrompts();
    } catch (e) {
      showFatal('The prompt bank could not be loaded. If you opened index.html directly, make sure data/prompts.js exists, or run "python3 -m http.server" in this folder.');
      return;
    }
    setPrompts(list);
    if (Data.prompts.length < CONFIG.roundsPerRun) {
      showFatal(`The prompt bank needs at least ${CONFIG.roundsPerRun} prompts.`);
      return;
    }
    document.body.classList.remove('is-loading');

    const saved = Store.get('run', null);
    if (isValidRun(saved)) {
      run = saved;
      Ocean.setDepth(metersForPoints(runPoints(run)), true);
      showRoundScreen(true);
    } else {
      if (saved) Store.remove('run');
      showHome();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
