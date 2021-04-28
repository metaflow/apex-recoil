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

import Konva from 'konva';
import { Point } from './point';
import { setupGame } from './game';
import { setupEditor } from './editor';

export const stage = new Konva.Stage({
    container: 'stage',
    width: window.screen.width,
    height: window.screen.height,
});

document.getElementById('stage')?.addEventListener('contextmenu', e => {
    e.preventDefault();
});

export const layer = new Konva.Layer();
stage.add(layer);

layer.scaleX(1);
layer.scaleY(1);

export function cursor(): Point {
    let pos = stage.getPointerPosition();
    if (pos == null) pos = { x: 0, y: 0 };
   return new Point(pos);
}

let _attrNamespace = '';
type attrUpdateFn = (name: string, v: string) => void;
let onAttrUpdates: attrUpdateFn[] = [];

export function attrNamespace(v?: string): string {
    if (v != null) _attrNamespace = v;
    return _attrNamespace;
}

export function getAttr(name: string): string {
    return localStorage.getItem(attrNamespace() + ':' + name) || '';
}

export function initAttr(name: string, def: string) {
    const s = attrNamespace() + ':' + name;
    if (localStorage.getItem(s) == null) localStorage.setItem(s, def);
}

let attrUpdatesActive = true;
export function suspendAttrUpdates() {
    attrUpdatesActive = false;
}

export function resumeAttrUpdates() {
    attrUpdatesActive = true;    
}

export function setAttr(name: string, value: string) {
    localStorage.setItem(attrNamespace() + ':' + name, value);
    if (attrUpdatesActive) {
        onAttrUpdates.forEach(f => f(attrNamespace() + ':' + name, value));
    }
}

export function watchAttrs(fn: attrUpdateFn) {
    onAttrUpdates.push(fn);
}

export function watchAttr(names: string | string[], fn: (v: string) => void) {
    if (typeof names == 'string') {
        names = [names];
    }
    onAttrUpdates.push((n: string, v: string) => {
        for (const x of names) {
            if (n == attrNamespace() + ':' + x) fn(v);
        }
    });
}

export function pokeAttrs() {
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k == null) continue;
        onAttrUpdates.forEach(f => f(k, localStorage.getItem(k) || ''));
    }
}

export function attrInput(id: string) {
    const a = document.getElementById(id) as HTMLInputElement;
    if (a == null) {
        console.error('input',id, 'not found');
        return;
    }
    a.value = getAttr(id);
    if (a.type == 'text' || a.type == 'textarea' || a.type == 'range') {
        a.onkeyup = a.onchange = () => {
            setAttr(id, a.value);
        };
        watchAttr(id, (v: string) => {
            a.value = v;
        });
        return;
    }
    if (a.type == 'checkbox') {
        a.onchange = () => {
            setAttr(id, a.checked + '');
        };
        watchAttr(id, (v: string) => {
            a.checked = v == (true + '');
        });
        return;
    }
    console.error('unknown input type', a.type);
}

export function attrNumericInput(id: string) {
    attrInput(id);
    const a = document.getElementById(id) as HTMLInputElement;
    if (a == null) {
        console.error('input',id, 'not found');
        return;
    }
    a.addEventListener('keydown', (e) => {
        if (e.key == 'ArrowDown') {
            setAttr('threshold', Math.max(0, Number(getAttr('threshold')) - 1).toString());
        }
        if (e.key == 'ArrowUp') {
            setAttr('threshold', Math.min(255, Number(getAttr('threshold')) + 1).toString());
        }
        console.log(e);
    });
}

// console.log(window.location.pathname);
if (window.location.pathname === '/editor') {
    setupEditor();
} else {
    setupGame();
}
pokeAttrs();
stage.batchDraw();