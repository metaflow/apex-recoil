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
import rec from './recoils.json';
import specs from './specs.json';
import theme from '../theme.json';
import sl from "stats-lite";
import tinygradient from "tinygradient";

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
        barrel: '0',
        stock: '0',
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
    attrInput('sens');
    const scale = () => {
        const sens = Number(getAttr('sens'));
        return 1 / sens;
    };

    // TODO: move constants to theme.
    const colorGray = new TinyColor('white').darken(50).toString();
    const colorHintTarget = new TinyColor('red').desaturate(50).toString();
    const colorStartCircle = new TinyColor('green').desaturate(50).toString();
    const colorHintPath = new TinyColor(theme.foreground).darken(50).toString();
    const scoreGradient: string[] = [];
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
    const gradientColor = (x: number) => {
        const idx = Math.min(Math.max(Math.round(x * 10), 0), 10);
        return scoreGradient[idx];
    }

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
    layer.add(fpsTxt);

    const drawPattern = (pattern: Point[], mag: number, start: Point, sc: number) => {
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
    };

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
        const r = pickRecoil();
        if (r == null) return;
        if (r.x.length < n) {
            console.error('missing points for pattern want', n, 'have', r.x.length);
            return;
        }
        const start = new Point(150 * sc, 50);
        const pattern = r.x.map((x, idx) => {
            return new Point(x, r.y[idx]).s(sc);
        });

        const [line, circles] = drawPattern(pattern, n, start, sc);
        allShapes.push(line as Konva.Line);
        layer.add(line as Konva.Line);
        (circles as Konva.Circle[]).forEach(c => {
            allShapes.push(c);
            layer.add(c);
        });
        stage.batchDraw();
    };

    watchAttr(['weapon', 'mag', 'sens'],
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

    const pickRecoil = () => {
        const name = getAttr('weapon');
        const stock = '0';
        const barrel = '0';
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
    watchAttr(['stats', 'mag', 'weapon', 'hint', 'pacer'], showStats);

    const clear = () => {
        allShapes.forEach(c => c.remove());
        allShapes = [];
        traceShapes = [];
    };

    let shooting = false;

    // let traceMode = 0;
    const traceShapeTypes = 3;
    const displayTace = () => {
        const d = Number(getAttr('trace-mode')) % traceShapeTypes;
        traceShapes.forEach((sh, i) => sh.forEach(s => s.visible(i == d)));
    };
    watchAttr('trace-mode', () => {
        displayTace();
        stage.batchDraw();
    });

    const fire = () => {
        const start_t = Date.now();
        if (shooting) return;   
        const recoil = pickRecoil(); // TODO: pick recoil in advance.
        if (recoil == null) {
            console.log('no recoil selected');
            return;
        }
        suspendAttrUpdates();
        shooting = true;        
        clear();
        const start = cursor();
        let score = 0;
        const w = weapons.get(getAttr('weapon'));
        if (w == null) {
            console.log('weapon', getAttr('weapon'), 'not found');
            return;
        }
        const sc = scale();
        const n = w.mags[Number(getAttr('mag'))]?.size || 1;
        if (getAttr('mute') != 'true') {
            sound?.volume(Number(getAttr('volume')) / 100);
            sound?.play();
        }
        for (let i = 0; i < traceShapeTypes; i++) traceShapes.push([]);
        const showHint = getAttr('hint') == 'true';
        const showPacer = (getAttr('pacer') == 'true') && showHint;
        if (showHint) {
            stage.container().classList.remove('no-cursor');
        } else {
            stage.container().classList.add('no-cursor');
        }
        const hintTarget = new Konva.Circle({
            radius: 4,
            stroke: colorHintTarget,
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
                stroke: colorStartCircle,
                strokeWidth: 1 + 1 * sc,
                position: start.plain(),
            });
            layer.add(s);
            allShapes.push(s);
        }
        let hitMarker = new Konva.Circle();
        const hitMarkers: Konva.Shape[] = [];
        
        const pattern = recoil.x.map((x, idx) => {
            return new Point(x, recoil.y[idx]).s(sc);
        });

        {
            const [ln, circles] = drawPattern(pattern, n, start, sc);
            const line = ln as Konva.Line;
            line.visible(showHint);
            allShapes.push(line);
            hintShapes.push(line);            
            layer.add(line);
            (circles as Konva.Circle[]).forEach(c => {                
                c.visible(showHint);
                allShapes.push(c);
                hintShapes.push(c);
                layer.add(c);
            });
        }
        const timePoints: number[] = Array.from(Array(n).keys()).map(i => i * (60 * 1000 / w.rpm));        
        let totalFrames = 0;
        let hitIndex = -1; // Position in the patter we already passed.
        let hitScores: number[] = [];
        let hitCursors: Point[] = [];
        const frame = (frame?: any) => {
            totalFrames++;
            let updated = false;
            let cur = cursor();
            // Register next shot.
            const frame_t = Date.now() - start_t + 8; // Add half frame.
            if (frame_t > timePoints[hitIndex + 1]) {
                hitIndex++;
                updated = true;
                const p = pattern[hitIndex];
                // Cursor position.                
                hitCursors.push(cur);
                // With recoil applied.
                let hit = cur.clone().add(p);
                const rawDistance = new Point(hit).distance(start) / sc;
                let s = distanceScore(rawDistance);
                hitScores.push(s);
                score += s;
                const scoreColor = gradientColor(s);
                {
                    // Hit markers.
                    hitMarker?.radius(2);
                    hitMarker = new Konva.Circle({
                        radius: Math.max(5 * sc, 2),
                        fill: scoreColor,
                        position: hit,
                    });
                    hitMarkers.push(hitMarker);
                    allShapes.push(hitMarker);
                    traceShapes[0].push(hitMarker);
                    layer.add(hitMarker);
                }
                // Finished.
                if (hitIndex + 1 >= n) {
                    shooting = false;
                    stage.listening(true);
                    resumeAttrUpdates();
                    animation.stop();
                    // console.log('fps 0.001', sl.percentile(fps, 0.001), '0.01', sl.percentile(fps, 0.01), '0.5', sl.percentile(fps, 0.5));
                    fpsTxt.text(`FPS ${Math.round(1000 * totalFrames / (Date.now() - start_t))}`);
                    const x = Math.round(100 * score / n);
                    addStat(x);
                    hintShapes.forEach(s => s.visible(true));
                    hitMarker.radius(2);
                    hintTarget.visible(false);
                    const txt = new Konva.Text({
                        text: `${x}`,
                        fontSize: 20,
                        fill: gradientColor(score / n),
                        shadowColor: theme.background,
                        shadowBlur: 0,
                        shadowOffset: { x: 1, y: 1 },
                        shadowOpacity: 1,
                    });
                    txt.position(start.clone().add(new Point(20, -10)).plain());
                    allShapes.push(txt);
                    layer.add(txt);

                    {
                        // Display trail.
                        hitCursors.forEach((cur, idx) => {
                            const p = pattern[idx];
                            let traceTarget = start.clone().sub(p);
                            const clr = gradientColor(hitScores[idx]);
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
                    if (getAttr('toggle-modes') == 'true') setAttr('hint', `${!showHint}`);
                }
            }
            if (showPacer) {
                let i = hitIndex;
                const t = frame_t + 24; // + 1.5 frames.
                while (i + 1 < n && t > timePoints[i + 1]) i++;
                if (i > -1 && i + 1 < n) {
                    updated = true;
                    const dt = timePoints[i + 1] - timePoints[i];
                    let progress = 1;
                    if (dt > 0.001) progress = Math.max(Math.min((t - timePoints[i]) / dt, 1), 0);
                    const v = pattern[i + 1].clone().sub(pattern[i]);
                    let traceTarget = start.clone().sub(v.s(progress).add(pattern[i]));
                    hintTarget.position(traceTarget.plain());
                }                
            }
            return updated;
        };
        var animation = new Konva.Animation(frame, layer);
        stage.listening(false);
        animation.start();
        frame();
    };
    stage.on('mousedown', function (e: Konva.KonvaEventObject<MouseEvent>) {
        // TODO: disabled: updateSound();
        e.evt.preventDefault();
        switch (e.evt.button) {
            case 0:
                fire();
                break;
            case 1:
                setAttr('trace-mode', `${(Number(getAttr('trace-mode')) + 1) % traceShapeTypes}`);
                break;
            default:
                break;
        }
    });
}