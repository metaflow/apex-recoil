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
import { resumeAttrUpdates, setAttr, getAttr, initAttr, attrInput, attrNamespace, createAttrFunc, suspendAttrUpdates, watchAttr, BooleanAttribute, NumericAttribute } from './storage';
import { Point } from "./point";
import specs from './specs.json';
import theme from '../theme.json';
import { addStat, distanceScore, loadStats, percentile, statsForSetup, TrialSetup } from "./stats";
import { clamp, numberToDate, today } from "./utils";
import { raw } from "express";


let sound: Howl | null = null;
let soundPath = '';
const weapons = new Map<string, Weapon>();
const colorStartCircle = theme.colorStartCircle;
const colorHintPath = theme.colorHintPath;
const scoreGradient = theme.scoreGradient;
let shooting: Shooting | null = null;
let tracePreview: TracePreview | null = null;
let target: Target | null = null;
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
let patternBox: [Point, Point];
let animation: Konva.Animation | null = null;
const NS = 'game:';
const aStationaryTarget = new BooleanAttribute('stationary-target', NS, true);
const aShowDetailedStats = new BooleanAttribute('show-detailed-stats', NS, false);
const aShowSensitivityWarn = new BooleanAttribute('show-sensitivity-warn', NS, false);
const aShowInstructions = new BooleanAttribute('show-instructions', NS, true);
const aMovingTarget = new BooleanAttribute('moving-target', NS, false);
const aTargetSpeed = new NumericAttribute('target-speed', NS, 100);

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
}

class Target {
  pos = new Point(10, 10);
  rectSize = new Point();
  circle: Konva.Circle;
  skew = 2;
  next = new Point();
  v = 0.1;
  shapes: Konva.Shape[] = [];
  moving: boolean = false;
  offset = new Point();
  multiplier: number = 1;
  r = 6;
  constructor() {
    this.circle = new Konva.Circle({
      radius: 6,
      stroke: colorStartCircle,
      strokeWidth: 2,
      position: this.pos,
    });
    this.addShape(this.circle);
    this.onSettingsUpdated();
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
    this.v = aTargetSpeed.get() * scale() * this.multiplier / 1000;
    this.rectSize = startRect.bottomRight.sub(startRect.topLeft);
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
    this.multiplier = 1 + Math.random() * (this.skew - 1);
    if (!this.moving) this.multiplier = 1;
    this.v = aTargetSpeed.get() * scale() * this.multiplier / 1000;
  }
  frame(f: Frame): boolean {
    if (this.moving) {
      let d = this.next.clone().sub(this.pos);
      let dtl = this.pos.clone().sub(startRect.topLeft);
      let s = 1 + this.skew * clamp(dtl.y / this.rectSize.y, 0, 1);
      const move = f.timeDiff * this.v ;
      if (d.length() < move) {
        this.pickNext();
        d = this.next.clone().sub(this.pos);
      }
      this.pos.add(d.s(move / d.length()));
    }
    this.r = 6 * this.multiplier;
    this.circle.radius(this.r * scale());
    // TODO: sometimes this does not change anything, watch own pos / offset.
    this.circle.position(this.absolutePos());
    return true;
  }
  radius() {
    return this.r;
  }
  absolutePos() {
    return this.pos.clone().add(this.offset);
  }
}

