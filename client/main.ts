import Konva from 'konva';
import { Point } from './point';
import { setupGame } from './game';
import { setupEditor } from './editor';

export const stage = new Konva.Stage({
    container: 'stage',
    width: window.screen.width,
    height: window.screen.height,
});

export const layer = new Konva.Layer();
stage.add(layer);
layer.scaleX(1);
layer.scaleY(1);

export function cursor(): Point {
    let pos = stage.getPointerPosition();
    if (pos == null) pos = { x: 0, y: 0 };
    return new Point(layer.getTransform().copy().invert().point(pos));
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

export function setAttr(name: string, value: string) {
    localStorage.setItem(attrNamespace() + ':' + name, value);
    onAttrUpdates.forEach(f => f(attrNamespace() + ':' + name, value));
}

export function watchAttrs(fn:attrUpdateFn) {
    onAttrUpdates.push(fn);
}

export function watchAttr(name: string, fn:(v: string) => void) {
    onAttrUpdates.push((n: string, v: string) => {
        if (n == attrNamespace() + ':' + name) fn(v);
    });
}

export function pokeAttrs() {
    for(let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k == null) continue;
        // console.log('poke', k, localStorage.getItem(k));
        onAttrUpdates.forEach(f => f(k, localStorage.getItem(k) || ''));
    }
}

export function attrInput(id: string) {
    const a = document.getElementById(id) as HTMLInputElement;
    if (a != null) {
        a.value = getAttr(id);
        console.log(id, a, a.type);
        if (a.type == 'text') {
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
    }
};

console.log(window.location.pathname);

if (window.location.pathname === '/editor') {
    setupEditor();
} else {
    setupGame();
}
pokeAttrs();
stage.batchDraw();