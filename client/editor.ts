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

import { json } from "express";
import hotkeys from "hotkeys-js";
import Konva from "konva";
import { MagInfo, Weapon } from "./game";
import { attrInput, attrNamespace, cursor, getAttr, initAttr, layer, pokeAttrs, setAttr, stage, watchAttr } from "./main";
import { PlainPoint, Point } from "./point";
import specs from './specs.json';

export function setupEditor() {
    console.log('setup editor');

    attrNamespace('editor');
    initAttr('distance', '100');
    initAttr('weapon', 'r301');
    initAttr('stock', '0');
    initAttr('barrel', '0');
    initAttr('points', '[]');
    initAttr('anchors', '[]');
    
    attrInput('weapon');
    attrInput('barrel');
    attrInput('stock');
    attrInput('comment');
    attrInput('distance');

    layer.add(new Konva.Line({
        stroke: 'white',
        strokeWidth: 1,
        points: [10, 10, 1010, 10],
    }));
    const line = new Konva.Line({
        stroke: 'white',
        strokeWidth: 1,
        points: [],        
    });
    layer.add(line);
    watchAttr('imagedata', (s: string) => {
        if (s === '') return;
        Konva.Image.fromURL(s, function (x: Konva.Image) {
            if (img != null) {
                img.remove();
            }
            img = x;
            img.setAttrs({
                x: 50,
                y: 50,
            });
            layer.add(img);
            const s = 800 / img.height();
            // console.log(img.width(), img.height());
            img.scaleX(s);
            img.scaleY(s);
            img.zIndex(0);            
            stage.batchDraw();            
        });
    });
    watchAttr('comment', (v: string) => {
        const comment = document.getElementById('comment');
        if (comment != null) (comment as HTMLTextAreaElement).value = v;
    });
    let points: Konva.Circle[] = [];
    const anchors = new Set<number>();
    let img: Konva.Image | null = null;
    const fileSelector = document.getElementById('file-selector') as HTMLInputElement;
    fileSelector?.addEventListener('change', () => {
        const fileList = fileSelector.files;
        if (fileList == null) return;
        const file = fileList.item(0);
        if (!file) return;
        setAttr('comment', file.name);
        const mm = file.name.match(/([^ ]*) (\d+) (\d+) (\S+) ([0-9.]+)\.png/)
        if (mm != null) {
            setAttr('weapon', mm[1]);
            setAttr('barrel', mm[2]);
            setAttr('stock', mm[3]);
            setAttr('distance', mm[5]);
        }
        const reader = new FileReader();
        reader.addEventListener('load', (event) => {
            clear();
            setAttr('imagedata', (event.target?.result as string) || '')
        });
        reader.readAsDataURL(file);
    });

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
    });
    const updateLine = () => {
        points.forEach((c, i) => c.stroke(anchors.has(i) ? 'red' : 'white'));
        line.points(points.flatMap((p: Konva.Circle) => [p.position().x, p.position().y]));
        updateSpec();
    };    
    const addPoint = (p: PlainPoint) => {
        const c = new Konva.Circle({
            radius: 6,
            stroke: `white`,
            strokeWidth: 1,
            position: p,
            draggable: true,
        });
        const idx = points.length;
        // c.setAttr('index', points.length);
        c.on('dragend', function () {
            updateLine();
            stage.batchDraw();
        });
        c.on('mousedown', function (e) {
            if (e.evt.button == 1) {
                if (anchors.has(idx)) {
                    anchors.delete(idx);                    
                } else {
                    anchors.add(idx);
                }
                updateLine();
                stage.batchDraw();
            }
            e.cancelBubble = true;
        });
        points.push(c);
        updateLine();
        layer.add(c);
        stage.batchDraw();
    }    
    stage.on('mousedown', function (e: Konva.KonvaEventObject<MouseEvent>) {
        addPoint(cursor().plain());
    });
    const updateSpec = (_?: string) => {    
        setAttr('points', JSON.stringify(points.map(p => p.position())));
        setAttr('anchors', JSON.stringify(Array.from(anchors.values())));
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
        const c = document.getElementById("count");
        if (c) {
            c.innerText = `${points.length} / ${w.mags[3].size}`;
        }        
        if (anchors.size != 2) {
            setText('mark exactly two anchors');
            return;
        }        
        const idx = Array.from(anchors.values());
        if (idx[0] >= points.length || idx[1] >= points.length) {
            setText(`wrong anchor indexes ${idx}`);
            return;
        }
        const p1 = new Point(points[idx[0]].position());
        const p2 = new Point(points[idx[1]].position());
        let pp = points.map((p: Konva.Circle) => {
            return new Point(p.position());
        });
        // <A in image pixels> 
        // <distance in raw pixels> / <distance in image pixels>
        // = <A in raw pixels for 1.0 sensitivity>.
        const d = distance / p1.distance(p2);        
        pp.forEach(p => p.s(d));
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
    watchAttr(['cpi', 'sens', 'distance', 'weapon', 'barrel', 'stock', 'comment'], updateSpec);
    const undo = () => {
        const c = points.pop();
        if (c == null) return
        c.remove();
        anchors.delete(points.length);
        updateLine();
        stage.batchDraw();
    };
    hotkeys('ctrl+z', undo);
    (document.getElementById('undo') as HTMLButtonElement)?.addEventListener('click', undo);
    const clear = () => {
        console.log('clear');
        points.forEach(p => p.remove());
        points = [];
        anchors.clear();
        updateLine();
        stage.batchDraw();
    };
    (document.getElementById('clear') as HTMLButtonElement)?.addEventListener('click', clear);
    JSON.parse(getAttr('anchors')).forEach((x: number) => anchors.add(x));
    JSON.parse(getAttr('points')).forEach((p: PlainPoint) => addPoint(p));
}

function setText(t: string) {
    const c = document.getElementById("text");
    if (c) {
        c.innerText = t;
    }
}