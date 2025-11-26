import {
  getHandleId,
  type EdgeData,
} from "@/composables/useSchemaDiagram";
import type { Column } from "@/utils/schema";
import { Position, type GraphNode } from "@vue-flow/core";
import _ from "lodash";

// returns the position (top,right,bottom or right) passed node compared to
function getParams(nodeA: GraphNode, nodeB: GraphNode, column: Column) {
  const centerA = getNodeCenter(nodeA);
  const centerB = getNodeCenter(nodeB);

  const horizontalDiff = Math.abs(centerA.x - centerB.x);
  const verticalDiff = Math.abs(centerA.y - centerB.y);

  let position;

  // when the horizontal difference between the nodes is bigger, we use Position.Left or Position.Right for the handle
  if (horizontalDiff > verticalDiff) {
    position = centerA.x > centerB.x ? Position.Left : Position.Right;
  } else {
    // here the vertical difference between the nodes is bigger, so we use Position.Top or Position.Bottom for the handle
    position = centerA.y > centerB.y ? Position.Top : Position.Bottom;
  }

  const { x, y } = getHandleCoordsByPosition(nodeA, position, column);
  return { x, y, position };
}

function getHandleCoordsByPosition(
  node: GraphNode,
  handlePosition: Position,
  column: Column,
) {
  // all handles are from type source, that's why we use handleBounds.source here
  const handle = node.handleBounds.source!.find((h) => {
    // Each table column has left/right handle. We need to find which column
    // we are targetting by the id.
    if (handlePosition === Position.Left || handlePosition === Position.Right) {
      return h.id === `${handlePosition}-${getHandleId(column)}`;
    }

    return h.position === handlePosition;
  });

  if (!handle) {
    return { x: 0, y: 0 };
  }

  let offsetX = handle.width / 2;
  let offsetY = handle.height / 2;

  // this is a tiny detail to make the markerEnd of an edge visible.
  // The handle position that gets calculated has the origin top-left, so depending which side we are using, we add a little offset
  // when the handlePosition is Position.Right for example, we need to add an offset as big as the handle itself in order to get the correct position
  switch (handlePosition) {
    case Position.Left:
      offsetX = 0;
      break;
    case Position.Right:
      offsetX = handle.width;
      break;
    case Position.Top:
      offsetY = 0;
      break;
    case Position.Bottom:
      offsetY = handle.height;
      break;
  }

  const x = node.computedPosition.x + handle.x + offsetX;
  const y = node.computedPosition.y + handle.y + offsetY;

  return { x, y };
}

function getNodeCenter(node: GraphNode) {
  return {
    x: node.computedPosition.x + node.dimensions.width / 2,
    y: node.computedPosition.y + node.dimensions.height / 2,
  };
}

// returns the parameters (sx, sy, tx, ty, sourcePos, targetPos) you need to create an edge
export function getEdgeParams(
  source: GraphNode,
  target: GraphNode,
  data: EdgeData,
) {
  const {
    x: sx,
    y: sy,
    position: sourcePos,
  } = getParams(source, target, data.from);
  const {
    x: tx,
    y: ty,
    position: targetPos,
  } = getParams(target, source, data.to);

  return {
    sx,
    sy,
    tx,
    ty,
    sourcePos,
    targetPos,
  };
}
