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

import hotkeys from "hotkeys-js";
import Konva from "konva";
import { attrInput, attrNamespace, cursor, getAttr, initAttr, layer, pokeAttrs, setAttr, stage, watchAttr } from "./main";
import { Point } from "./point";

export function setupEditor() {
    console.log('setup editor');

    attrNamespace('editor');
    initAttr('dx', '100');    
    initAttr('dy', '100');
    initAttr('weapon', 'r301');
    initAttr('sens', '5.0');
    initAttr('stock', '0');
    initAttr('barrel', '0');
    
    attrInput('weapon');
    attrInput('barrel');
    attrInput('stock');
    attrInput('comment');
    attrInput('sens');
    attrInput('dx');
    attrInput('dy');

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
            console.log(img.width(), img.height());
            img.scaleX(s);
            img.scaleY(s);
            img.zIndex(0);
            points.forEach(p => p.remove());
            points = [];
            anchors.clear();
            updateLine();
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
        const mm = file.name.match(/(\d+) (\d+)\.png/)
        if (mm != null) {
            setAttr('dx', mm[1]);
            setAttr('dy', mm[2]);
        }
        const reader = new FileReader();
        reader.addEventListener('load', (event) => {
            setAttr('imagedata', (event.target?.result as string) || '')
        });
        reader.readAsDataURL(file);
    });

    stage.on('mousedown', function (e: Konva.KonvaEventObject<MouseEvent>) {
        const c = new Konva.Circle({
            radius: 6,
            stroke: `white`,
            strokeWidth: 1,
            position: cursor().plain(),
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
                    c.stroke('white');
                } else {
                    anchors.add(idx);
                    c.stroke('red');
                }
                updateSpec();
            }
            e.cancelBubble = true;
        });
        points.push(c);
        updateLine();
        layer.add(c);
        stage.batchDraw();
    });
    const updateLine = () => {
        line.points(points.flatMap((p: Konva.Circle) => [p.position().x, p.position().y]));
        updateSpec();
    };    
    const updateSpec = (_?: string) => {
        const c = document.getElementById("count");
        if (c) {
            c.innerText = `${points.length} points`;
        }
        let cpi = Number(getAttr('cpi'));
        let sens = Number(getAttr('sens'));
        let dx = Number(getAttr('dx'));
        let dy = Number(getAttr('dy'));
        if (isNaN(cpi) || isNaN(sens) || isNaN(dx) || isNaN(dy)) {
            setText('invalid value of one of the params');
            return;
        }
        const pr = new Point(dx, dy);
        if (anchors.size != 2) {
            setText('mark exactly two anchors');
            return;
        }
        const idx = Array.from(anchors.values());
        const p1 = new Point(points[idx[0]].position());
        const p2 = new Point(points[idx[1]].position());
        let pp = points.map((p: Konva.Circle) => {
            return new Point(p.position());
        });
        // <A in image pixels> 
        // * (0.1 from x10 ads) 
        // * <game sensitivity> 
        // * <distance in raw pixels> / <distance in image pixels>
        // = <A in raw pixels for 1.0 sensitivity>.
        const d = 0.1 * sens * pr.length() / p1.distance(p2);
        if (c) {
            const s =  Math.round(pr.length() / p1.distance(p2) * 100) / 100;
            const sx = Math.round(dx / Math.abs(p1.x - p2.x) * 100) / 100;
            const sy = Math.round(dy / Math.abs(p1.y - p2.y) * 100) / 100;
            c.innerText = `${points.length} points\nscale ${s} X ${sx} Y ${sy}`;
        }
        pp.forEach(p => p.s(d));
        const spec = {
            weapon: getAttr('weapon'),
            barrel: getAttr('barrel'),
            stock: getAttr('stock'),
            comment: getAttr('comment'),
            points: pp.map(p => {
                const v = p.clone().sub(pp[0]).plain();
                v.x = Math.round(v.x * 100) / 100;
                v.y = Math.round(v.y * 100) / 100;
                return v;
            }),
        };
        setText(JSON.stringify(spec));
    };
    watchAttr('cpi', updateSpec);
    watchAttr('sens', updateSpec);
    watchAttr('dx', updateSpec);
    watchAttr('dy', updateSpec);
    watchAttr('weapon', updateSpec);
    watchAttr('barrel', updateSpec);
    watchAttr('stock', updateSpec);
    watchAttr('comment', updateSpec);
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
}



function setText(t: string) {
    const c = document.getElementById("text");
    if (c) {
        c.innerText = t;
    }
}