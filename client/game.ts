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

import { TinyColor } from "@ctrl/tinycolor";
import { Howl } from "howler";
import Konva from "konva";
import { attrInput, attrNamespace, cursor, getAttr, initAttr, layer, resumeAttrUpdates, setAttr, stage, suspendAttrUpdates, watchAttr } from "./main";
import { Point } from "./point";
// import rec from './recoils.json';
import specs from './specs.json';
import theme from '../theme.json';
import sl from "stats-lite";
import tinygradient from "tinygradient";

const statsDataVersion = 1;
let allShapes: Konva.Shape[] = [];
let hintShapes: Konva.Shape[] = [];
let traceShapes: Konva.Shape[][] = [];
let sound: Howl | null = null;
let stats: TrialStats[] = [];
let soundPath = '';
const weapons = new Map<string, Weapon>();
const colorGray = new TinyColor('white').darken(50).toString();
const colorHintTarget = new TinyColor('red').desaturate(50).toString();
const colorStartCircle = new TinyColor('green').desaturate(50).toString();
const colorHintPath = new TinyColor(theme.foreground).darken(50).toString();
const scoreGradient: string[] = [];
let shooting: Shooting | null = null;
const traceShapeTypes = 3;
const fpsTxt = new Konva.Text({
    text: `FPS -`,
    fontSize: 14,
    fill: theme.foreground,
    shadowBlur: 0,
    shadowOffset: { x: 1, y: 1 },
    shadowOpacity: 1,
    x: 10,
    y: 10,
});

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

interface TrialSetup {
    weapon: string;
    mag: string;
    hint: string;
    pacer: string;
}

// [day, count, median, best].
type DayResults = [number, number, number, number];

interface TrialStats {
    v: number;
    setup: TrialSetup;
    dayResults: DayResults[];
    bestAllTime: number;
    today: number;
    todayResults: number[];
};

function readStats() {
    JSON.parse(getAttr('stats')).forEach((t: any) => {
        const s = t['setup'];
        if (s === undefined) return;
        const version = t['v'];
        if (version == null) {
            // Initial unversioned storage.
            if (s['barrel'] != null && s['barrel'] != '0') return;
            if (s['stock'] != null && s['stock'] != '0') return;
            const setup: TrialSetup = {
                weapon: s['weapon'] || '',
                mag: s['mag'] || '0',
                hint: s['hint'] || 'true',
                pacer: s['pacer'] || 'true',
            };
            const st: TrialStats = {
                v: statsDataVersion,
                setup,
                today: 20210423,
                dayResults: t['days'].map((d: number, i: number) => {
                    const z: DayResults = [
                        (Math.floor(d / 100) + 1) * 100 + d % 100 + 1,
                        0,
                        t['medianByDay'][i],
                        t['bestByDay'][i],
                    ];
                    return z;
                }),
                todayResults: t['todayResults'] || [],
                bestAllTime: t.bestAllTime,
            }
            stats.push(st);
        } else {
            stats.push(t);
        }
    });
    stats.forEach(s => touchStat(s));
}

function touchStat(s: TrialStats) {
    const t = today();
    if (s.today == t) return;
    if (s.todayResults.length > 0) {
        const r: DayResults = [
            s.today,
            s.todayResults.length,
            sl.median(s.todayResults),
            sl.percentile(s.todayResults, 1)
        ];
        s.dayResults.push(r);
    }
    s.todayResults = [];
    s.today = t;
}

function distanceScore(x: number) {
    // Reasoning:
    // 1. Small errors should not decrease the score a lot.
    // 2. Big errors should decrease the score almost to 0. In game it's
    //    a binary value that suddenly drops drops "hit" to "no hit" but
    //    that would not be useful for training.
    // Graph: https://www.desmos.com/calculator/j7vjbzvuly.
    return Math.exp(-.0004 * Math.pow(x, 2));
}

// Returns current date as a number. E.g. 2015-04-28 => 20150428.
function today(): number {
    var d = new Date();
    return (d.getFullYear() * 100 + d.getMonth() + 1) * 100 + d.getDate();
}

