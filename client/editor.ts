/**
* Copyright 2021 Mikhail Goncharov
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
import Konva from "konva";
import { MagInfo, Weapon } from "./game";
import { attrInput, attrNamespace, attrNumericInput, cursor, getAttr, initAttr, layer, pokeAttrs, setAttr, stage, watchAttr } from "./main";
import { PlainPoint, Point } from "./point";
import specs from './specs.json';

interface Edge {
    from: string;
    to: string;
    line: Konva.Line;
};
let points = new Map<string, Konva.Circle>();
let edges: Edge[] = [];
const anchors = new Set<string>();
let img: Konva.Image | null = null;
const weapons = new Map<string, Weapon>();
let auto_points: Konva.Circle[] = [];
let edgeStartName = '';
let patternStartName = '';
let idxCounter = 0;
let imageMask = new Array<Array<number>>();
const attrConnectHover = 'connect-hover';

export function setupEditor() {
    attrNamespace('editor');
    initAttr('distance', '100');
    initAttr('weapon', 'r301');
    initAttr('stock', '0');
    initAttr('barrel', '0');
    initAttr('points', '[]');
    initAttr('edges', '[]');
    initAttr('anchors', '[]');
    initAttr('threshold', '0');
    initAttr('target-from', '10');
    initAttr('target-to', '100');
    initAttr('enable-threshold', 'true');
    initAttr('auto-targets', 'true');
    initAttr(attrConnectHover, 'true');

    setupControls();
    initImage();
    loadSpecs();

    // layer.add(line);

    watchAttr('comment', (v: string) => {
        const comment = document.getElementById('comment');
        if (comment != null) (comment as HTMLTextAreaElement).value = v;
    });
    stage.on('mousedown', function (e: Konva.KonvaEventObject<MouseEvent>) {
        addPoint(cursor().plain(), `${idxCounter}`);
    });
    watchAttr(['cpi', 'sens', 'distance', 'weapon', 'barrel', 'stock', 'comment'],
        updateSpec);

    // hotkeys('ctrl+z', undo); TODO: delete current edge start
    (document.getElementById('accept-auto') as HTMLButtonElement)?.addEventListener('click', acceptAuto);
    (document.getElementById('clear') as HTMLButtonElement)?.addEventListener('click', clear);
    const attAnchors = JSON.parse(getAttr('anchors'));
    const attPoints = JSON.parse(getAttr('points'));
    const attEdges = JSON.parse(getAttr('edges'));
    attAnchors.forEach((x: string) => anchors.add(x));
    attPoints.forEach((p: [string, number, number]) => addPoint({ x: p[1], y: p[2] }, p[0]));
    attEdges.forEach((v: [string, string]) => addEdge(v[0], v[1]));
    updateShapes();
    stage.batchDraw();
}

function acceptAuto() {
    auto_points.forEach(p => {
        addPoint(p.position(), `${idxCounter}`);
        p.remove();
    });  
    auto_points = [];
    updateShapes();
    stage.batchDraw();
}

function initImage() {
    watchAttr([
        'threshold',
        'enable-threshold',
        'auto-targets',
        'target-from',
        'target-to'],
        (v: string) => {
            // TODO: all of that is needed?
            img?.cache();
            img?.draw();
            stage.batchDraw();
        });
    watchAttr('imagedata', (s: string) => {
        if (s === '') return;
        Konva.Image.fromURL(s, function (x: Konva.Image) {
            if (img != null) {
                img.remove();
            }
            img = x;
            layer.add(img);
            const s = window.innerHeight / img.height();
            img.scaleX(s);
            img.scaleY(s);
            img.zIndex(0);
            img.cache();
            img.filters([autoFilter]);
            imageMask = new Array<Array<number>>(img.width());
            for (let i = 0; i < img.width(); i++) {
                imageMask[i] = new Array<number>(img.height());
                for (let j = 0; j < img.height(); j++) imageMask[i][j] = 0;
            }
            stage.batchDraw();
        });
    });

}

function clear() {
    points.clear();
    edges = [];
    anchors.clear();
    layer.destroyChildren();
    setAttr('imagedata', getAttr('imagedata'));
    updateShapes();
    stage.batchDraw();
};

function setupControls() {
    attrInput('weapon');
    attrInput('barrel');
    attrInput('stock');
    attrInput('comment');
    attrInput('distance');
    attrNumericInput('threshold');
    attrNumericInput('target-from');
    attrNumericInput('target-to');
    attrInput('enable-threshold');
    attrInput('auto-targets');
    attrInput(attrConnectHover);

    const fileSelector = document.getElementById('file-selector') as HTMLInputElement;
    fileSelector?.addEventListener('change', () => {
        const fileList = fileSelector.files;
        if (fileList == null) return;
        const file = fileList.item(0);
        if (!file) return;
        setAttr('comment', file.name);
        const mm = file.name.match(/(?:.* )?([0-9.]+)\.png/)
        if (mm != null) {
            console.log(mm);
            setAttr('distance', mm[1]);
        }
        const reader = new FileReader();
        reader.addEventListener('load', (event) => {
            clear();
            setAttr('imagedata', (event.target?.result as string) || '')
        });
        reader.readAsDataURL(file);
    });
}

function updateShapes() {
    points.forEach((c, i) => {
        c.stroke(anchors.has(c.name()) ? 'red' : 'white');
        c.strokeWidth(c.name() == edgeStartName ? 3 : 1);
    });
    edges = edges.filter(e => {
        const z = points.has(e.from) && points.has(e.to);
        if (!z) e.line.remove();
        return z;
    });
    edges.forEach(e => {
        const a = points.get(e.from)!;
        const b = points.get(e.to)!;
        e.line.points([a.x(), a.y(), b.x(), b.y()]);
    });
    updateSpec();
}

function addPoint(p: PlainPoint, name: string) {        
    idxCounter = Math.max(idxCounter, Number(name) + 1);
    const c = new Konva.Circle({
        radius: 8,
        stroke: `white`,
        strokeWidth: 1,
        position: p,
        draggable: true,
        name,
    });
    c.on('dragend', function () {
        edgeStartName = '';
        updateShapes();        
        stage.batchDraw();
    });
    c.on('mouseover', function(e) {
        if (getAttr(attrConnectHover) === 'false') return;
        if (edgeStartName == '') return;
        if (edges.find(e => e.from == c.name() || e.to == c.name())) return;
        addEdge(edgeStartName, c.name());
        edgeStartName = c.name();
        updateShapes();
        stage.batchDraw();
    });
    c.on('mousedown', function (e) {
        e.cancelBubble = true;
        window.setTimeout(() => {
            updateShapes();
            stage.batchDraw();
        }, 0);
        if (e.evt.button == 0) {
            if (edgeStartName == c.name()) {
                edgeStartName = '';
                return;
            }
            if (edgeStartName == '') {
                edgeStartName = c.name();
                return;
            }
            const a = points.get(edgeStartName);
            if (a == null) {
                edgeStartName = c.name();
                return;
            }
            addEdge(edgeStartName, c.name());
            edgeStartName = c.name();
            return;
        }
        if (e.evt.button == 1) {
            if (anchors.has(name)) {
                anchors.delete(name);
            } else {
                anchors.add(name);
            }
            return;
        }
        if (e.evt.button == 2) {
            points.delete(c.name());
            c.remove();
            return;
        }
    });
    points.set(name, c);
    updateShapes();
    layer.add(c);
    stage.batchDraw();
}

function addEdge(a: string, b: string) {
    if (b < a) [b, a] = [a, b];
    const e: Edge = {
        from: a,
        to: b,
        line: new Konva.Line({
            stroke: 'white',
            strokeWidth: 1,
            points: [],
        })
    };
    const ex = edges.find((t: Edge) => t.from == e.from && t.to == e.to);
    if (ex) {
        ex.line.remove();
        edges = edges.filter((t: Edge) => t.from != e.from || t.to != e.to);
    } else {
        edges.push(e);
        layer.add(e.line);
    }
}

function updateSpec(_?: string) {
    setAttr('points', JSON.stringify(Array.from(points.entries())
        .map((v: [string, Konva.Circle]) => [v[0], v[1].x(), v[1].y()])));
    setAttr('anchors', JSON.stringify(Array.from(anchors.values())));
    setAttr('edges', JSON.stringify(edges.map(e => [e.from, e.to])));
    let cpi = Number(getAttr('cpi'));
    let sens = Number(getAttr('sens'));
    let distance = Number(getAttr('distance'));
    if (isNaN(cpi) || isNaN(sens) || isNaN(distance)) {
        setText('invalid value of one of the params');
        return;
    }
    const w = weapons.get(getAttr('weapon'));
    if (w == null) {
        setText('unknown weapon');
        return;
    }

    let idx = Array.from(anchors.values());
    idx.forEach(x => {
        if (!points.has(x)) anchors.delete(x);
    });
    let x = edgeStartName;
    let pp: Point[] = [];
    const visited = new Set<string>();
    while(true) {
        const p = points.get(x);
        if (p == null) break;
        pp.push(new Point(p.position()));
        visited.add(x);
        const e = edges.find(e => {
            return (e.from == x && !visited.has(e.to)) ||
            (e.to == x && !visited.has(e.from));
        });
        if (e == null) break;
        x = (x == e.from) ? e.to : e.from;
    }
    const c = document.getElementById("count");
    if (c) {
        c.innerText = `${points.size} / ${pp.length} / ${w.mags[3].size}`;
    }
    // <distance in raw pixels> / <distance in image pixels>
    // = <A in raw pixels for 1.0 sensitivity>.
    idx = Array.from(anchors.values())
    if (idx.length != 2) {
        setText('mark exactly two anchors');
        return;
    }
    const c1 = points.get(idx[0])!;
    const c2 = points.get(idx[1])!;
    const p1 = new Point(c1.position());
    const p2 = new Point(c2.position());
    const sc = distance / p1.distance(p2);
    pp.forEach(p => p.s(sc));
    const ort = pp[0];
    pp = pp.map(p => p.clone().sub(ort));
    const spec = {
        weapon: getAttr('weapon'),
        barrel: getAttr('barrel'),
        stock: getAttr('stock'),
        comment: getAttr('comment'),
        x: pp.map(p => Math.round(p.x * 10) / 10),
        y: pp.map(p => Math.round(p.y * 10) / 10),
    };
    setText(JSON.stringify(spec));
};

function loadSpecs() {
    weapons.clear();
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
    });
}

function autoFilter(imageData: ImageData) {
    auto_points.forEach(p => p.remove());
    auto_points = [];
    const showThreshold = getAttr('enable-threshold') == 'true';
    const th = Number(getAttr('threshold'));
    const h = imageData.height;
    const w = imageData.width;

    // const g = new Array<Array<number>>(w);
    for (let i = 0; i < w; i++) {
        for (let j = 0; j < h; j++) {
            const p = (j * w + i) * 4;
            // const v = (imageData.data[p + 0] + imageData.data[p + 1] + imageData.data[p + 2]) / 3;
            const v = imageData.data[p + 0];
            if (v < th) {
                imageMask[i][j] = v;
                if (showThreshold) {
                    imageData.data[p + 0] = 255;
                    imageData.data[p + 1] = 0;
                    imageData.data[p + 2] = 0;
                }
            } else {
                imageMask[i][j] = 1000;
            }
        }
    }
    if (getAttr('auto-targets') == 'false') return;
    const targetFrom = Number(getAttr('target-from'));
    const targetTo = Number(getAttr('target-to'));
    const fill = (x: number, y: number): [number, number, number, number] => {
        if (x < 0 || x >= w || y < 0 || y >= h || imageMask[x][y] > 255) return [x, y, 1000, 0];
        let best: [number, number, number, number] = [x, y, imageMask[x][y], 1];
        imageMask[x][y] = 1000;
        let size = 1;
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const t = fill(x + i, y + j);
                size += t[3];
                if (t[2] < best[2]) best = t;
            }
        }
        best[3] = size;
        return best;
    }

    let detected = new Array<Point>();

    for (let i = 0; i < w; i++) {
        for (let j = 0; j < h; j++) {
            if (imageMask[i][j] > 255) continue;
            const b = fill(i, j);
            if (b[3] < targetFrom || b[3] > targetTo) continue;
            detected.push(new Point(b[0], b[1]));
        }
    }
    if (detected.length > 100) {
        setText(`too many points detected: ${detected.length}`);
        return;
    }
    auto_points = detected.map(p => {
        const ip = p.clone().s(img?.scaleX() || 1).plain();
        const c = new Konva.Circle({
            radius: 10,
            stroke: 'blue',
            strokeWidth: 1,
            position: ip,
        });
        c.on('mousedown', function (e) {
            e.cancelBubble = true;
            addPoint(ip, `${idxCounter}`);
            c.hide();
        });
        layer.add(c);
        return c;
    });
}

function setText(t: string) {
    const c = document.getElementById("text");
    if (c) {
        c.innerText = t;
    }
}