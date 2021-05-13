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
import { pokeAttrs } from './storage';

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

export function cursor(): Point {
  let pos = stage.getPointerPosition();
  if (pos == null) pos = { x: 0, y: 0 };
  return new Point(pos);
}

if (window.location.pathname.startsWith('/editor')) {
  setupEditor();
} else {
  setupGame();
}
pokeAttrs();
stage.batchDraw();