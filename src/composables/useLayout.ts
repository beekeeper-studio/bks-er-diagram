import dagre from "@dagrejs/dagre";
import { useVueFlow, type Edge, type Node } from "@vue-flow/core";
import { ref } from "vue";

/**
 * Composable to run the layout algorithm on the graph.
 * It uses the `dagre` library to calculate the layout of the nodes and edges.
 */
export function useLayout() {
  const { findNode } = useVueFlow();

  const graph = ref(new dagre.graphlib.Graph());

  const direction = ref("LR");

  function layout(nodes: Node[], edges: Edge[], dir: string) {
    // we create a new graph instance, in case some nodes/edges were removed, otherwise dagre would act as if they were still there
    const dagreGraph = new dagre.graphlib.Graph();

    graph.value = dagreGraph;

    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // const isHorizontal = dir === "LR";
    dagreGraph.setGraph({ rankdir: "TB",ranker: 'longest-path', align: 'UR', nodesep: 100, acyclicer: "greedy"});

    direction.value = dir;

    for (const node of nodes) {
      // if you need width+height of nodes for your layout, you can use the dimensions property of the internal node (`GraphNode` type)
      const graphNode = findNode(node.id)!;

      dagreGraph.setNode(node.id, {
        width: graphNode.dimensions.width || 150,
        height: graphNode.dimensions.height || 50,
      });
    }

    for (const edge of edges) {
      dagreGraph.setEdge(edge.source, edge.target);
    }

    dagre.layout(dagreGraph);

    // set nodes with updated positions
    return nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);

      return {
        ...node,
        // targetPosition: isHorizontal ? Position.Left : Position.Top,
        // sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
        position: { x: nodeWithPosition.x, y: nodeWithPosition.y },
      };
    });
  }

  return { graph, layout, previousDirection: direction };
}