function trialSetup(): TrialSetup {
    return {
        weapon: getAttr('weapon'),
        mag: getAttr('mag'),
        hint: getAttr('hint'),
        pacer: `${(getAttr('pacer') == 'true') && (getAttr('hint') == 'true')}`,
    };
}

function statsForSetup(c: TrialSetup): TrialStats | undefined {
    return stats.find(x => {
        try {
            return x.setup.weapon == c.weapon &&
                x.setup.mag == c.mag &&
                x.setup.hint == c.hint &&
                x.setup.pacer == c.pacer;
        } catch {
            return false;
        }
    });
}

function addStat(v: number): TrialStats {
    let s = statsForSetup(trialSetup());
    const t = today();
    if (s === undefined) {
        s = {
            v: statsDataVersion,
            setup: trialSetup(),
            bestAllTime: 0,
            today: t,
            todayResults: [],
            dayResults: [],
        };
        stats.push(s);
    }
    if (s === undefined) throw new Error('no stat');
    touchStat(s);
    s.todayResults.push(v);
    s.bestAllTime = Math.max(s.bestAllTime, v);
    setAttr('stats', JSON.stringify(stats));
    return s;
}

function instructionsControls() {
    watchAttr('show-instructions', (v: string) => {
        const e = document.getElementById('instructions');
        if (!e) return;
        if (v == 'false') {
            e.classList.add('hidden');
        } else {
            e.classList.remove('hidden');
        }
    });

    {
        const e = document.getElementById('dismiss-instructions');
        e?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            setAttr('show-instructions', 'false');
            return false;
        });
    }

    {
        const e = document.getElementById('show-instructions');
        e?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            setAttr('show-instructions', 'true');
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
};

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

function showAllTraces() {
    clear();
    const name = getAttr('weapon');
    const w = weapons.get(name);
    const sc = scale();
    if (!Number.isFinite(sc) || sc < 0.1) return;
    if (w == null) {
        console.error('weapon', getAttr('weapon'), 'not found');
        return;
    }
    const n = w.mags[Number(getAttr('mag'))].size;
    const start = new Point(150 * sc, 50);
    const pattern = w.x.map((x, idx) => {
        return new Point(x, w.y[idx]).s(sc);
    });
    const [line, circles] = drawPattern(pattern, n, start, sc);
    allShapes.push(line as Konva.Line);
    layer.add(line as Konva.Line);
    (circles as Konva.Circle[]).forEach(c => {
        allShapes.push(c);
        layer.add(c);
    });
    stage.batchDraw();
}

