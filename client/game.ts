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
import { PlainPoint, Point } from "./point";
import rec from './recoils.json';
import specs from './specs.json';
import theme from '../theme.json';
import sl from "stats-lite";
import tinygradient from "tinygradient";
import e from "express";

interface Recoil {
    weapon: string;
    barrel: string;
    stock: string;
    x: number[];
    y: number[];
}

export interface MagInfo {
    size: number;
    audio: string;
};

export interface Weapon {
    name: string;
    rpm: number;
    mags: MagInfo[];
}

interface TrialSetup {
    weapon: string;
    mag: string;
    barrel: string;
    stock: string;
    hint: string;
    pacer: string;
}

interface TrialStats {
    setup: TrialSetup;
    bestByDay: number[];
    medianByDay: number[];
    days: number[];
    bestAllTime: number;
    last: number;
    today: number;
    todayResults: number[];
};

function distanceScore(distance: number) {
    const k = 20;
    const a = 1;
    const t = a / (a + 200 / k);
    return Math.max(0, (a / (a + distance / k) - t) / (1 - t));
}

let stats: TrialStats[] = [];

function today(): number {
    var d = new Date();
    return (d.getFullYear() * 100 + d.getMonth()) * 100 + d.getDay();
}

function trialSetup(): TrialSetup {
    return {
        weapon: getAttr('weapon'),
        mag: getAttr('mag'),
        barrel: getAttr('barrel'),
        stock: getAttr('stock'),
        hint: getAttr('hint'),
        pacer: `${(getAttr('pacer') == 'true') && (getAttr('hint') == 'true')}`,
    };
}

function statsForSetup(c: TrialSetup): TrialStats | undefined {
    return stats.find(x => {
        return x.setup.weapon == c.weapon &&
        x.setup.mag == c.mag &&
        x.setup.barrel == c.barrel &&
        x.setup.stock == c.stock &&
        x.setup.hint == c.hint &&
        x.setup.pacer == c.pacer;
    });
}

function addStat(v: number): TrialStats {
    let s = statsForSetup(trialSetup());
    const t = today();
    if (s === undefined) {
        s = {
            setup: trialSetup(),
            bestAllTime: 0,
            days: [],
            bestByDay: [],
            medianByDay: [],
            last: 0,
            today: t,
            todayResults: [],
        };
        stats.push(s);
    }
    if (s.today != t) {
        if (s.todayResults.length > 0) {
            s.days.push(s.today);
            s.bestByDay.push(sl.percentile(s.todayResults, 1));
            s.medianByDay.push(sl.median(s.todayResults));
        }
        s.today = t;
        s.todayResults = [];
    }
    s.todayResults.push(v);
    s.last = v;
    s.bestAllTime = Math.max(s.bestAllTime, v);
    setAttr('stats', JSON.stringify(stats));
    return s;
}

