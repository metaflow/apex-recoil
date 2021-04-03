/**
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
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
import { attrInput, attrNamespace, cursor, getAttr, initAttr, layer, setAttr, stage, watchAttr } from "./main";
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
    points: PlainPoint[];
    comment: string;
}

interface MagInfo {
    size: number;
    audio: string;
};

interface Weapon {
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
    followMarkers: string;
    randomTrace: string;
}

interface TrialStats {
    setup: TrialSetup;
    // results: number[];
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
    return Math.max(0, (a / (a + distance/k) - t) / (1 - t));
}

function medianRecoil(rr: Recoil[]): Recoil {
    const f = rr[0];
    const n = f.points.length;
    const z: Recoil = {
        weapon: f.weapon,
        barrel: f.barrel,
        stock: f.stock,
        comment: "median",
        points: [{ x: 0, y: 0 }],
    };
    for (let i = 1; i < n; i++) {
        const dx: number[] = [];
        const dy: number[] = [];
        rr.forEach(r => {
            const p = new Point(r.points[i]).sub(new Point(r.points[i - 1]));
            dx.push(p.x);
            dy.push(p.y);
        });
        const p = z.points[i - 1];
        z.points.push({ x: sl.median(dx) + p.x, y: sl.median(dy) + p.y });
    }
    return z;
}

// Experimental: generate best fit recoil.
function bestRecoil(rr: Recoil[]): Recoil {
    const f = rr[0];
    const n = f.points.length;
    const z: Recoil = {
        weapon: f.weapon,
        barrel: f.barrel,
        stock: f.stock,
        comment: "median",
        points: [{ x: 0, y: 0 }],
    };
    const findMax = (f: (p: Point) => number) => {
        const z = new Point(0, 0);
        let t = f(z);
        let step = 100;
        while (step > 0.1) {
            for (let i = 0; i < 1000; i++) {
                let x = z.x;
                let y = z.y;
                z.x = x + (Math.random() - 0.5) * step;
                z.y = y + (Math.random() - 0.5) * step;
                let q = f(z);
                if (q > t) {
                    t = q;
                } else {
                    z.x = x;
                    z.y = y;
                }
            }
            step /= 2;
        }
        return z;
    };
    for (let i = 0; i < n; i++) {
        z.points.push(findMax((p: Point) => {
            let z = 0;
            rr.forEach(r => {
                z += distanceScore(new Point(r.points[i]).distance(p));
            });
            return z;
        }).plain());
    }
    return z;
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
        randomTrace: getAttr('random-trace'),
        followMarkers: getAttr('follow-markers'),
    };
}

function statsForSetup(c: TrialSetup): TrialStats | undefined {
    return stats.find(x => {
        return JSON.stringify(x.setup) == JSON.stringify(c);
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
    attrNamespace('game:');
    initAttr('sens', '5');
    initAttr('weapon', 'r301');
    initAttr('stock', '2');
    initAttr('barrel', '2');
    initAttr('mag', '0');
    initAttr('stats', '[]');
    initAttr('volume', '50');
    initAttr('mute', 'false');
    initAttr('hint', 'true');
    initAttr('follow-markers', 'true');
    initAttr('random-trace', 'true');

    setAttr('current', '0');
    stats = JSON.parse(getAttr('stats'));
    attrInput('sens');
    attrInput('hint');
    attrInput('volume');
    attrInput('random-trace');
    attrInput('follow-markers');
    attrInput('mute');

    let allShapes: Konva.Shape[] = [];
    let hintShapes: Konva.Shape[] = [];
    const recoils = rec.map(s => {
        var z: Recoil = {
            weapon: s.weapon,
            barrel: s.barrel,
            stock: s.stock,
            points: s.points,
            comment: s.comment,
        };
        return z;
    });

    const showAllTraces = () => {
        clear();        
        const name = getAttr('weapon');
        const stock = getAttr('stock');
        const barrel = getAttr('barrel');
        const w = weapons.get(name);
        const sens = Number(getAttr('sens'));
        if (w == null) {
            console.error('weapon', getAttr('weapon'), 'not found');
            return;
        }
        const n = w.mags[Number(getAttr('mag'))].size;
        const rr = recoils.filter(r => r.weapon == name && r.barrel == barrel && r.stock == stock);
        if (rr.length == 0) {
            console.error(`no recoils for ${name} ${stock} ${barrel}`);
            return;
        }
        const median = medianRecoil(rr);
        rr.unshift(median);
        rr.forEach((r, i) => {
            if (r.points.length < n) {
                console.error('missing points', r.comment, r.points.length);
                return;
            }
            const start = new Point((150 + 200 * i) / sens, 50);
            const linePoints: number[] = [];
            let color = new TinyColor('white').darken(50);
            if (i == 0) {
                // Median.
                color = new TinyColor('green').desaturate(50);
            }
            const line = new Konva.Line({
                points: [],
                stroke: color.toString(),
                strokeWidth: 0.5,
            });
            allShapes.push(line);
            layer.add(line);
            r.points.forEach((raw, i) => {
                if (i >= n) return;
                const p = new Point(raw).s(1/sens);
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
        });
        stage.batchDraw();
    };

    watchAttr(['weapon', 'stock', 'barrel', 'barrel', 'sens', 'random-trace'],
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
        showAllTraces();
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
        showAllTraces();
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
        showAllTraces();
    });

    // let recoil: Recoil | null = null;

    const pickRecoil = () => {
        const name = getAttr('weapon');
        const stock = getAttr('stock');
        const barrel = getAttr('barrel');
        const rr = recoils.filter(r => r.weapon == name && r.barrel == barrel && r.stock == stock);
        if (rr.length == 0) {
            console.error('no recoils for', name, stock, barrel);
            return null;
        }
        const x = Math.floor(Math.random() * rr.length);
        if (getAttr('random-trace') == 'true') {
            return rr[x];
        }
        return medianRecoil(rr);
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
                b.innerText = `today: best ${sl.percentile(s.todayResults, 1)}, median ${Math.round(sl.median(s.todayResults))}
best all time: ${s.bestAllTime}`;
            } else {
                b.innerText = 'today: best -, median -\nall time best: -';
            }
        }
    };
    watchAttr(['stats', 'mag', 'weapon', 'barrel', 'stock', 'hint', 'random-trace', 'follow-markers'],
        showStats);
    const btn = document.getElementById('show-all') as HTMLButtonElement;
    if (btn !== null) btn.addEventListener('click', showAllTraces);

    const clear = () => {
        allShapes.forEach(c => c.remove());
        allShapes = [];
    };

    const scoreGrad = tinygradient([
        'red',
        'yellow',
        'green',
    ]);

    let shooting = false;
    stage.on('mousedown', function (e: Konva.KonvaEventObject<MouseEvent>) {
        if (shooting) return;        
        const recoil = pickRecoil();
        if (recoil == null) {
            console.log('no recoil selected');
            return;
        }
        clear();
        const start = cursor();
        if (start == null) return;
        const start_screen = new Point(stage.getPointerPosition());
        let score = 0;
        const w = weapons.get(getAttr('weapon'));
        if (w == null) {
            console.log('weapon', getAttr('weapon'), 'not found');
            return;
        }
        shooting = true;
        // TODO: global error handler.
        const d = 60 * 1000 / w.rpm; // del ay b/w rounds.
        const sens = Number(getAttr('sens'));
        // const m = 1 / Number(getAttr('sens'));
        const n = w.mags[Number(getAttr('mag'))].size;
        let scores: number[] = [];
        if (getAttr('mute') != 'true') {
            var sound = new Howl({
                src: [`./audio/${w.mags[Number(getAttr('mag'))].audio}.mp3`]
            });
            sound.volume(Number(getAttr('volume')) / 100);
            sound.play();
        }
        const showHint = getAttr('hint') == 'true';
        const followMarkers = getAttr('follow-markers') == 'true';
        const hintTarget = new Konva.Circle({
            radius: 3,
            stroke: new TinyColor('red').desaturate(50).toString(),
            strokeWidth: 2,
            position: start.plain(),
            visible: followMarkers,
        });
        layer.add(hintTarget);
        allShapes.push(hintTarget);        
        {
            // Start marker.
            const s = new Konva.Circle({
                radius: 6,
                stroke: new TinyColor('green').desaturate(50).toString(),
                strokeWidth: 2,
                position: start.plain(),
            });
            layer.add(s);
            allShapes.push(s);
        }
        let hitMarker = new Konva.Circle();
        const traceLines: Konva.Line[] = [];
        const timePoints: number[] = [];
        const hintLinePoints: number[] = [];
        const hintCircles: Konva.Circle[] = [];
        recoil.points.forEach((raw, i) => {
            if (i >= n) return;
            const p = new Point(raw).s(1 / sens);
            timePoints.push(i * d);
            const xy = start.clone().sub(p);
            const c = new Konva.Circle({
                radius: followMarkers ? 10 : 1,
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
        var anim = new Konva.Animation(function (frame: any) {
            fps.push(frame.frameRate);
            // let updated = false;            
            // Register next shot.
            if (frame.time > timePoints[hitIndex + 1]) {
                hitIndex++;
                for (let i = 0; i <= hitIndex; i++) {
                    hintCircles[i].radius(1);
                }
                const p = new Point(recoil.points[hitIndex]).s(1 / sens);
                // Cursor position.
                let cur = new Point(stage.getPointerPosition()).sub(start_screen).add(start);
                // Hit relative to start.
                let hit = cur.clone().add(p);
                let traceTarget = start.clone().sub(p);
                if (showHint) {
                    hintTarget.position(traceTarget.plain());
                }
                const distance = new Point(hit).distance(start) * sens;
                let s = distanceScore(distance);
                scores.push(s);
                score += s;
                let scoreColor = (scoreGrad.rgbAt(s) as unknown) as TinyColor;
                scoreColor = scoreColor.desaturate(50);
                {
                    hitMarker.radius(2);
                    hitMarker = new Konva.Circle({
                        radius: 4,
                        fill: scoreColor.toString(),
                        position: hit,
                    });
                    allShapes.push(hitMarker);
                    layer.add(hitMarker);
                }
                {
                    const q = new Konva.Line({
                        points: [traceTarget.x, traceTarget.y, cur.x, cur.y],
                        strokeWidth: 1,
                        stroke: scoreColor.toString(),
                    })
                    traceLines.push(q);
                }
                // Finished.
                if (hitIndex + 1 >= n) {
                    shooting = false;
                    anim.stop();
                    const x = Math.round(100 * score / n);
                    addStat(x);
                    traceLines.forEach(x => {
                        layer.add(x);
                        allShapes.push(x);
                    });
                    hintShapes.forEach(s => s.visible(true));
                    hitMarker.radius(2);
                    hintTarget.visible(false);
                }
            }
            if (followMarkers) {
                for (let i = hitIndex; i < n; i++) {
                    const d = timePoints[i] - frame.time;
                    // d / 30 - will be closing over 300 ms (30 * 10).
                    hintCircles[i].radius(Math.max(1, Math.min(10, d / 40)));
                }
            }            
            // return updated;
            // target.x(100 * Math.sin((frame.time * 2 * Math.PI) / 1000) + start.x);
        }, layer);
        anim.start();
        stage.batchDraw();
    });
}