function clear() {
    allShapes.forEach(c => c.remove());
    allShapes = [];
    traceShapes = [];
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

function showStats() {
    const s = statsForSetup(trialSetup());
    const b = document.getElementById('score-stats');
    if (b) {
        b.innerText = "Today's tries -, median -, best -\nAll time best -";
        if (s) {
            if (s.todayResults.length > 0) {
                b.innerText = `Today's tries ${s.todayResults.length}, median ${Math.round(sl.median(s.todayResults))}, best ${sl.percentile(s.todayResults, 1)}
All time best ${s.bestAllTime}`;
            } else {
                b.innerText = `Today's tries -, median -, best -\nAll time best ${s.bestAllTime}`;
            }
        }
    }
}

class Shooting {
    center: Point;
    animation?: Konva.Animation;
    totalFrames = 0;
    score = 0;
    mag = 1;
    speed = 1;
    hitMarker = new Konva.Circle();
    hitCursors: Point[] = [];
    pattern: Point[] = [];
    hitScores: number[] = [];
    showHint = true;
    start_t = 0;
    weapon: Weapon;
    hitIndex = -1; // Position in the patter we already passed.
    hitMarkers: Konva.Shape[] = [];
    showPacer = true;
    pacer: Konva.Circle;

    constructor() {
        this.center = new Point();
        this.weapon = weapons.get(getAttr('weapon'))!;
        if (this.weapon == null) throw Error("weapon not found");
        this.pacer = new Konva.Circle({
            radius: 4,
            stroke: colorHintTarget,
            strokeWidth: 2,
        });
        layer.add(this.pacer);
        allShapes.push(this.pacer);
    }

    start() {
        this.start_t = Date.now();
        this.center = cursor();
        this.pacer.position(this.center.plain());
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
        for (let i = 0; i < traceShapeTypes; i++) traceShapes.push([]);
        this.showHint = getAttr('hint') == 'true';
        this.showPacer = (getAttr('pacer') == 'true') && this.showHint;
        this.pacer.visible(this.showPacer);
        if (this.showHint) {
            stage.container().classList.remove('no-cursor');
        } else {
            stage.container().classList.add('no-cursor');
        }
        {
            // Start marker.
            const s = new Konva.Circle({
                radius: 2 + 4 * sc,
                stroke: colorStartCircle,
                strokeWidth: 1 + 1 * sc,
                position: this.center.plain(),
            });
            layer.add(s);
            allShapes.push(s);
        }

        this.pattern = this.weapon.x.map((x, idx) => {
            return new Point(x, this.weapon.y[idx]).s(sc);
        });

        {
            const [ln, circles] = drawPattern(this.pattern, this.mag, this.center, sc);
            const line = ln as Konva.Line;
            line.visible(this.showHint);
            allShapes.push(line);
            hintShapes.push(line);
            layer.add(line);
            (circles as Konva.Circle[]).forEach(c => {
                c.visible(this.showHint);
                allShapes.push(c);
                hintShapes.push(c);
                layer.add(c);
            });
        }
        this.animation = new Konva.Animation(() => {
            return this.frame();
        }, layer);
        stage.listening(false);
        this.animation.start();
        this.frame();
        stage.batchDraw();
    }

    frame() {
        this.totalFrames++;
        let updated = false;
        let cur = cursor();
        const sc = scale();
        const frame_t = (Date.now() - this.start_t) * this.speed + 8; // Add half frame.
        // Register next shot.
        if (frame_t > this.weapon.timePoints[this.hitIndex + 1]) {
            this.hitIndex++;
            updated = true;
            const p = this.pattern[this.hitIndex];
            // Cursor position.                
            this.hitCursors.push(cur);
            // With recoil applied.
            let hit = cur.clone().add(p);
            const rawDistance = new Point(hit).distance(this.center) / sc;
            let s = distanceScore(rawDistance);
            this.hitScores.push(s);
            this.score += s;
            const scoreColor = gradientColor(s);
            {
                // Hit markers.
                this.hitMarker.radius(2);
                this.hitMarker = new Konva.Circle({
                    radius: Math.max(5 * sc, 2),
                    fill: scoreColor,
                    position: hit,
                });
                this.hitMarkers.push(this.hitMarker);
                allShapes.push(this.hitMarker);
                traceShapes[0].push(this.hitMarker);
                layer.add(this.hitMarker);
            }
            if (this.hitIndex + 1 >= this.mag) this.finish();
        }
        if (this.showPacer) {
            let i = this.hitIndex;
            const t = frame_t + 24; // + 1.5 frames.
            while (i + 1 < this.mag && t > this.weapon.timePoints[i + 1]) i++;
            if (i > -1 && i + 1 < this.mag) {
                updated = true;
                const dt = (this.weapon.timePoints[i + 1] - this.weapon.timePoints[i]);
                let progress = 1;
                if (dt > 0.001) progress = Math.max(Math.min((t - this.weapon.timePoints[i]) / dt, 1), 0);
                const v = this.pattern[i + 1].clone().sub(this.pattern[i]);
                let traceTarget = this.center.clone().sub(v.s(progress).add(this.pattern[i]));
                this.pacer.position(traceTarget.plain());
            }
        }
        return updated;
    }

    finish() {
        shooting = null;
        stage.listening(true);
        resumeAttrUpdates();
        this.animation?.stop();
        // console.log('fps 0.001', sl.percentile(fps, 0.001), '0.01', sl.percentile(fps, 0.01), '0.5', sl.percentile(fps, 0.5));
        fpsTxt.text(`FPS: ${Math.round(1000 * this.totalFrames / (Date.now() - this.start_t))}`);
        this.score /= this.mag;
        this.score = Math.max(0, Math.min(1, this.score));
        const x = Math.round(100 * this.score);
        if (this.speed == 1) addStat(x);
        hintShapes.forEach(s => s.visible(true));
        this.hitMarker.radius(2);
        const txt = new Konva.Text({
            text: `${x}`,
            fontSize: 20,
            fill: gradientColor(this.score),
            shadowColor: theme.background,
            shadowBlur: 0,
            shadowOffset: { x: 1, y: 1 },
            shadowOpacity: 1,
        });
        txt.position(this.center.clone().add(new Point(20, -10)).plain());
        allShapes.push(txt);
        layer.add(txt);
        {
            // Display trail.
            this.hitCursors.forEach((cur, idx) => {
                const p = this.pattern[idx];
                let traceTarget = this.center.clone().sub(p);
                const clr = gradientColor(this.hitScores[idx]);
                const b = new Konva.Circle({
                    radius: 2,
                    fill: clr,
                    position: cur.plain(),
                    visible: false,
                });
                layer.add(b);
                allShapes.push(b);
                traceShapes[1].push(b);
                const c = new Konva.Line({
                    points: [cur.x, cur.y, traceTarget.x, traceTarget.y],
                    stroke: clr,
                    strokeWidth: 1,
                    visible: false,
                });
                allShapes.push(c);
                traceShapes[2].push(c);
                layer.add(c);
            });
            displayTace();
        }
        stage.container().classList.remove('no-cursor');
        if (getAttr('toggle-modes') == 'true') setAttr('hint', `${!this.showHint}`);
    }
}

function displayTace() {
    const d = Number(getAttr('trace-mode')) % traceShapeTypes;
    traceShapes.forEach((sh, i) => sh.forEach(s => s.visible(i == d)));
}

export function setupGame() {
    /* https://konvajs.org/docs/sandbox/Animation_Stress_Test.html#page-title
    * setting the listening property to false will improve
    * drawing performance because the rectangles won't have to be
    * drawn onto the hit graph */
    layer.listening(false);
    attrNamespace('game:');
    initAttr('sens', '5');
    initAttr('weapon', 'r99');
    initAttr('mag', '0');
    initAttr('stats', '[]');
    initAttr('volume', '20');
    initAttr('mute', 'false');
    initAttr('hint', 'true');
    initAttr('pacer', 'true');
    initAttr('show-instructions', 'true');
    initAttr('trace-mode', '1');
    initAttr('toggle-modes', 'false');
    initAttr('speed', '100');

    readStats();

    attrInput('sens');
    attrInput('hint');
    attrInput('pacer');
    attrInput('volume');
    attrInput('speed');
    attrInput('toggle-modes');

    soundControls();
    instructionsControls();
    weaponControls();

    {
        const scoreGrad = tinygradient([
            'red',
            'yellow',
            'green',
        ]);
        for (let i = 0; i <= 10; i++) {
            scoreGradient.push(((scoreGrad.rgbAt(i / 10) as unknown) as TinyColor).desaturate(50).toString());
        }
    }

    layer.add(fpsTxt);

    watchAttr(['weapon', 'mag', 'sens'], showAllTraces);
    watchAttr(['stats', 'mag', 'weapon', 'hint', 'pacer'], showStats);
    watchAttr(['speed'], (v: string) => {
        const b = document.getElementById('speed-value');
        if (!b) return;
        const s = Number(v);
        b.innerText = s == 100 ? 'normal' : `x ${s / 100}`;
    });
    watchAttr('trace-mode', () => {
        displayTace();
        stage.batchDraw();
    });
    stage.on('mousedown', function (e: Konva.KonvaEventObject<MouseEvent>) {
        e.evt.preventDefault();
        switch (e.evt.button) {
            case 0:
                if (shooting == null) {
                    clear();
                    shooting = new Shooting();
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
}