export function setupGame() {
    /* https://konvajs.org/docs/sandbox/Animation_Stress_Test.html#page-title
    * setting the listening property to false will improve
    * drawing performance because the rectangles won't have to be
    * drawn onto the hit graph */
    layer.listening(false);
    attrNamespace('game:');
    initAttr('sens', '5');
    initAttr('fovScale', '1');
    initAttr('weapon', 'r99');
    initAttr('stock', '0');
    initAttr('barrel', '0');
    initAttr('mag', '0');
    initAttr('stats', '[]');
    initAttr('volume', '20');
    initAttr('mute', 'false');
    initAttr('hint', 'true');
    initAttr('pacer', 'true');
    initAttr('show-instructions', 'true');
    initAttr('trace-mode', '0');
    initAttr('toggle-modes', 'false');

    watchAttr('show-instructions', (v: string) => {
        const e = document.getElementById('instructions');
        if (!e) return
        e.style.display = (v == 'true') ? 'block' : 'none';
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

    stats = JSON.parse(getAttr('stats'));
    attrInput('sens');
    attrInput('fovScale');
    attrInput('hint');
    attrInput('pacer');
    attrInput('volume');
    attrInput('mute');
    attrInput('toggle-modes');
    let allShapes: Konva.Shape[] = [];
    let hintShapes: Konva.Shape[] = [];
    let traceShapes: Konva.Shape[][] = [];
    const recoils = rec.map(s => {
        var z: Recoil = {
            weapon: s.weapon,
            barrel: s.barrel,
            stock: s.stock,
            x: s.x,
            y: s.y,
        };
        return z;
    });
    let sound: Howl | null = null;
    let soundPath = '';
    const updateSound = () => {
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
    watchAttr(['weapon', 'mag', 'mute'], updateSound);

    const scale = () => {
        // const scope = Number(getAttr('scope'));
        const scope = 1;
        const fov = 1;
        const sens = Number(getAttr('sens'));
        // TODO: scope scalar.
        const r70 = 70 / 360 * Math.PI;
        // The formula is rather complicated as simple formula of (scope / sens) does not work.
        // Scope is adjusted to how scope behaves for 70 degrees fov.
        return Math.tan(fov * r70) / Math.tan(fov * Math.atan(scope * Math.tan(r70))) / sens;
    };
    attrInput('sens');

    attrInput('fovScale');
    // TODO: remove fovScale.

    const showAllTraces = () => {
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
        const color = new TinyColor('white').darken(50);
        const r = pickRecoil();
        if (r == null) return;
        if (r.x.length < n) {
            console.error('missing points for pattern want', n, 'have', r.x.length);
            return;
        }
        const start = new Point(150 * sc, 50);
        const linePoints: number[] = [];
        const line = new Konva.Line({
            points: [],
            stroke: color.toString(),
            strokeWidth: 1,
        });
        allShapes.push(line);
        layer.add(line);
        r.x.forEach((x, i) => {
            if (i >= n) return;
            const p = new Point(x, r.y[i]).s(sc);
            const xy = start.clone().sub(p);
            linePoints.push(xy.x, xy.y);
            const h = new Konva.Circle({
                radius: 2,
                fill: color.toString(),
                position: xy,
            });
            allShapes.push(h);
            layer.add(h);
        });
        line.points(linePoints);
        stage.batchDraw();
    };


    // TODO: remove scopeScalar... 
    watchAttr(['weapon', 'stock', 'barrel', 'barrel', 'mag',
        'sens', 'scopeScalar0', 'scopeScalar1', 'scopeScalar2', 'scopeScalar3', 'scope', 'fovScale'],
        showAllTraces);

    const weapons = new Map<string, Weapon>();
    specs.forEach(s => {
        weapons.set(s.name, {
            name: s.name,
            rpm: s.rpm,
            mags: s.mags.map(m => {
                var z: MagInfo = { size: m.size, audio: m.audio };
                return z;
            })
        });

        const d = document.querySelector(`#weapon-select .${s.name}`) as HTMLDivElement;
        if (d != null) {
            d.addEventListener('click', () => {
                setAttr('weapon', s.name);
            })
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

    for (let i = 0; i <= 3; i++) {
        const d = document.querySelector(`#attachment-select .attachment-${i}`) as HTMLDivElement;
        if (d != null) {
            d.addEventListener('click', () => {
                // Stock before barrel as we watch barrel to show selection.
                setAttr('stock', i + '');
                setAttr('barrel', i + '');
            });
        } else {
            console.error(`#attachment-select .attachment-${i}`, 'not found');
        }
    }

    watchAttr('barrel', (v: string) => {
        const s = document.querySelector(`#attachment-select .selected`) as HTMLDivElement;
        if (s != null) s.classList.remove('selected');
        const d = document.querySelector(`#attachment-select .attachment-${v}`) as HTMLDivElement;
        if (d == null) return;
        d.classList.add('selected');
    });

    const pickRecoil = () => {
        const name = getAttr('weapon');
        const stock = getAttr('stock');
        const barrel = getAttr('barrel');
        const rr = recoils.filter(r => r.weapon == name && r.barrel == barrel && r.stock == stock);
        if (rr.length == 0) {
            console.error('no recoils for', name, stock, barrel);
            return null;
        }
        if (rr.length > 1) {
            console.warn('more then 1 recoils for', name, stock, barrel);
        }
        return rr[0];        
    };

    const showStats = () => {
        const s = statsForSetup(trialSetup());
        const p = document.getElementById('current-score');
        if (p) {
            if (s) {
                p.innerText = `${s.last}`;
            } else {
                p.innerText = '-';
            }
        }
        const b = document.getElementById('score-stats');
        if (b) {
            if (s) {
                b.innerText = `Today's median ${Math.round(sl.median(s.todayResults))}, best ${sl.percentile(s.todayResults, 1)}
All time best ${s.bestAllTime}`;
            } else {
                b.innerText = "Today's median -, best -\nAll time best -";
            }
        }
    };
    watchAttr(['stats', 'mag', 'weapon', 'barrel', 'stock', 'hint', 'pacer'],
        showStats);

    const clear = () => {
        allShapes.forEach(c => c.remove());
        allShapes = [];
        traceShapes = [];
    };

    const scoreGrad = tinygradient([
        'red',
        'yellow',
        'green',
    ]);

    let shooting = false;

    // let traceMode = 0;
    const displayTace = () => {
        if (traceShapes.length == 0) return;
        const d = Number(getAttr('trace-mode')) % traceShapes.length;
        traceShapes.forEach((sh, i) => sh.forEach(s => s.visible(i == d)));
    };
    watchAttr('trace-mode', () => {
        displayTace();
        stage.batchDraw();
    });
    const fire = () => {
        if (shooting) return;
        const recoil = pickRecoil();
        if (recoil == null) {
            console.log('no recoil selected');
            return;
        }
        clear();
        traceShapes.push([]);
        traceShapes.push([]);
        traceShapes.push([]);
        const start = cursor();
        if (start == null) return;
        const start_screen = new Point(stage.getPointerPosition());
        let score = 0;
        const w = weapons.get(getAttr('weapon'));
        if (w == null) {
            console.log('weapon', getAttr('weapon'), 'not found');
            return;
        }
        suspendAttrUpdates();
        shooting = true;
        // TODO: global error handler.
        const d = 60 * 1000 / w.rpm; // del ay b/w rounds.
        const sc = scale();
        const n = w.mags[Number(getAttr('mag'))]?.size || 1;
        let scores: number[] = [];
        if (getAttr('mute') != 'true') {
            sound?.volume(Number(getAttr('volume')) / 100);
            sound?.play();
        }
        const showHint = getAttr('hint') == 'true';
        const showPacer = (getAttr('pacer') == 'true') && showHint;
        if (showHint) {
            stage.container().classList.remove('no-cursor');
        } else {
            stage.container().classList.add('no-cursor');
        }
        const hintTarget = new Konva.Circle({
            radius: 3,
            stroke: new TinyColor('red').desaturate(50).toString(),
            strokeWidth: 2,
            position: start.plain(),
            visible: showPacer,
        });
        layer.add(hintTarget);
        allShapes.push(hintTarget);
        {
            // Start marker.
            const s = new Konva.Circle({
                radius: 2 + 4 * sc,
                stroke: new TinyColor('green').desaturate(50).toString(),
                strokeWidth: 1 + 1 * sc,
                position: start.plain(),
            });
            layer.add(s);
            allShapes.push(s);
        }
        let hitMarker = new Konva.Circle();
        // const traceHits: Konva.Shape[] = [];
        const hitMarkers: Konva.Shape[] = [];
        const hits: Point[] = [];
        const timePoints: number[] = [];
        const hintLinePoints: number[] = [];
        const hintCircles: Konva.Circle[] = [];
        recoil.x.forEach((x, i) => {
            if (i >= n) return;
            const p = new Point(x, recoil.y[i]).s(sc);
            timePoints.push(i * d);
            const xy = start.clone().sub(p);
            const c = new Konva.Circle({
                radius: showPacer ? 10 : 1,
                stroke: new TinyColor(theme.foreground).shade(50).toString(),
                strokeWidth: 1,
                position: xy,
                visible: showHint,
            });
            hintLinePoints.push(xy.x, xy.y);
            hintShapes.push(c);
            hintCircles.push(c);
            allShapes.push(c);
            layer.add(c);
        });
        const hintLine = new Konva.Line({
            points: hintLinePoints,
            stroke: new TinyColor(theme.foreground).darken(50).toString(),
            strokeWidth: 0.5,
            visible: showHint,
        });
        allShapes.push(hintLine);
        hintShapes.push(hintLine);
        layer.add(hintLine);
        let hitIndex = -1;
        const fps: number[] = [];
        var animation = new Konva.Animation(function (frame: any) {
            fps.push(frame.frameRate);
            let updated = false;            
            // Register next shot.
            if (frame.time > timePoints[hitIndex + 1]) {
                hitIndex++;
                updated = true;
                for (let i = 0; i <= hitIndex; i++) hintCircles[i]?.radius(1);
                const p = new Point(recoil.x[hitIndex], recoil.y[hitIndex]).s(sc);
                // Cursor position.
                let cur = new Point(stage.getPointerPosition()).sub(start_screen).add(start);
                // Hit relative to start.
                let hit = cur.clone().add(p);
                let traceTarget = start.clone().sub(p);                
                hintTarget.position(traceTarget.plain());
                const distance = new Point(hit).distance(start) / sc;
                let s = distanceScore(distance);
                scores.push(s);
                score += s;
                let scoreColor = (scoreGrad.rgbAt(s) as unknown) as TinyColor;
                scoreColor = scoreColor.desaturate(50);
                {
                    // Hit markers.
                    hitMarker?.radius(2);
                    hitMarker = new Konva.Circle({
                        radius: 4,
                        fill: scoreColor.toString(),
                        position: hit,
                    });
                    hitMarkers.push(hitMarker);                    
                    allShapes.push(hitMarker);
                    traceShapes[0].push(hitMarker);
                    layer.add(hitMarker);

                    const b = new Konva.Circle({
                        radius: 2,
                        fill: scoreColor.toString(),
                        position: cur.plain(),
                        visible: false,
                    });
                    layer.add(b);
                    allShapes.push(b);
                    traceShapes[1].push(b);

                    const c = new Konva.Line({
                        points: [cur.x, cur.y, traceTarget.x, traceTarget.y],
                        stroke: scoreColor.toString(),
                        strokeWidth: 1,
                        visible: false,
                    });
                    allShapes.push(c);
                    traceShapes[2].push(c);
                    layer.add(c);
                }
                hits.push(cur);
                // Finished.
                if (hitIndex + 1 >= n) {
                    shooting = false;
                    resumeAttrUpdates();
                    animation.stop();
                    const x = Math.round(100 * score / n);
                    addStat(x);
                    hintShapes.forEach(s => s.visible(true));
                    hitMarker.radius(2);
                    hintTarget.visible(false);
                    const txt = new Konva.Text({
                        text: `${x}`,
                        fontSize: 20,
                        fill: scoreGrad.rgbAt(score / n).toString(),
                        shadowColor: theme.background,
                        shadowBlur: 0,
                        shadowOffset: { x: 1, y: 1 },
                        shadowOpacity: 1,
                    });
                    txt.position(start.add(new Point(20, -10)).plain());
                    allShapes.push(txt);
                    layer.add(txt);
                    displayTace();
                    stage.container().classList.remove('no-cursor');
                    if (getAttr('toggle-modes') == 'true') setAttr('hint', `${!showHint}`);
                }
            }
            if (showPacer) {
                updated = true;
                for (let i = hitIndex + 1; i < n; i++) {
                    const d = timePoints[i] - frame.time;
                    // d / 30 - will be closing over ~300 ms (30 * 10).
                    hintCircles[i].radius(Math.max(1, Math.min(10, d / 30) * sc));
                }               
            }
            return updated;
        }, layer);
        animation.start();
        stage.batchDraw();
    };
    stage.on('mousedown', function (e: Konva.KonvaEventObject<MouseEvent>) {
        updateSound();
        e.evt.preventDefault();
        switch (e.evt.button) {
            case 0:
                fire();
                break;
            case 1:
                setAttr('trace-mode', `${Number(getAttr('trace-mode')) + 1}`);
                break;
            default:
                break;
        }
    });
}