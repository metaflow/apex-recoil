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

interface SetupStats {
    weapon: string;
    mag: string;
    barrel: string;
    stock: string;
    trace: boolean;
    hint: boolean;
    results: number[];
};

function addStat(c: SetupStats, stats: SetupStats[]): SetupStats {
    let s = stats.find(x => {
        return x.weapon == c.weapon &&
            x.barrel == c.barrel &&
            x.mag == c.mag &&
            x.stock == c.stock &&
            x.trace == c.trace &&
            x.hint == c.hint;
    });
    console.log(c, s);
    if (s === undefined) {
        stats.push(c);
        return c;
    }
    c.results.forEach(r => s!.results.push(r));
    return s;
}

export function setupGame() {
    console.log('setup game');
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
    initAttr('trace', 'true');
    
    setAttr('current', '0');
    let stats: SetupStats[] = JSON.parse(getAttr('stats'));
    attrInput('weapon');
    attrInput('barrel');
    attrInput('stock');
    attrInput('mag');
    attrInput('sens');
    attrInput('trace');
    attrInput('hint');
    attrInput('volume');
    attrInput('mute');

    let current: Konva.Shape[] = [];

    watchAttr('current', (v: string) => {
        const p = document.getElementById('current-score');
        if (p) p.innerText = v;
    });

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
        const w = weapons.get(getAttr('weapon'));
        if (w == null) {
            console.log('weapon', getAttr('weapon'), 'not found');
            return;
        }
        const n = w.mags[Number(getAttr('mag'))].size;
        const rr = recoils.filter(r => r.weapon == name && r.barrel == barrel && r.stock == stock);
        rr.forEach((r, i) => {
            if (r.points.length < n) {
                console.log('missing points', r.comment, r.points.length);
                return;
            }
            const start = new Point((150 + 200 * i) / Number(getAttr('sens')), 50);
            const linePoints: number[] = [];
            const line = new Konva.Line({
                points: [],
                stroke: new TinyColor('white').darken(50).toString(),
                strokeWidth: 0.5,
            });
            current.push(line);
            layer.add(line);
            r.points.forEach((raw, i) => {
                if (i >= n) return;
                const p = new Point(raw);
                p.s(1 / Number(getAttr('sens')));
                const xy = start.clone().sub(p);
                linePoints.push(xy.x, xy.y);
                const h = new Konva.Circle({
                    radius: 2,
                    fill: new TinyColor('white').shade(50).toString(),
                    position: xy,
                });
                current.push(h);
                layer.add(h);
            });
            line.points(linePoints);
        });
        stage.batchDraw();
    };

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
                // console.log(s.name);
                setAttr('weapon', s.name);
            })
        } else {
            console.error(`#weapon-select .${s.name}`, 'not found');
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

    let recoil: Recoil | null = null;

    const pickNextRun = () => {
        recoil = null;
        const name = getAttr('weapon');
        const stock = getAttr('stock');
        const barrel = getAttr('barrel');
        const rr = recoils.filter(r => r.weapon == name && r.barrel == barrel && r.stock == stock);
        // console.log(rr);
        if (rr.length == 0) {
            console.log('no recoils for', name, stock, barrel);
            return;
        }
        const x = Math.floor(Math.random() * rr.length);
        recoil = rr[x];
    };
    watchAttr('weapon', pickNextRun);
    watchAttr('stock', pickNextRun);
    watchAttr('barrel', pickNextRun);    

    const btn = document.getElementById('show-all') as HTMLButtonElement;    
    if (btn !== null) btn.addEventListener('click', showAllTraces);

    const clear = () => {
        current.forEach(c => c.remove());
        current = [];
    };

    const scoreGrad = tinygradient([
        'red',
        'yellow',
        'green',
    ]);

    stage.on('mousedown', function (e: Konva.KonvaEventObject<MouseEvent>) {
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
        // TODO: global error handler.
        const d = 60 * 1000 / w.rpm; // del ay b/w rounds.
        const sens = Number(getAttr('sens'));
        const m = 1 / Number(getAttr('sens'));
        const n = w.mags[Number(getAttr('mag'))].size;
        let scores: number[] = [];
        if (getAttr('mute') != 'true') {
            var sound = new Howl({
                src: [`./audio/${w.mags[Number(getAttr('mag'))].audio}.mp3`]
            });
            sound.volume(Number(getAttr('volume')) / 100);
            sound.play();
        }        
        const trace = getAttr('trace') == 'true';
        const showHint = getAttr('hint') == 'true';
        const hintLinePoints: number[] = [];
        const hintLine = new Konva.Line({
            points: [],
            stroke: new TinyColor(theme.foreground).darken(50).toString(),
            strokeWidth: 0.5,
        });
        if (showHint) {
            current.push(hintLine);
            layer.add(hintLine);
        }
        const target = new Konva.Circle({
            radius: 6,
            stroke: new TinyColor('red').desaturate(50).toString(),
            strokeWidth: 2,
            position: start.plain(),
        });
        layer.add(target);
        current.push(target);
        let hitMarker = new Konva.Circle();
        const traceLines: Konva.Line[] = [];
        recoil.points.forEach((raw, i) => {
            if (i >= n) return;
            const p = new Point(raw);
            p.s(m);
            if (showHint) {
                const xy = start.clone().sub(p);
                const h = new Konva.Circle({
                    radius: 1,
                    fill: new TinyColor(theme.foreground).shade(50).toString(),
                    position: xy,
                });
                hintLinePoints.push(xy.x, xy.y);
                current.push(h);
                layer.add(h);
            }
            window.setTimeout(() => {
                // Position of pointer in "virtual" coordinates.
                let hit = new Point(stage.getPointerPosition()).sub(start_screen).add(start);
                let perfectPoint = start.clone().sub(p);
                if (!trace) {
                    hit.add(p);
                    perfectPoint = start.clone();
                }
                target.position(perfectPoint.plain());
                let s = 0;
                {
                    const distance = new Point(hit).distance(perfectPoint) / sens;
                    if (distance < 5) {
                        s = 4 - 2 * distance / 5;
                    } else if (distance < 10) {
                        s = 2 - (distance - 5) / (10 - 5);
                    } else if (distance < 50) {
                        s = 1 - (distance - 10) / (50 - 10);
                    }
                    scores.push(s);
                    score += s;
                }
                let scoreColor = (scoreGrad.rgbAt(s / 4) as unknown) as TinyColor;
                scoreColor = scoreColor.desaturate(50);
                {
                    hitMarker.radius(2);
                    hitMarker = new Konva.Circle({
                        radius: trace ? 2 : 4,
                        fill: scoreColor.toString(),
                        position: hit,
                    });
                    current.push(hitMarker);
                    layer.add(hitMarker);
                }
                if (trace) {
                    const q = new Konva.Line({
                        points: [perfectPoint.x, perfectPoint.y, hit.x, hit.y],
                        strokeWidth: 1,
                        stroke: scoreColor.toString(),
                    })
                    traceLines.push(q);                    
                }
                stage.batchDraw();
                if (i == n - 1) {
                    const x = Math.round(100 * score / 4 / n);
                    const st = addStat({
                        weapon: getAttr('weapon'),
                        mag: getAttr('mag'),
                        barrel: getAttr('barrel'),
                        stock: getAttr('stock'),
                        results: [x],
                        hint: getAttr('hint') == 'true',
                        trace: getAttr('trace') == 'true',
                    }, stats);
                    setAttr('current', `score: ${x} best: ${sl.percentile(st.results, 100)} avg: ${Math.round(sl.mean(st.results))}`);
                    setAttr('stats', JSON.stringify(stats))
                    pickNextRun();
                    traceLines.forEach(x => {
                        layer.add(x);
                        current.push(x);
                    });   
                    hitMarker.radius(2);
                }
            }, i * d);
        });
        hintLine.points(hintLinePoints);
        stage.batchDraw();
    });
}