import assert from "node:assert/strict";
import { selectionUnion, selectionIntersection, selectionSubtract, getSelectionBounds } from "../src/editor/selection.js";
import { copySelection, pasteClipboard } from "../src/editor/clipboard.js";
import { createBuffer } from "../src/editor/pixels.js";
import { rotate90CW, scaleNearest } from "../src/editor/tools/transform.js";

type TestFn = () => void;

function runTest(name: string, fn: TestFn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

runTest("selectionUnion merges masks", () => {
  const a = new Uint8Array([1, 0, 0, 1]);
  const b = new Uint8Array([0, 1, 0, 0]);
  selectionUnion(a, b);
  assert.deepEqual(Array.from(a), [1, 1, 0, 1]);
});

runTest("selectionIntersection keeps overlap", () => {
  const a = new Uint8Array([1, 1, 0, 1]);
  const b = new Uint8Array([1, 0, 0, 1]);
  selectionIntersection(a, b);
  assert.deepEqual(Array.from(a), [1, 0, 0, 1]);
});

runTest("selectionSubtract removes overlap", () => {
  const a = new Uint8Array([1, 1, 0, 1]);
  const b = new Uint8Array([0, 1, 0, 1]);
  selectionSubtract(a, b);
  assert.deepEqual(Array.from(a), [1, 0, 0, 0]);
});

runTest("getSelectionBounds finds bounds", () => {
  const mask = new Uint8Array([
    0, 0, 0, 0,
    0, 1, 1, 0,
    0, 1, 0, 0,
    0, 0, 0, 0,
  ]);
  const bounds = getSelectionBounds(mask, 4, 4);
  assert.deepEqual(bounds, { x: 1, y: 1, width: 2, height: 2 });
});

runTest("copySelection and pasteClipboard preserve pixels", () => {
  const buffer = createBuffer(4, 4, { r: 0, g: 0, b: 0, a: 0 });
  const idx = (1 * 4 + 1) * 4;
  buffer[idx] = 255;
  buffer[idx + 3] = 255;

  const selection = new Uint8Array(16);
  selection[1 * 4 + 1] = 1;

  const clip = copySelection(buffer, selection, 4, 4);
  assert.ok(clip);

  const pasted = pasteClipboard(buffer, clip, 4, 4, 2, 2);
  const pastedIdx = (2 * 4 + 2) * 4;
  assert.equal(pasted[pastedIdx], 255);
  assert.equal(pasted[pastedIdx + 3], 255);
});

runTest("rotate90CW swaps dimensions", () => {
  const buffer = createBuffer(2, 3, { r: 0, g: 0, b: 0, a: 0 });
  const result = rotate90CW(buffer, 2, 3);
  assert.equal(result.width, 3);
  assert.equal(result.height, 2);
});

runTest("scaleNearest resizes buffer", () => {
  const buffer = createBuffer(2, 2, { r: 0, g: 0, b: 0, a: 0 });
  const result = scaleNearest(buffer, 2, 2, 2, 3);
  assert.equal(result.width, 4);
  assert.equal(result.height, 6);
});
