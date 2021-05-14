/**
 * Copyright 2021 Goncharov Mikhail
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

let attrUpdatesActive = true;
let allAttributes: Attribute[] = [];

export function pokeAttrs() {
  allAttributes.forEach(a => a.poke());
}

export function suspendAttrUpdates() {
  attrUpdatesActive = false;
}

export function resumeAttrUpdates() {
  allAttributes.forEach(a => {
    if (a.dirty) {
      a.dirty = false;
      a.poke();
    }
  });
  attrUpdatesActive = true;
}

export function watch(attrs: Attribute[], fn: () => void) {
  attrs.forEach(a => a.watchRaw(fn));
}

type watcher = (v: string) => void;
abstract class Attribute {
  name: string;
  namespace: string;
  def: string;
  value: string = '';
  fullName: string;
  rawWatchers: watcher[] = [];
  dirty: boolean = false;
  constructor(name: string, namespace: string, def: string) {
    this.name = name;
    this.namespace = namespace;
    this.fullName = namespace + ':' + name;
    this.def = def;
    this.init();
    allAttributes.push(this);
  }
  init() {
    let v = localStorage.getItem(this.fullName);
    if (v == null) {
      localStorage.setItem(this.fullName, this.def);
      v = this.def;
    }
    this.value = v;
    this.initInput();
  }
  poke() {
    console.log('poke', this.fullName, this.rawWatchers.length);
    this.rawWatchers.forEach(f => f(this.value));
  }
  getRaw(): string {
    return this.value;
  }
  setRaw(v: string) {
    if (v == this.value) return;
    this.value = v;
    localStorage.setItem(this.fullName, v);
    if (attrUpdatesActive) {
      this.poke();
    } else {
      this.dirty = true;
    }
  }
  watchRaw(fn: watcher) {
    this.rawWatchers.push(fn);
  }
  initInput() {
    const a = document.getElementById(this.name) as HTMLInputElement;
    if (a == null) return;
    a.value = this.getRaw();
    if (a.type == 'text' || a.type == 'textarea' || a.type == 'range') {
      a.onkeyup = a.onchange = () => {
        this.setRaw(a.value);
      };
      this.watchRaw((v: string) => {
        a.value = v;
      });
      return;
    }
    if (a.type == 'checkbox') {
      a.onchange = () => {
        this.setRaw(a.checked + '');
      };
      this.watchRaw((v: string) => {
        a.checked = v == 'true';
      });
      return;
    }
    console.error('unknown input type', this.name, a.type);
  }
}

export class StringAttribute extends Attribute {
  get(): string {
    return this.getRaw();
  }
  set(v: string) {
    this.setRaw(v);
  }
  watch(f: watcher) {
    this.watchRaw(f);
  }
}

type booleanWatcher = (v: boolean) => void;
export class BooleanAttribute extends Attribute {
  watchers: booleanWatcher[] = [];
  constructor(name: string, namespace: string, def: boolean) {
    super(name, namespace, def.toString());
  }
  get(): boolean {
    return this.getRaw() == 'true';
  }
  set(value: boolean) {
    this.setRaw(value.toString());
  }
  watch(f: (a: boolean) => void) {
    this.watchers.push(f);
  }
  poke() {
    super.poke();
    const v = this.get();
    this.watchers.forEach(f => f(v));
  }
}

type numericWatcher = (v: number) => void;
export class NumericAttribute extends Attribute {
  watchers: numericWatcher[] = [];
  constructor(name: string, namespace: string, def: number) {
    super(name, namespace, def.toString());
  }
  init() {
    super.init();
    const a = document.getElementById(this.name) as HTMLInputElement;
    if (a == null) return;
    a.addEventListener('keydown', (e) => {
      if (e.key == 'ArrowDown') {
        this.set(this.get()-1);
      }
      if (e.key == 'ArrowUp') {
        this.set(this.get()+1);
      }
    });
  }
  get(): number {
    return Number(this.getRaw());
  }
  set(value: number) {
    this.setRaw(value.toString());
  }
  watch(f: (a: number) => void) {
    this.watchers.push(f);
  }
  poke() {
    super.poke();
    const v = this.get();
    this.watchers.forEach(f => f(v));
  }
}