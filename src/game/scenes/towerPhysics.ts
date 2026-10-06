export function projectedHalfExtent(
  width: number,
  height: number,
  rotation: number,
  axisRotation: number
) {
  const relativeRotation = rotation - axisRotation;
  return (
    Math.abs(Math.cos(relativeRotation)) * width +
    Math.abs(Math.sin(relativeRotation)) * height
  ) / 2;
}

export function projectedOffset(
  x: number,
  y: number,
  originX: number,
  originY: number,
  axisRotation: number
) {
  return (x - originX) * Math.cos(axisRotation) + (y - originY) * Math.sin(axisRotation);
}

export function overlapsSupport(
  supportWidth: number,
  blockWidth: number,
  blockHeight: number,
  blockRotation: number,
  supportRotation: number,
  centerOffsetX: number,
  centerOffsetY: number
) {
  const offset = projectedOffset(centerOffsetX, centerOffsetY, 0, 0, supportRotation);
  const combinedHalfWidth = supportWidth / 2 + projectedHalfExtent(
    blockWidth,
    blockHeight,
    blockRotation,
    supportRotation
  );
  return Math.abs(offset) < combinedHalfWidth;
}

export interface TowerPhysicsBlock {
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
}

export function findUnstableStackStart(blocks: TowerPhysicsBlock[]) {
  for (let supportIndex = 0; supportIndex < blocks.length - 1; supportIndex++) {
    const support = blocks[supportIndex];
    const supportTopX = support.x + Math.sin(support.rotation) * support.height / 2;
    const supportTopY = support.y - Math.cos(support.rotation) * support.height / 2;
    let totalMass = 0;
    let weightedTangentOffset = 0;

    for (let blockIndex = supportIndex + 1; blockIndex < blocks.length; blockIndex++) {
      const block = blocks[blockIndex];
      const mass = block.width * block.height;
      totalMass += mass;
      weightedTangentOffset += projectedOffset(
        block.x,
        block.y,
        supportTopX,
        supportTopY,
        support.rotation
      ) * mass;
    }

    if (totalMass === 0) continue;
    const centerOffset = weightedTangentOffset / totalMass;
    if (Math.abs(centerOffset) > support.width / 2) {
      return {
        startIndex: supportIndex + 1,
        direction: Math.sign(centerOffset),
      };
    }
  }

  return null;
}