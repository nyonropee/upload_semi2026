/* ============ Web Component (自作 <my-range-slider>) ============ */
class MyRangeSlider extends HTMLElement {
  static get observedAttributes() {
    return ['min', 'max', 'step', 'value', 'vertical', 'disabled', 'no-tooltip', 'min-distance'];
  }
  constructor() {
    super();
    this._activeIndex = -1;
    this._values = [];
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host {
          display: inline-block; width: 100%;
          --track-color: #d9d9e3; --filled-color: #4f7cff; --pointer-color: #ffffff;
          --pointer-border-color: #4f7cff; --track-height: 6px; --track-width: 6px;
          --pointer-size: 18px; --tooltip-bg: #333; --tooltip-color: #fff;
          user-select: none; -webkit-user-select: none; touch-action: none;
        }
        :host([disabled]) { opacity: 0.5; pointer-events: none; }
        .wrap { position: relative; display: flex; align-items: center; width: 100%; height: calc(var(--pointer-size) + 16px); }
        :host([vertical]) .wrap { height: 100%; width: calc(var(--pointer-size) + 16px); flex-direction: column; }
        .track { position: relative; width: 100%; height: var(--track-height); background: var(--track-color); border-radius: 999px; cursor: pointer; }
        :host([vertical]) .track { width: var(--track-width); height: 100%; }
        .filled { position: absolute; background: var(--filled-color); border-radius: 999px; }
        :host(:not([vertical])) .filled { top: 0; height: 100%; }
        :host([vertical]) .filled { left: 0; width: 100%; bottom: 0; }
        .pointer {
          position: absolute; width: var(--pointer-size); height: var(--pointer-size);
          background: var(--pointer-color); border: 2px solid var(--pointer-border-color);
          border-radius: 50%; top: 50%; transform: translate(-50%, -50%);
          box-shadow: 0 1px 3px rgba(0,0,0,0.25); cursor: grab; box-sizing: border-box;
        }
        :host([vertical]) .pointer { top: auto; left: 50%; transform: translate(-50%, 50%); }
        .pointer:focus { outline: 2px solid var(--filled-color); outline-offset: 2px; }
        .pointer.active { cursor: grabbing; }
        .tooltip {
          position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%);
          background: var(--tooltip-bg); color: var(--tooltip-color); font-size: 12px; padding: 2px 6px;
          border-radius: 4px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 0.12s ease;
        }
        :host([vertical]) .tooltip { bottom: auto; left: calc(100% + 8px); top: 50%; transform: translateY(-50%); }
        .pointer:hover .tooltip, .pointer.active .tooltip, .pointer:focus .tooltip { opacity: 1; }
        :host([no-tooltip]) .tooltip { display: none; }
      </style>
      <div class="wrap"><div class="track" part="track"><div class="filled" part="filled"></div></div></div>
    `;
    this._trackEl = shadow.querySelector('.track');
    this._filledEl = shadow.querySelector('.filled');
    this._wrapEl = shadow.querySelector('.wrap');
    this._trackEl.addEventListener('pointerdown', (e) => this._onTrackClick(e));
  }
  connectedCallback() { this._render(); }
  attributeChangedCallback() { this._render(); }
  get min() { return parseFloat(this.getAttribute('min')) || 0; }
  get max() { const m = parseFloat(this.getAttribute('max')); return isNaN(m) ? 100 : m; }
  get step() { const s = parseFloat(this.getAttribute('step')); return isNaN(s) || s <= 0 ? 1 : s; }
  get minDistance() { const d = parseFloat(this.getAttribute('min-distance')); return isNaN(d) ? 0 : d; }
  get vertical() { return this.hasAttribute('vertical'); }
  get values() { return this._values.slice(); }
  set values(arr) { this._values = arr.map((v) => this._clamp(v)); this.setAttribute('value', this._values.join(',')); }
  get value() { return this._values[0]; }
  _parseValuesFromAttr() {
    const raw = this.getAttribute('value');
    if (!raw) return [this.min];
    return raw.split(',').map((s) => this._clamp(parseFloat(s.trim())));
  }
  _clamp(v) {
    if (isNaN(v)) v = this.min;
    const min = this.min, max = this.max, step = this.step;
    v = Math.min(max, Math.max(min, v));
    const steps = Math.round((v - min) / step);
    v = min + steps * step;
    v = Math.round(v * 1e6) / 1e6;
    return Math.min(max, Math.max(min, v));
  }
  _valueToPercent(v) { const min = this.min, max = this.max; if (max === min) return 0; return ((v - min) / (max - min)) * 100; }
  _percentToValue(pct) { const min = this.min, max = this.max; return min + (pct / 100) * (max - min); }
  _render() {
    const newValues = this._parseValuesFromAttr();
    const countChanged = newValues.length !== this._pointerEls?.length;
    this._values = newValues;
    if (!this._pointerEls || countChanged) this._buildPointers(newValues.length);
    this._values.forEach((v, i) => {
      const pct = this._valueToPercent(v);
      const pointerEl = this._pointerEls[i];
      const tooltipEl = this._tooltipEls[i];
      if (this.vertical) { pointerEl.style.bottom = pct + '%'; pointerEl.style.left = '50%'; }
      else { pointerEl.style.left = pct + '%'; pointerEl.style.top = '50%'; }
      tooltipEl.textContent = this._formatValue(v);
      pointerEl.setAttribute('aria-valuenow', v);
      pointerEl.setAttribute('aria-valuemin', this.min);
      pointerEl.setAttribute('aria-valuemax', this.max);
      pointerEl.setAttribute('tabindex', this.hasAttribute('disabled') ? '-1' : '0');
    });
    this._updateFilled();
  }
  _formatValue(v) { return Number(v.toFixed(6)).toString(); }
  _updateFilled() {
    if (this._values.length === 0) return;
    const lo = Math.min(...this._values), hi = Math.max(...this._values);
    const pLo = this._valueToPercent(lo), pHi = this._valueToPercent(hi);
    if (this.vertical) { this._filledEl.style.bottom = pLo + '%'; this._filledEl.style.height = (pHi - pLo) + '%'; this._filledEl.style.left = ''; this._filledEl.style.width = ''; }
    else { this._filledEl.style.left = pLo + '%'; this._filledEl.style.width = (pHi - pLo) + '%'; this._filledEl.style.bottom = ''; this._filledEl.style.height = ''; }
  }
  _buildPointers(count) {
    if (this._pointerEls) this._pointerEls.forEach((el) => el.remove());
    this._pointerEls = []; this._tooltipEls = [];
    for (let i = 0; i < count; i++) {
      const pointerEl = document.createElement('div');
      pointerEl.className = 'pointer'; pointerEl.setAttribute('part', 'pointer');
      pointerEl.setAttribute('role', 'slider'); pointerEl.setAttribute('tabindex', '0');
      const tooltipEl = document.createElement('div'); tooltipEl.className = 'tooltip';
      pointerEl.appendChild(tooltipEl);
      pointerEl.addEventListener('pointerdown', (e) => this._onPointerDown(e, i));
      pointerEl.addEventListener('keydown', (e) => this._onKeyDown(e, i));
      pointerEl.addEventListener('wheel', (e) => this._onWheel(e, i), { passive: false });
      this._wrapEl.appendChild(pointerEl);
      this._pointerEls.push(pointerEl); this._tooltipEls.push(tooltipEl);
    }
  }
  _onPointerDown(e, index) {
    if (this.hasAttribute('disabled')) return;
    e.preventDefault(); e.stopPropagation();
    this._activeIndex = index;
    this._pointerEls[index].classList.add('active');
    this._pointerEls[index].focus();
    document.addEventListener('pointermove', this._onPointerMove);
    document.addEventListener('pointerup', this._onPointerUp);
  }
  _onPointerMove(e) { if (this._activeIndex < 0) return; e.preventDefault(); this._moveActiveTo(this._eventToPercent(e), true); }
  _onPointerUp() {
    if (this._activeIndex >= 0) { this._pointerEls[this._activeIndex]?.classList.remove('active'); this._dispatchChange(); }
    this._activeIndex = -1;
    document.removeEventListener('pointermove', this._onPointerMove);
    document.removeEventListener('pointerup', this._onPointerUp);
  }
  _onTrackClick(e) {
    if (this.hasAttribute('disabled')) return;
    if (e.target !== this._trackEl) return;
    const pct = this._eventToPercent(e);
    const target = this._percentToValue(pct);
    let nearest = 0, best = Infinity;
    this._values.forEach((v, i) => { const d = Math.abs(v - target); if (d < best) { best = d; nearest = i; } });
    this._activeIndex = nearest;
    this._moveActiveTo(pct, true);
    this._dispatchChange();
    this._activeIndex = -1;
  }
  _eventToPercent(e) {
    const rect = this._trackEl.getBoundingClientRect();
    let pct;
    if (this.vertical) pct = ((rect.bottom - e.clientY) / rect.height) * 100;
    else pct = ((e.clientX - rect.left) / rect.width) * 100;
    return Math.min(100, Math.max(0, pct));
  }
  _moveActiveTo(pct, fromInput) {
    const i = this._activeIndex;
    if (i < 0) return;
    let v = this._clamp(this._percentToValue(pct));
    const md = this.minDistance;
    if (i > 0) { const prev = this._values[i - 1]; if (v < prev + md) v = this._clamp(prev + md); }
    if (i < this._values.length - 1) { const next = this._values[i + 1]; if (v > next - md) v = this._clamp(next - md); }
    this._values[i] = v;
    this.setAttribute('value', this._values.join(','));
    if (fromInput) this.dispatchEvent(new CustomEvent('input', { detail: { index: i, value: v, values: this.values } }));
  }
  _onKeyDown(e, index) {
    if (this.hasAttribute('disabled')) return;
    const step = this.step;
    let delta = 0;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowUp': delta = step; break;
      case 'ArrowLeft': case 'ArrowDown': delta = -step; break;
      case 'Home': this._activeIndex = index; this._moveActiveTo(0, true); this._dispatchChange(); this._activeIndex = -1; e.preventDefault(); return;
      case 'End': this._activeIndex = index; this._moveActiveTo(100, true); this._dispatchChange(); this._activeIndex = -1; e.preventDefault(); return;
      default: return;
    }
    e.preventDefault();
    this._activeIndex = index;
    const pct = this._valueToPercent(this._values[index] + delta);
    this._moveActiveTo(pct, true);
    this._dispatchChange();
    this._activeIndex = -1;
  }
  _onWheel(e, index) {
    if (this.hasAttribute('disabled')) return;
    e.preventDefault();
    const step = this.step;
    const delta = e.deltaY < 0 ? step : -step;
    this._activeIndex = index;
    const pct = this._valueToPercent(this._values[index] + delta);
    this._moveActiveTo(pct, true);
    this._dispatchChange();
    this._activeIndex = -1;
  }
  _dispatchChange() { this.dispatchEvent(new CustomEvent('change', { detail: { values: this.values, value: this.values[0] } })); }
}
customElements.define('my-range-slider', MyRangeSlider);

document.getElementById('wcTimer').addEventListener('change', (e) => {
  document.getElementById('wcTimerVal').textContent = e.detail.values[0] + '分';
});
document.getElementById('wcAircon').addEventListener('change', (e) => {
  document.getElementById('wcAirconVal').textContent = e.detail.values[0] + '℃';
});

/* ============ ネイティブ / カスタムドラッグ実装 ============ */

/* 汎用: 2つまみスライダー(オーバーレイ方式)のUIを反映する */
function bindDualRangeUI(minRange, maxRange, fill, minThumb, maxThumb, maxValue) {
  let min = Number(minRange.value);
  let max = Number(maxRange.value);
  if (min > max) [min, max] = [max, min];
  minRange.value = min;
  maxRange.value = max;
  const minPercent = min / maxValue * 100;
  const maxPercent = max / maxValue * 100;
  fill.style.left = minPercent + '%';
  fill.style.width = (maxPercent - minPercent) + '%';
  minThumb.style.left = minPercent + '%';
  maxThumb.style.left = maxPercent + '%';
  return { min, max };
}

/* --- 2ポインター: 参加年齢層 --- */
const ageMaxValue = 100;
const ageMinRange = document.getElementById('ageMinRange');
const ageMaxRange = document.getElementById('ageMaxRange');
const ageFill = document.getElementById('ageFill');
const ageMinThumb = document.getElementById('ageMinThumb');
const ageMaxThumb = document.getElementById('ageMaxThumb');
const ageLabel = document.getElementById('ageLabel');
const ageMinInput = document.getElementById('ageMinInput');
const ageMaxInput = document.getElementById('ageMaxInput');
function updateAgeRange() {
  const values = bindDualRangeUI(ageMinRange, ageMaxRange, ageFill, ageMinThumb, ageMaxThumb, ageMaxValue);
  ageLabel.textContent = values.min + '歳 〜 ' + values.max + '歳';
  ageMinInput.value = values.min;
  ageMaxInput.value = values.max;
}
ageMinRange.addEventListener('input', updateAgeRange);
ageMaxRange.addEventListener('input', updateAgeRange);
ageMinInput.addEventListener('change', () => {
  ageMinRange.value = Math.max(0, Math.min(Number(ageMinInput.value) || 0, Number(ageMaxRange.value)));
  updateAgeRange();
});
ageMaxInput.addEventListener('change', () => {
  ageMaxRange.value = Math.min(ageMaxValue, Math.max(Number(ageMaxInput.value) || ageMaxValue, Number(ageMinRange.value)));
  updateAgeRange();
});
function setAgeRange(min, max) { ageMinRange.value = min; ageMaxRange.value = max; updateAgeRange(); }
function applyAge() { document.getElementById('ageResult').textContent = '✓ ' + ageLabel.textContent + ' を対象に募集します'; }
updateAgeRange();

/* --- 3ポインター: 習熟度レベルのしきい値 --- */
const lvlMaxValue = 100;
const lvlNames = ['初級', '中級', '上級', 'エキスパート'];
const lvlColors = ['#94a3b8', '#3b82f6', '#f59e0b', '#8b5cf6'];
const lvlRanges = [document.getElementById('lvlRange0'), document.getElementById('lvlRange1'), document.getElementById('lvlRange2')];
const lvlThumbs = [document.getElementById('lvlThumb0'), document.getElementById('lvlThumb1'), document.getElementById('lvlThumb2')];
const lvlSegments = [document.getElementById('lvlSeg0'), document.getElementById('lvlSeg1'), document.getElementById('lvlSeg2'), document.getElementById('lvlSeg3')];
const lvlList = document.getElementById('lvlList');
lvlNames.forEach((name, index) => {
  const item = document.createElement('div');
  item.className = 'tier';
  item.style.borderTopColor = lvlColors[index];
  item.innerHTML = `<div class="tier-name">${name}</div><div class="tier-range"></div>`;
  lvlList.appendChild(item);
});
function clampLvl(index) {
  const values = lvlRanges.map((r) => Number(r.value));
  const lowerLimit = index === 0 ? 0 : values[index - 1];
  const upperLimit = index === 2 ? lvlMaxValue : values[index + 1];
  lvlRanges[index].value = Math.min(Math.max(values[index], lowerLimit), upperLimit);
}
function updateLvlSlider() {
  const values = lvlRanges.map((r) => Number(r.value));
  const bounds = [0, ...values, lvlMaxValue];
  lvlRanges.forEach((range, index) => {
    const percent = values[index] / lvlMaxValue * 100;
    lvlThumbs[index].style.left = percent + '%';
    lvlThumbs[index].style.borderColor = lvlColors[index + 1];
  });
  lvlSegments.forEach((segment, index) => {
    const from = bounds[index] / lvlMaxValue * 100;
    const to = bounds[index + 1] / lvlMaxValue * 100;
    segment.style.left = from + '%';
    segment.style.width = (to - from) + '%';
    segment.style.background = lvlColors[index];
  });
  document.querySelectorAll('#lvlList .tier-range').forEach((item, index) => {
    item.textContent = bounds[index] + 'pt 〜 ' + (index === 3 ? '上限なし' : bounds[index + 1] + 'pt');
  });
}
lvlRanges.forEach((range, index) => {
  range.addEventListener('input', () => { clampLvl(index); updateLvlSlider(); });
});
updateLvlSlider();

/* --- 独立した4本の垂直スライダー: イコライザー --- */
const eqBands = [
  { name: '低音', value: 3, color: '#ef4444' },
  { name: 'やや低音', value: 0, color: '#f59e0b' },
  { name: 'やや高音', value: -2, color: '#10b981' },
  { name: '高音', value: 5, color: '#3b82f6' },
];
const eqGroup = document.getElementById('eqGroup');
eqBands.forEach((band, i) => {
  const slot = document.createElement('div');
  slot.className = 'vslot';
  slot.innerHTML = `
    <span class="vlabel" id="eqVal${i}">${band.value > 0 ? '+' : ''}${band.value}</span>
    <div class="vslider-wrap"><input id="eqRange${i}" type="range" min="-12" max="12" step="1" value="${band.value}" style="accent-color:${band.color};"></div>
    <span class="vname">${band.name}</span>
  `;
  eqGroup.appendChild(slot);
  const rangeEl = slot.querySelector('input');
  const valEl = slot.querySelector('.vlabel');
  rangeEl.addEventListener('input', () => {
    const v = Number(rangeEl.value);
    valEl.textContent = (v > 0 ? '+' : '') + v;
  });
});

/* --- 離散マーク式スナップスライダー: 満足度アンケート --- */
const moodItems = [
  { emoji: '😞', text: 'とても不満' },
  { emoji: '🙁', text: '不満' },
  { emoji: '😐', text: '普通' },
  { emoji: '🙂', text: '満足' },
  { emoji: '😄', text: 'とても満足' },
];
const moodRange = document.getElementById('moodRange');
const moodEmoji = document.getElementById('moodEmoji');
const moodText = document.getElementById('moodText');
function updateMood() {
  const item = moodItems[Number(moodRange.value)];
  moodEmoji.textContent = item.emoji;
  moodText.textContent = item.text;
}
moodRange.addEventListener('input', updateMood);
updateMood();

/* --- 回転式ノブ: オーブンタイマー --- */
function knobClampStep(value, min, max, step) {
  let v = Math.min(max, Math.max(min, value));
  const steps = Math.round((v - min) / step);
  v = min + steps * step;
  return Math.min(max, Math.max(min, v));
}
function knobValueFromDrag(startValue, deltaY, min, max, step, pixelsPerFullRange) {
  const raw = startValue + (deltaY / pixelsPerFullRange) * (max - min);
  return knobClampStep(raw, min, max, step);
}
function knobAngleForValue(value, min, max) {
  const pct = (value - min) / (max - min);
  return -135 + pct * 270;
}

(function setupOvenKnob() {
  const knobMin = 0, knobMax = 60, knobStep = 1, pixelsPerFullRange = 200;
  let value = 20;
  const knobEl = document.getElementById('ovenKnob');
  const indicatorEl = document.getElementById('ovenIndicator');
  const valEl = document.getElementById('ovenVal');
  let dragging = false, startY = 0, startValue = 0;

  function render() {
    indicatorEl.style.transform = `rotate(${knobAngleForValue(value, knobMin, knobMax)}deg)`;
    valEl.textContent = value + '分';
    knobEl.setAttribute('aria-valuenow', value);
  }

  function setValue(v) { value = knobClampStep(v, knobMin, knobMax, knobStep); render(); }

  knobEl.addEventListener('pointerdown', (e) => {
    dragging = true; startY = e.clientY; startValue = value;
    knobEl.setPointerCapture(e.pointerId);
    knobEl.focus();
  });
  knobEl.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    setValue(knobValueFromDrag(startValue, startY - e.clientY, knobMin, knobMax, knobStep, pixelsPerFullRange));
  });
  knobEl.addEventListener('pointerup', () => { dragging = false; });
  knobEl.addEventListener('pointercancel', () => { dragging = false; });
  knobEl.addEventListener('wheel', (e) => { e.preventDefault(); setValue(value + (e.deltaY < 0 ? knobStep : -knobStep)); }, { passive: false });
  knobEl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { setValue(value + knobStep); e.preventDefault(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { setValue(value - knobStep); e.preventDefault(); }
    else if (e.key === 'Home') { setValue(knobMin); e.preventDefault(); }
    else if (e.key === 'End') { setValue(knobMax); e.preventDefault(); }
  });

  render();
  window.__ovenKnobTestApi = { setValue, getValue: () => value }; // for automated testing
})();

/* ============ 本家 toolcool-range-slider (公式ライブラリ) ============ */
document.getElementById('tcIso').addEventListener('change', (e) => {
  document.getElementById('tcIsoVal').textContent = e.detail.value1 + 'GB';
});
