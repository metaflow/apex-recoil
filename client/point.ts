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

import Konva from "konva";
import { error } from "./utils";

export class PlainPoint {
  x: number = 0;
  y: number = 0;
};

export class Point implements Konva.Vector2d {
  x: number = 0;
  y: number = 0;
  constructor(v?: number | Point | PlainPoint | null, y?: number) {
    if (v == null) v = 0;
    if (v instanceof Point) {
      this.x = v.x;
      this.y = v.y;
      return;
    }
    const a = v as any;
    if (a.x != null && a.y != null) {
      this.x = a.x;
      this.y = a.y;
      return;
    }
    if (typeof v === 'number') {
      this.x = v;
    } else {
      error(v, 'is not a valid init value for point');
    }
    if (y == undefined) y = 0;
    this.y = y;
  }
  align(a: number | null): this {
    if (a == null) return this;
    this.x = Math.round(this.x / a) * a;
    this.y = Math.round(this.y / a) * a;
    return this;
  }
  clone(): this {
    return new (this.constructor as any)(this.x, this.y);
  }
  s(v: number): this {
    this.x = this.x * v;
    this.y = this.y * v;
    return this;
  }
  sub(other: this): this {
    this.x = this.x - other.x;
    this.y = this.y - other.y;
    return this;
  }
  add(other: this): this {
    this.x = this.x + other.x;
    this.y = this.y + other.y;
    return this;
  }
  // Can be removed?
  plain() {
    return { x: this.x, y: this.y } as PlainPoint;
  }
  array(): [number, number] {
    return [this.x, this.y];
  }
  distance(other: this): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  closeTo(other: this): boolean {
    return this.distance(other) < 0.1;
  }
  atan2(): number {
    return Math.atan2(this.x, this.y);
  }
  dot(o: this): number {
    return this.x * o.x + this.y * o.y;
  }
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
};