export function trialSetup(): TrialSetup {
  const weapon = getAttr('weapon');
  let mag = getAttr('mag');
  if (weapon == 'prowler') mag = '0';
  return {
    weapon,
    mag,
    hint: getAttr('hint'),
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

function updateSound() {
  if (getAttr('mute') == 'true') return;
  const w = weapons.get(getAttr('weapon'));
  if (w == null) {
    console.log('weapon', getAttr('weapon'), 'not found');
    return;
  }
  const newPath = `./audio/${w.mags[Number(getAttr('mag'))].audio}.mp3`;
  if (soundPath != newPath) {
    soundPath = newPath;
    sound = new Howl({ src: soundPath });
  }
}

function soundControls() {
  watchAttr(['weapon', 'mag', 'mute'], updateSound);
  const mute = (document.getElementById('muted') as HTMLImageElement);
  const unmute = (document.getElementById('unmuted') as HTMLImageElement);
  if (mute != null || unmute != null) {
    watchAttr(['mute'], (v: string) => {
      if (v == 'true') {
        unmute.classList.add('hidden');
        mute.classList.remove('hidden');
      } else {
        unmute.classList.remove('hidden');
        mute.classList.add('hidden');
      }
    });
    unmute.addEventListener('click', () => setAttr('mute', 'true'));
    mute.addEventListener('click', () => setAttr('mute', 'false'));
  }
}

function scale() {
  const sens = Number(getAttr('sens'));
  return 1 / sens;
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
    const name = getAttr('weapon');
    const w = weapons.get(name);
    const sc = scale();
    if (!Number.isFinite(sc) || sc < 0.1) return;
    if (w == null) {
      console.error('weapon', getAttr('weapon'), 'not found');
      return;
    }
    const n = w.mags[Number(getAttr('mag'))].size;
    pattern = [];
    for (let i = 0; i < n; i++) pattern.push(new Point(w.x[i], w.y[i]).s(sc));
    patternBox = box(pattern);
    const [line, circles] = drawPattern(pattern, n, patternBox[0].clone().s(-1).add(new Point(50, 50)), sc);
    this.addShape(line as Konva.Line);
    (circles as Konva.Circle[]).forEach(c => this.addShape(c));
    target?.onSettingsUpdated();
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
  target?.onSettingsUpdated();
  redraw();
}

// function clear() {
//   layer.removeChildren();
//   traceShapes = [];
// }

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
    if (d != null) {
      d.addEventListener('click', () => {
        setAttr('weapon', s.name);
      });
    }
  });

  watchAttr('weapon', (v: string) => {
    const s = document.querySelector(`#weapon-select .selected`) as HTMLDivElement;
    if (s != null) s.classList.remove('selected');
    const d = document.querySelector(`#weapon-select .${v}`) as HTMLDivElement;
    if (d == null) return;
    d.classList.add('selected');
  });

  for (let i = 0; i <= 3; i++) {
    const d = document.querySelector(`#mag-select .mag-${i}`) as HTMLDivElement;
    if (d != null) {
      d.addEventListener('click', () => { setAttr('mag', i + ''); });
    } else {
      console.error(`#mag-select .mag-${i}`, 'not found');
    }
  }

  watchAttr('mag', (v: string) => {
    const s = document.querySelector(`#mag-select .selected`) as HTMLDivElement;
    if (s != null) s.classList.remove('selected');
    const d = document.querySelector(`#mag-select .mag-${v}`) as HTMLDivElement;
    if (d == null) return;
    d.classList.add('selected');
  });
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
  document.getElementById('stats-graph-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    aShowDetailedStats.set(!aShowDetailedStats.get());
    return false;
  });
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
    (window as any).updateGraph(x, median, best, count);
  }
  const b = document.getElementById('score-stats');
  if (b) {
    b.innerText = "Today's tries -, median -, best -\nAll time best -";
    if (s) {
      if (s.todayResults.length > 0) {
        b.innerText = `Today's tries ${s.todayResults.length}, median ${Math.round(percentile(s.todayResults, 0.5))}, best ${percentile(s.todayResults, 1)}
                    All time best ${s.bestAllTime}`;
      } else {
        b.innerText = `Today's tries -, median -, best -\nAll time best ${s.bestAllTime}`;
      }
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
  hitCursors: Point[] = [];
  hitVectors: Point[] = [];
  pattern: Point[] = [];
  hitScores: number[] = [];
  showHint = true;
  start_t = 0;
  weapon: Weapon;
  hitIndex = -1; // Position in the patter we already passed.
  hitMarkers: Konva.Circle[] = [];
  crossHair?: Konva.Circle;
  hintGroup: Konva.Group;
  wallGroup: Konva.Group;
  recoilGroup: Konva.Group;
  fpsText: Konva.Text;
  recoilTarget: boolean;
  traceShapes: Konva.Shape[][] = [];
  finished: boolean = false;
  shapes: (Konva.Shape | Konva.Group)[] = [];
  movingTarget: boolean;

  constructor() {
    this.startPos = new Point();
    this.movingTarget = aMovingTarget.get();
    this.weapon = weapons.get(getAttr('weapon'))!;
    if (this.weapon == null) throw Error("weapon not found");
    this.hintGroup = new Konva.Group();
    this.addShape(this.hintGroup);
    this.wallGroup = new Konva.Group();
    this.addShape(this.wallGroup);
    this.recoilGroup = new Konva.Group();
    this.addShape(this.recoilGroup);
    this.fpsText = new Konva.Text({
      text: `FPS: -`,
      fontSize: 14,
      fill: theme.foreground,
      shadowBlur: 0,
      shadowOffset: { x: 1, y: 1 },
      shadowOpacity: 1,
      x: 10,
      y: 10,
    });
    this.addShape(this.fpsText);
    this.recoilTarget = !aStationaryTarget.get();
    redrawStartRectangle();
  }

  start() {
    this.start_t = Date.now();
    const cur = cursor();
    this.startPos = cur.clone();
    suspendAttrUpdates();
    this.weapon = weapons.get(getAttr('weapon'))!;
    if (this.weapon == null) throw Error("weapon not found");
    const sc = scale();
    this.speed = Math.min(1, Math.max(0.1, Number(getAttr('speed')) / 100));
    this.mag = this.weapon.mags[Number(getAttr('mag'))]?.size || 1;
    if (getAttr('mute') != 'true' && sound != null) {
      sound.volume(Number(getAttr('volume')) / 100);
      sound.rate(this.speed);
      sound.play();
    }
    for (let i = 0; i < traceShapeTypes; i++) this.traceShapes.push([]);
    this.showHint = getAttr('hint') == 'true';
    this.hintGroup.visible(this.showHint);
    // Target.
    if (!this.movingTarget) {
      target!.pos = this.startPos.clone();
      target!.offset = new Point();
      // target.onSettingsUpdated();
    }
    // const target = new Konva.Circle({
    //   radius: 2 + 4 * sc,
    //   stroke: colorStartCircle,
    //   strokeWidth: 1 + 1 * sc,
    //   position: this.center.plain(),
    // });
    // if (this.recoilTarget) {
    //   this.wallGroup.add(target);
    // } else {
    //   if (this.showHint) {
    //     this.recoilGroup.add(target);
    //   } else {
    //     this.addShape(target);
    //   }
    // }
    this.pattern = this.weapon.x.map((x, idx) => {
      return new Point(x, this.weapon.y[idx]).s(sc);
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
    if (this.finished) return false;
    this.fpsText.text(`FPS: ${Math.round(1000 * this.totalFrames / (Date.now() - this.start_t))}`);
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
      target!.offset = vRecoilCompensated.clone().s(-1);
    } else {
      if (this.showHint) {
        target!.offset = vRecoilNextFrame.clone().s(-1);
      }
    }
    // Register new shots.
    while (this.hitIndex < i) {
      this.hitIndex++;
      const p = this.pattern[this.hitIndex];
      this.hitCursors.push(cur);
      this.hitVectors.push(cur.clone().sub(target!.pos));
      let hit = cur.clone().add(p);
      const rawDistance = hit.distance(target!.pos) / sc;
      let s = distanceScore(rawDistance, target!.multiplier);
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
    this.finished = true;
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
    // if (!this.movingTarget) {
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
    // }
    this.hintGroup.offset(new Point(0, 0));
    this.wallGroup.offset(new Point(0, 0));
    this.recoilGroup.offset(new Point(0, 0));
    target!.offset = new Point();
    this.crossHair?.visible(false);
    stage.container().classList.remove('no-cursor');
    if (getAttr('toggle-modes') == 'true') setAttr('hint', `${!this.showHint}`);
    redrawStartRectangle();
    redraw();
  }
  displayTace() {
    // if (this.movingTarget) return;
    const d = Number(getAttr('trace-mode')) % traceShapeTypes;
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

export function setupGame() {
  /* https://konvajs.org/docs/sandbox/Animation_Stress_Test.html#page-title
  * setting the listening property to false will improve
  * drawing performance because the rectangles won't have to be
  * drawn onto the hit graph */
  layer.listening(false);
  layer.add(startRectangle);
  attrNamespace('game:');
  initAttr('sens', '5');
  initAttr('weapon', 'r99'); 1
  initAttr('mag', '0');
  initAttr('stats', '[]');
  initAttr('volume', '20');
  initAttr('mute', 'false');
  initAttr('hint', 'true');
  initAttr('trace-mode', '1');
  initAttr('toggle-modes', 'false');
  initAttr('speed', '100');

  loadStats();

  attrInput('sens', NS);
  attrInput('hint', NS);
  attrInput('volume', NS);
  attrInput('speed', NS);
  attrInput('toggle-modes', NS);

  soundControls();
  instructionsControls();
  weaponControls();
  statControls();
  target = new Target();
  watchAttr(['weapon', 'mag', 'sens'], () => {
    tracePreview?.clear();
    tracePreview = new TracePreview();
    redrawStartRectangle();
    target?.onSettingsUpdated();
    redraw();
  });
  watchAttr(['sens'], () => {
    target?.onSettingsUpdated();
  });
  window.addEventListener('resize', () => {
    redrawStartRectangle();
    target?.onSettingsUpdated();
  });
  aShowDetailedStats.watch(redrawStartRectangle);
  aShowInstructions.watch(redrawStartRectangle);
  watchAttr(['stats', 'mag', 'weapon', 'hint'], showStats);
  watchAttr(['speed'], (v: string) => {
    const b = document.getElementById('speed-value');
    if (!b) return;
    const s = Number(v);
    b.innerText = s == 100 ? 'normal' : `x ${s / 100}`;
  });
  watchAttr('trace-mode', () => {
    shooting?.displayTace();
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
        if (shooting == null || shooting.finished) {
          shooting?.clear();
          shooting = new Shooting();
          tracePreview?.clear();
          tracePreview = null;
          shooting.start();
        }
        break;
      case 1:
        setAttr('trace-mode', `${(Number(getAttr('trace-mode')) + 1) % traceShapeTypes}`);
        break;
      default:
        break;
    }
  });
  aMovingTarget.watch((v: boolean) => {
    target!.onSettingsUpdated();
    redraw();
  });
  aTargetSpeed.watch((v: number) => {
    const e = document.getElementById("target-speed-value");
    if (e) e.innerText = `${v}..${v*target!.skew}`;
    target!.onSettingsUpdated();
  });
  animation = new Konva.Animation((f: any) => {
    let updated = false;
    if (shooting != null) {
      updated = shooting.frame();
    }
    updated = target!.frame(f) || updated;
    return updated;
  }, [layer]);
  animation.start();
}