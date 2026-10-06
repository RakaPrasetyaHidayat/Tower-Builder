import assert from "node:assert/strict";
import test from "node:test";
import { findUnstableStackStart, overlapsSupport, projectedHalfExtent, projectedOffset } from "./towerPhysics.ts";

test("rejects rotated blocks whose screen-space bounds overlap but support faces do not", () => {
  const angle = 0.45;
  const tangentDistance = 105;
  const offsetX = tangentDistance * Math.cos(angle);
  const offsetY = tangentDistance * Math.sin(angle);
  const boundingHalfWidth = projectedHalfExtent(100, 20, angle, 0);

  assert.ok(Math.abs(offsetX) < 100 / 2 + boundingHalfWidth);
  assert.equal(overlapsSupport(100, 100, 20, angle, angle, offsetX, offsetY), false);
});

test("accepts rotated blocks with a real overlap along the support face", () => {
  const angle = 0.45;
  const tangentDistance = 95;

  assert.equal(
    overlapsSupport(
      100,
      100,
      20,
      angle,
      angle,
      tangentDistance * Math.cos(angle),
      tangentDistance * Math.sin(angle)
    ),
    true
  );
});

test("projects block extents and center offsets onto the support tangent", () => {
  assert.equal(projectedHalfExtent(100, 20, 0.45, 0.45), 50);
  assert.ok(Math.abs(projectedOffset(3, 4, 0, 0, 0.45) - (3 * Math.cos(0.45) + 4 * Math.sin(0.45))) < 1e-10);
});

test("detects an upper stack that has moved beyond the foundation edge", () => {
  const blocks = [
    { x: 0, y: 100, rotation: 0, width: 194, height: 60 },
    { x: 108, y: 40, rotation: 0, width: 170, height: 46 },
    { x: 108, y: -6, rotation: 0, width: 170, height: 46 },
    { x: 108, y: -52, rotation: 0, width: 170, height: 46 },
  ];

  assert.deepEqual(findUnstableStackStart(blocks), { startIndex: 1, direction: 1 });
});

test("keeps an evenly supported tower stable", () => {
  const blocks = [
    { x: 0, y: 100, rotation: 0, width: 194, height: 60 },
    { x: 0, y: 40, rotation: 0, width: 170, height: 46 },
    { x: 0, y: -6, rotation: 0, width: 170, height: 46 },
  ];

  assert.equal(findUnstableStackStart(blocks), null);
});

test("topples only the upper subsection when the foundation remains stable", () => {
  const blocks = [
    { x: 0, y: 100, rotation: 0, width: 194, height: 60 },
    { x: 0, y: 40, rotation: 0, width: 170, height: 46 },
    { x: 94, y: -6, rotation: 0, width: 170, height: 46 },
  ];

  assert.deepEqual(findUnstableStackStart(blocks), { startIndex: 2, direction: 1 });
});