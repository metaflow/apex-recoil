/**
* Copyright 2021 Mikhail Goncharov
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*      http://w.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

import { Howl } from "howler";
import Konva from "konva";
import { cursor, layer, stage } from "./main";
import { resumeAttrUpdates, suspendAttrUpdates, BooleanAttribute, NumericAttribute, StringAttribute, watch, initAttributes } from './storage';
import { Point } from "./point";
import specs from './specs.json';
import theme from '../theme.json';
import { addStat, aStats, distanceScore, loadStats, percentile, statsForSetup, TrialSetup } from "./stats";
import { clamp, numberToDate, today } from "./utils";
import assertExists from "ts-assert-exists";
import hotkeys from "hotkeys-js";

let sound: Howl | null = null;
let soundPath = '';
const weapons = new Map<string, Weapon>();
const colorStartCircle = theme.colorStartCircle;
const colorHintPath = theme.colorHintPath;
const scoreGradient = theme.scoreGradient;
let tracePreview: TracePreview | null = null;
const traceShapeTypes = 3;

let startRectangle = new Konva.Rect({
  stroke: theme.foreground,
  strokeWidth: 0.5,
  dash: [1, 9],
});
let startRect: Rect = {
  topLeft: new Point(0, 0),
  bottomRight: new Point(10, 10),
};
let pattern: Point[] = [];
let patternBox: [Point, Point] = [new Point(), new Point()];
let animation: Konva.Animation | null = null;
const NS = 'game:';
const aRecoilWeapon = new BooleanAttribute('stationary-target', NS, true);
const aShowDetailedStats = new BooleanAttribute('show-detailed-stats', NS, false);
const aShowSensitivityWarn = new BooleanAttribute('show-sensitivity-warn', NS, false);
const aShowInstructions = new BooleanAttribute('show-instructions', NS, true);
const aMovingTarget = new BooleanAttribute('moving-target', NS, false);
const aTargetSpeed = new NumericAttribute('target-speed', NS, 100);
const aSens = new NumericAttribute('sens', NS, 5);
const aWeapon = new StringAttribute('weapon', NS, 'r99');
const aMag = new NumericAttribute('mag', NS, 0);
const aVolume = new NumericAttribute('volume', NS, 20);
const aMute = new BooleanAttribute('mute', NS, false);
const aInvertY = new BooleanAttribute('invert-y', NS, false);
const aHint = new BooleanAttribute('hint', NS, true);
const aTraceMode = new NumericAttribute('trace-mode', NS, 1);
const aFireSpeed = new NumericAttribute('speed', NS, 100);

export interface MagInfo {
  size: number;
  audio: string;
};

export interface Weapon {
  name: string;
  mags: MagInfo[];
  timePoints: number[];
  x: number[];
  y: number[];
}

interface Rect {
  topLeft: Point;
  bottomRight: Point;
}

function pointInRect(p: Point, r: Rect) {
  return p.x >= r.topLeft.x && p.x <= r.bottomRight.x
    && p.y >= r.topLeft.y && p.y <= r.bottomRight.y;
}

interface Frame {
  timeDiff: number;
  frameRate: number;
}

class Target {
  private pos = new Point(-10, -10);
  circle: Konva.Circle;
  next = new Point();
  private v = 1;
  shapes: Konva.Shape[] = [];
  moving: boolean = false;
  private _offset = new Point();
  private dirty = false;
  constructor() {
    this.circle = new Konva.Circle({
      radius: 6,
      stroke: colorStartCircle,
      strokeWidth: 2,
      position: this.pos,
    });
    // As it's called before layer is created.
    window.setTimeout(() => {
      this.addShape(this.circle);
    });
  }
  addShape(s: Konva.Shape) {
    layer.add(s);
    this.shapes.push(s);
  }
  clear() {
    this.shapes.forEach(s => s.destroy());
  }
  onSettingsUpdated() {
    this.moving = aMovingTarget.get();
    this.v = aTargetSpeed.get() * scale() / 1000;
    if (this.moving && !pointInRect(this.pos, startRect)) {
      this.pos.x = Math.max(0, (startRect.topLeft.x + startRect.bottomRight.x) / 2);
      this.pos.y = Math.max(0, (startRect.topLeft.y + startRect.bottomRight.y) / 2);
    }
    this.pickNext();
  }
  pickNext() {
    const d = startRect.bottomRight.clone().sub(startRect.topLeft);
    d.x *= Math.random();
    d.y *= Math.random();
    d.add(startRect.topLeft);
    this.next = d;
    this.v = aTargetSpeed.get() * scale() / 1000;
    this.circle.radius(6 * scale()); // Head radius from 40m is ~6px.
    this.dirty = true;
  }
  frame(f: Frame): boolean {
    let update = this.dirty;
    if (this.moving) {
      let d = this.next.clone().sub(this.pos);
      const move = f.timeDiff * this.v;
      if (d.length() < move) {
        this.pickNext();
        d = this.next.clone().sub(this.pos);
      } else {
        this.pos.add(d.s(move / d.length()));
      }
      if (!pointInRect(this.pos, startRect)) {
        console.log(f.timeDiff, d, this.pos);
      }
      update = true;
    }
    if (update) {
      this.circle.position(this.pos);
      this.circle.offset(this._offset);
      this.dirty = false;
    }
    return update;
  }
  position(p?: Point): Point {
    if (p) {
      this.pos = p;
      this.dirty = true;
    }
    return this.pos.clone();
  }
  offset(p?: Point): Point {
    if (p) {
      this._offset = p;
      this.dirty = true;
    }
    return this._offset;
  }
}
let target: Target = new Target();

export function trialSetup(): TrialSetup {
  const weapon = aWeapon.get();
  const w = selectedWeapon();
  let mag = Math.min(aMag.get(), w.mags.length - 1);
  return {
    weapon,
    mag,
    hint: aHint.get(),
    moving: aMovingTarget.get(),
  };
}

function instructionsControls() {
  aShowInstructions.watch((v: boolean) => {
    const e = document.getElementById('instructions');
    if (!e) return;
    if (!v) {
      e.classList.add('hidden');
    } else {
      e.classList.remove('hidden');
      aShowDetailedStats.set(false);
    }
  });
  {
    const e = document.getElementById('dismiss-instructions');
    e?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      aShowInstructions.set(false);
      return false;
    });
  }

  {
    const e = document.getElementById('show-instructions-btn');
    e?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      aShowInstructions.set(true);
      return false;
    });
  }
}

function selectedWeapon(): Weapon {
  const w = weapons.get(aWeapon.get());
  if (w == null) throw Error("weapon not found");
  return w;
}

function updateSound() {
  if (aMute.get()) return;
  const w = selectedWeapon();
  const newPath = `./audio/${w.mags[Math.min(aMag.get(), w.mags.length - 1)].audio}.mp3`;
  if (soundPath != newPath) {
    soundPath = newPath;
    sound = new Howl({ src: soundPath });
  }
}

function soundControls() {
  watch([aWeapon, aMag, aMute], updateSound);
  const mute = (document.getElementById('muted') as HTMLImageElement);
  const unmute = (document.getElementById('unmuted') as HTMLImageElement);
  if (mute != null || unmute != null) {
    aMute.watch((v: boolean) => {
      if (v) {
        unmute.classList.add('hidden');
        mute.classList.remove('hidden');
      } else {
        unmute.classList.remove('hidden');
        mute.classList.add('hidden');
      }
    });
    unmute.addEventListener('click', () => aMute.set(true));
    mute.addEventListener('click', () => aMute.set(false));
  }
}

function scale() {
  return clamp(1 / aSens.get(), 0.1, 10);
}

function gradientColor(x: number) {
  x = Math.min(1, Math.max(0, x));
  // Make gradient more pronounced around 1..0.9.
  x = 1 - Math.sqrt(1 - x * x);
  const idx = Math.round(x * 10);
  return scoreGradient[idx];
}

function box(pattern: Point[]): [Point, Point] {
  const a = new Point();
  const b = new Point();
  pattern.forEach(p => {
    const d = pattern[0].clone().sub(p);
    a.x = Math.min(a.x, d.x);
    a.y = Math.min(a.y, d.y);
    b.x = Math.max(b.x, d.x);
    b.y = Math.max(b.y, d.y);
  });
  return [a, b];
}

function drawPattern(pattern: Point[], mag: number, start: Point, sc: number) {
  const hintLinePoints: number[] = [];
  const circles: Konva.Circle[] = [];
  pattern.forEach((p, i) => {
    if (i >= mag) return;
    const xy = start.clone().sub(p);
    hintLinePoints.push(xy.x, xy.y);
    if (sc > 0.3) {
      const c = new Konva.Circle({
        radius: 1,
        stroke: colorHintPath,
        strokeWidth: 1,
        position: xy,
      });
      circles.push(c);
    }
  });
  const hintLine = new Konva.Line({
    points: hintLinePoints,
    stroke: colorHintPath,
    strokeWidth: 1,
  });
  return [hintLine, circles];
}

class TracePreview {
  shapes: Konva.Shape[] = [];
  constructor() {
    const w = selectedWeapon();
    const sc = scale();
    if (!Number.isFinite(sc) || sc < 0.1) return;
    const n = w.mags[Math.min(aMag.get(), w.mags.length - 1)].size;
    pattern = [];
    const my = aInvertY.get() ? -1 : 1;
    for (let i = 0; i < n; i++) pattern.push(new Point(w.x[i], my * w.y[i]).s(sc));
    patternBox = box(pattern);
    const [line, circles] = drawPattern(pattern, n, patternBox[0].clone().s(-1).add(new Point(50, 50)), sc);
    this.addShape(line as Konva.Line);
    (circles as Konva.Circle[]).forEach(c => this.addShape(c));
    redraw();
  }
  addShape(s: Konva.Shape) {
    layer.add(s);
    this.shapes.push(s);
  }
  clear() {
    this.shapes.forEach(s => s.remove());
    this.shapes = [];
  }
}

let redrawTimeout: number | null;
function redraw() {
  if (redrawTimeout) return;
  redrawTimeout = window.setTimeout(() => {
    stage.batchDraw();
    redrawTimeout = null;
  }, 0);
}

function redrawStartRectangle() {
  if (patternBox.length < 2) return;
  const r = stage.container().getBoundingClientRect();
  const p = patternBox[0].clone();
  let bottomRight = new Point(
    window.innerWidth - r.left - patternBox[1].x - 50,
    window.innerHeight - r.top - patternBox[1].y - 50);
  const topLeft = p.clone().s(-1);
  const wh = bottomRight.sub(topLeft);
  wh.x = Math.max(1, wh.x);
  wh.y = Math.max(1, wh.y);
  bottomRight = topLeft.clone().add(wh);
  aShowSensitivityWarn.set(wh.x < 100 || wh.y < 100);
  startRectangle.x(Math.max(1, topLeft.x));
  startRectangle.y(Math.max(1, topLeft.y));
  startRectangle.width(wh.x);
  startRectangle.height(wh.y);
  startRect = {
    topLeft,
    bottomRight
  };
  target.onSettingsUpdated();
}

function weaponControls() {
  specs.forEach(s => {
    weapons.set(s.name, {
      name: s.name,
      mags: s.mags.map(m => {
        var z: MagInfo = { size: m.size, audio: m.audio };
        return z;
      }),
      timePoints: s.time_points,
      x: s.x,
      y: s.y,
    });
    const d = document.querySelector(`#weapon-select .${s.name}`) as HTMLDivElement;
    if (d != null) d.addEventListener('click', () => aWeapon.set(s.name));
  });

  aWeapon.watch((v: string) => {
    const s = document.querySelector(`#weapon-select .selected`) as HTMLDivElement;
    if (s != null) s.classList.remove('selected');
    const d = document.querySelector(`#weapon-select .${v}`) as HTMLDivElement;
    if (d == null) return;
    d.classList.add('selected');
    const w = selectedWeapon();
    console.log('mags', w.mags.length);
    for (let i = 0; i <= 3; i++) {
      setClass(document.querySelector(`#mag-select .mag-${i}`), 'hidden', w.mags.length == 1);
    }
    setClass(document.querySelector(`#mag-select .mag-drop`), 'hidden', w.mags.length != 1);
  });
  for (let i = 0; i <= 3; i++) {
    const d = document.querySelector(`#mag-select .mag-${i}`) as HTMLDivElement;
    if (d != null) {
      d.addEventListener('click', () => aMag.set(i));
    } else {
      console.error(`#mag-select .mag-${i}`, 'not found');
    }
  }
  aMag.watch((v: number) => {
    const s = document.querySelector(`#mag-select .selected`) as HTMLDivElement;
    if (s != null) s.classList.remove('selected');
    const d = document.querySelector(`#mag-select .mag-${v}`) as HTMLDivElement;
    if (d == null) return;
    d.classList.add('selected');
  });
}

interface I18n {
  median: string;
  best: string;
  tries: string;
  score: string;
}
 
function getLocale(): I18n {
  const locale = (window as any).game_locale;
  switch (locale) {
    case 'ru':
      return {
        median: 'медиана',
        best: 'лучший',
        tries: 'попыток',
        score: 'очков',
      };
    default:
      return {
        median: 'median',
        best: 'best',
        tries: 'tries',
        score: 'score',
      };
  }
}

function statControls() {
  aShowDetailedStats.watch((v: boolean) => {
    const e = document.getElementById('detailed-stats');
    if (!e) return;
    if (v) {
      e.classList.remove('hidden');
      aShowInstructions.set(false);
      showStats();
    } else {
      e.classList.add('hidden');
    }
  });
  document.getElementById('hide-stats')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    aShowDetailedStats.set(false);
    return false;
  });
  {
    const btn = assertExists(document.getElementById('stats-graph-btn'));
    document.getElementById('stats-graph-btn')?.addEventListener('click', () => {
      aShowDetailedStats.set(!aShowDetailedStats.get());
    });
    aShowDetailedStats.watch((v: boolean) => setClass(btn, 'selected', v));
  }
}

function setClass(element: HTMLElement | null, name: string, v: boolean) {
  if (element == null) return;
  if (v) {
    element.classList.add(name);
  } else {
    element.classList.remove(name);
  }
}

function showStats() {
  const s = statsForSetup(trialSetup());
  if (aShowDetailedStats.get()) {
    const x: string[] = [];
    const median: number[] = [];
    const best: number[] = [];
    const count: number[] = [];
    if (s) {
      s.dayResults.forEach(dayResults => {
        x.push(numberToDate(dayResults[0]));
        median.push(dayResults[2]);
        best.push(dayResults[3]);
        count.push(dayResults[1]);
      });
      if (s.todayResults.length > 0) {
        x.push(numberToDate(today()));
        median.push(percentile(s.todayResults, 0.5));
        best.push(percentile(s.todayResults, 1));
        count.push(s.todayResults.length);
      }
    }
    (window as any).updateGraph(x, median, best, count, getLocale());
  }
  const b = document.getElementById('score-stats');

  if (b) {
    let todayCount = '-';
    let todayMedian = '-';
    let todayBest = '-';
    let allTimeBest = '-';
    if (s) {
      allTimeBest = `${s.bestAllTime}`;
      if (s.todayResults.length > 0) {
        todayCount = `${s.todayResults.length}`;
        todayMedian = `${Math.round(percentile(s.todayResults, 0.5))}`;
        todayBest = `${percentile(s.todayResults, 1)}`;
      }
    }
    const locale = (window as any).game_locale;
    switch (locale) {
      case 'ru':
        b.innerText = `Сегодня: ${todayCount} попытки, ${todayMedian} медиана,\n${todayBest} лучший результат.\nЛучший за все время ${allTimeBest}.`;
        break;
      default:
         b.innerText = `Today's tries ${todayCount}, median ${todayMedian}, best ${todayBest}\nAll time best ${allTimeBest}`;
         break;
    }    
  }
}

class Shooting {
  startPos: Point; // Starting position.
  totalFrames = 0;
  score = 0;
  mag = 1;
  speed = 1;
  hitMarker = new Konva.Circle();
  hitVectors: Point[] = [];
  pattern: Point[] = [];
  hitScores: number[] = [];
  showHint = true;
  start_t = 0;
  weapon: Weapon = { name: '', mags: [], x: [], y: [], timePoints: [] };
  hitIndex = -1; // Position in the patter we already passed.
  hitMarkers: Konva.Circle[] = [];
  crossHair?: Konva.Circle;
  hintGroup: Konva.Group;
  wallGroup: Konva.Group;
  recoilGroup: Konva.Group;
  recoilTarget: boolean = false;
  traceShapes: Konva.Shape[][] = [];
  running: boolean = false;
  shapes: (Konva.Shape | Konva.Group)[] = [];
  movingTarget: boolean = false;

  constructor() {
    this.startPos = new Point();
    this.hintGroup = new Konva.Group();
    this.wallGroup = new Konva.Group();
    this.recoilGroup = new Konva.Group();
  }

  start() {
    this.weapon = selectedWeapon();
    this.running = true;
    this.addShape(this.hintGroup);
    this.addShape(this.wallGroup);
    this.addShape(this.recoilGroup);
    suspendAttrUpdates();
    this.recoilTarget = !aRecoilWeapon.get();
    this.movingTarget = aMovingTarget.get();
    this.start_t = Date.now();
    const cur = cursor();
    this.startPos = cur.clone();
    const sc = scale();
    this.speed = clamp(aFireSpeed.get() / 100, 0.1, 1);
    this.mag = this.weapon.mags[Math.min(aMag.get(), this.weapon.mags.length - 1)]?.size || 1;
    if (!aMute.get() && sound != null) {
      sound.volume(aVolume.get() / 100);
      sound.rate(this.speed);
      sound.play();
    }
    for (let i = 0; i < traceShapeTypes; i++) this.traceShapes.push([]);
    this.showHint = aHint.get() && !this.movingTarget;
    this.hintGroup.visible(this.showHint);
    // Target.
    if (!this.movingTarget) {
      target.position(this.startPos.clone());
      target.offset(new Point());
    }
    const my = aInvertY.get() ? -1 : 1;
    this.pattern = this.weapon.x.map((x, idx) => {
      return new Point(x, my * this.weapon.y[idx]).s(sc);
    });
    {
      const [ln, circles] = drawPattern(this.pattern, this.mag, this.startPos.clone(), sc);
      this.hintGroup.add(ln as Konva.Line);
      (circles as Konva.Circle[]).forEach(c => this.hintGroup.add(c));
    }
    // Replace cursor with a fixed point.
    if (this.recoilTarget || !this.showHint) {
      this.crossHair = new Konva.Circle({
        radius: 2,
        fill: 'red',
        position: cur.plain(),
      });
      this.addShape(this.crossHair);
      stage.container().classList.add('no-cursor');
    }
    this.frame();
    stage.batchDraw();
    stage.listening(false);
  }

  recoilVector(t: number, i: number): [Point, number] {
    while (i + 1 < this.mag && t > this.weapon.timePoints[i + 1]) i++;
    if (i == -1) return [new Point(), i];
    if (i + 1 >= this.mag) return [this.pattern[this.mag - 1].clone(), i];
    const dt = (this.weapon.timePoints[i + 1] - this.weapon.timePoints[i]);
    let progress = Math.max(Math.min((t - this.weapon.timePoints[i]) / dt, 1), 0);
    const p = this.pattern[i];
    return [this.pattern[i + 1].clone().sub(p).s(progress).add(p), i];
  }

  frame(): boolean {
    if (!this.running) return false;
    this.totalFrames++;
    const sc = scale();
    const cur = cursor();
    const dCur = cur.clone().sub(this.startPos);
    const frame_t = (Date.now() - this.start_t) * this.speed + 8; // Add half frame.
    let [vRecoil, i] = this.recoilVector(frame_t, this.hitIndex);
    let [vRecoilNextFrame, _] = this.recoilVector(frame_t + 24, i);
    this.recoilGroup.offset(vRecoilNextFrame);
    const vRecoilCompensated = vRecoil.clone().add(dCur);
    if (this.recoilTarget) {
      this.hintGroup.offset(dCur);
    } else {
      this.crossHair?.offset(vRecoilCompensated.clone().s(-1));
    }
    this.wallGroup.offset(vRecoilCompensated);
    if (this.recoilTarget) {
      target.offset(vRecoilCompensated.clone());
    } else {
      if (this.showHint && !this.movingTarget) {
        target.offset(vRecoilNextFrame.clone());
      }
    }
    // Register new shots.
    while (this.hitIndex < i) {
      this.hitIndex++;
      const p = this.pattern[this.hitIndex];
      this.hitVectors.push(cur.clone().sub(target.position()));
      let hit = cur.clone().add(p);
      const rawDistance = hit.distance(target.position()) / sc;
      let s = distanceScore(rawDistance);
      this.hitScores.push(s);
      this.score += s;
      this.hitMarker.radius(this.recoilTarget ? 1 : 2);
      var hitP: Point;
      if (this.recoilTarget) {
        hitP = this.startPos.clone().add(new Point(this.wallGroup.offset()));
      } else {
        hitP = cur.clone().add(p);
      }
      this.hitMarker = new Konva.Circle({
        radius: Math.max(4 * sc, 2),
        fill: gradientColor(this.hitScores[this.hitScores.length - 1]),
        position: hitP,
      });
      this.hitMarkers.push(this.hitMarker);
      if (this.recoilTarget) {
        this.wallGroup.add(this.hitMarker);
      } else {
        this.addShape(this.hitMarker);
      }
      this.traceShapes[0].push(this.hitMarker);
      this.hitMarker.zIndex(0); // To put behind the scope.
    }
    if (this.hitIndex + 1 >= this.mag) this.finish();
    return true;
  }

  finish() {
    this.running = false;
    stage.listening(true);
    resumeAttrUpdates();
    this.score /= this.mag;
    this.score = Math.max(0, Math.min(1, this.score));
    const x = Math.round(100 * this.score);
    if (this.speed == 1) addStat(x, trialSetup());
    this.hintGroup.visible(true);
    this.hitMarkers.forEach(m => m.radius(2));
    const txt = new Konva.Text({
      text: `${x}`,
      fontSize: 20,
      fill: gradientColor(this.score),
      shadowColor: theme.background,
      shadowBlur: 0,
      shadowOffset: { x: 1, y: 1 },
      shadowOpacity: 1,
    });
    txt.position(this.startPos.clone().add(new Point(20, -10)).plain());
    this.addShape(txt);
    // Display trail.
    this.hitVectors.forEach((v, idx) => {
      const p = this.pattern[idx];
      const c = this.startPos.clone().add(v);
      let traceTarget = this.startPos.clone().sub(p);
      const clr = gradientColor(this.hitScores[idx]);
      const b = new Konva.Circle({
        radius: 2,
        fill: clr,
        position: this.startPos.clone().add(v),
        visible: false,
      });
      (this.traceShapes[0][idx] as Konva.Circle).position(v.clone().add(p).add(this.startPos));
      this.hintGroup.add(b);
      this.traceShapes[1].push(b);
      const ln = new Konva.Line({
        points: [c.x, c.y, traceTarget.x, traceTarget.y],
        stroke: clr,
        strokeWidth: 1,
        visible: false,
      });
      this.traceShapes[2].push(ln);
      this.hintGroup.add(ln);
    });
    this.displayTace();
    this.hintGroup.offset(new Point());
    this.wallGroup.offset(new Point());
    this.recoilGroup.offset(new Point());
    target.offset(new Point());
    this.crossHair?.visible(false);
    stage.container().classList.remove('no-cursor');
    redraw();
  }
  displayTace() {
    // if (this.movingTarget) return;
    const d = aTraceMode.get() % traceShapeTypes;
    this.traceShapes.forEach((sh, i) => sh.forEach(s => s.visible(i == d)));
  }
  clear() {
    this.shapes.forEach(s => s.destroy());
    this.shapes = [];
  }
  addShape(s: Konva.Shape | Konva.Group) {
    this.shapes.push(s);
    layer.add(s);
  }
}
let shooting = new Shooting();

export function setupGame() {
  /* https://konvajs.org/docs/sandbox/Animation_Stress_Test.html#page-title
  * setting the listening property to false will improve
  * drawing performance because the rectangles won't have to be
  * drawn onto the hit graph */
  initAttributes(NS);
  layer.listening(false);
  layer.add(startRectangle);
  loadStats();
  soundControls();
  instructionsControls();
  weaponControls();
  statControls();
  {
    const d = document.querySelector(`#invert-y-btn`) as HTMLDivElement;
    if (d != null) {
      d.addEventListener('click', () => aInvertY.set(!aInvertY.get()));
      aInvertY.watch((v: boolean) => setClass(d, 'selected', v));
    }
  }
  
  watch([aWeapon, aMag, aSens, aInvertY], () => {
    if (shooting.running) return;
    shooting.clear();
    tracePreview?.clear();
    tracePreview = new TracePreview();
    redrawStartRectangle();
  });
  window.addEventListener('resize', () => {
    redrawStartRectangle();
  });
  aShowDetailedStats.watch(redrawStartRectangle);
  aShowInstructions.watch(redrawStartRectangle);
  watch([aStats, aMag, aWeapon, aHint], showStats);
  aMovingTarget.watch(showStats); // TODO add watching of multiple obj attributes.
  {
    const b = document.getElementById('speed-value');
    if (b) aFireSpeed.watch((s: number) => {
      b.innerText = `x ${s / 100}`;
    });
  }
  aTraceMode.watch(() => {
    shooting.displayTace();
    redraw();
  });
  aShowSensitivityWarn.watch((v: boolean) => {
    const w = document.getElementById('sensitivity-warning');
    if (w == null) return;
    if (v) {
      w.classList.remove('hidden');
    } else {
      w.classList.add('hidden');
    }
  });
  stage.on('mousedown', function (e: Konva.KonvaEventObject<MouseEvent>) {
    e.evt.preventDefault();
    switch (e.evt.button) {
      case 0:
        if (!shooting.running) {
          shooting.clear();
          shooting = new Shooting();
          tracePreview?.clear();
          tracePreview = null;
          shooting.start();
        }
        break;
      case 1:
        aTraceMode.set((aTraceMode.get() + 1) % traceShapeTypes);
        break;
      default:
        break;
    }
  });
  aMovingTarget.watch((v: boolean) => {
    target.onSettingsUpdated();
  });
  aTargetSpeed.watch((v: number) => {
    const e = document.getElementById("target-speed-value");
    if (e) e.innerText = `${v}`;
    target.onSettingsUpdated();
  });
  {
    const btnModeMoving = assertExists(document.getElementById('mode-moving'));
    const btnFixedPath = assertExists(document.getElementById('mode-fixed-path'));
    const btnFixed = assertExists(document.getElementById('mode-fixed'));
    watch([aHint, aMovingTarget], () => {
      btnFixed.classList.remove('selected');
      btnFixedPath.classList.remove('selected');
      btnModeMoving.classList.remove('selected');
      if (aMovingTarget.get()) {
        btnModeMoving.classList.add('selected');
        return;
      }
      if (aHint.get()) {
        btnFixedPath.classList.add('selected');
        return;
      }
      btnFixed.classList.add('selected');
    });
    btnFixedPath.addEventListener('click', () => {
      aHint.set(true);
      aMovingTarget.set(false);
    });
    hotkeys('a', () => {
      aHint.set(true);
      aMovingTarget.set(false);
    });
    btnFixed.addEventListener('click', () => {
      aHint.set(false);
      aMovingTarget.set(false);
    });
    hotkeys('s', () => {
      aHint.set(false);
      aMovingTarget.set(false);
    });
    btnModeMoving.addEventListener('click', () => {
      aHint.set(false);
      aMovingTarget.set(true);
    });
    hotkeys('d', () => {
      aHint.set(false);
      aMovingTarget.set(true);
    });
  }
  {
    const btnRecoilTarget = assertExists(document.getElementById('recoil-target'));
    const btnRecoilWeapon = assertExists(document.getElementById('recoil-weapon'));
    aRecoilWeapon.watch((v: boolean) => {
      if (v) {
        btnRecoilTarget.classList.remove('selected');
        btnRecoilWeapon.classList.add('selected');
      } else {
        btnRecoilTarget.classList.add('selected');
        btnRecoilWeapon.classList.remove('selected');
      }
    });
    btnRecoilWeapon.addEventListener('click', () => {
      aRecoilWeapon.set(true);
    });
    btnRecoilTarget.addEventListener('click', () => {
      aRecoilWeapon.set(false);
    });
  }
  {
    for (let i = 0; i < traceShapeTypes; i++) {
      const e = assertExists(document.getElementById(`trace-${i}`));
      e.addEventListener('click', () => aTraceMode.set(i));
    }
    aTraceMode.watch((v: number) => {
      for (let i = 0; i < traceShapeTypes; i++) {
        const e = assertExists(document.getElementById(`trace-${i}`));
        setClass(e, 'selected', i == v);
      }
    });
  }

  const fpsTxt = new Konva.Text({
    text: `FPS: -`,
    fontSize: 14,
    fill: theme.foreground,
    shadowBlur: 0,
    shadowOffset: { x: 1, y: 1 },
    shadowOpacity: 1,
    x: 10,
    y: 10,
  });
  layer.add(fpsTxt);
  const fps: number[] = [];
  for (let i = 0; i < 10; i++) fps.push(0);
  let fpsIdx = 0;
  let fpsSum = 0;
  animation = new Konva.Animation((f: any) => {
    const a = target.frame(f);
    const b = shooting.frame();
    if (a || b) {
      fpsIdx = (fpsIdx + 1) % 10;
      fpsSum += f.frameRate - fps[fpsIdx];
      fps[fpsIdx] = f.frameRate;
      fpsTxt.text(`FPS: ${Math.round(fpsSum / 10)}`);
    }
    return a || b;
  }, [layer]);
  animation.start();
}