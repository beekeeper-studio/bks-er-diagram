import dagre from "@dagrejs/dagre";
import { useVueFlow, type Edge, type Node } from "@vue-flow/core";
import { ref } from "vue";
import type {
  ColumnReference,
  TableEntityStructure,
} from "@/composables/useSchemaDiagram";

/**
 * Composable to run the layout algorithm on the graph.
 * It uses the `dagre` library to calculate the layout of the nodes and edges.
 */
export function useLayout() {
  const { findNode } = useVueFlow();

  const graph = ref(new dagre.graphlib.Graph());

  const direction = ref("LR");

  function layout(nodes: Node[], edges: Edge<ColumnReference>[], dir: string) {
    // we create a new graph instance, in case some nodes/edges were removed, otherwise dagre would act as if they were still there
    const dagreGraph = new dagre.graphlib.Graph({
      compound: true,
      // directed: true,
    });

    graph.value = dagreGraph;

    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // const isHorizontal = dir === "LR";
    dagreGraph.setGraph({
      rankdir: "LR",
      ranker: "network-simplex",
      acyclicer: "greedy",
      // align: "UR",
      nodesep: 80,
      ranksep: 40,
      edgesep: 10,
      marginx: 40,
      marginy: 40,
    });

    direction.value = dir;

    for (const node of nodes) {
      // if you need width+height of nodes for your layout, you can use the dimensions property of the internal node (`GraphNode` type)
      const graphNode = findNode(node.id)!;

      dagreGraph.setNode(node.id, {
        width: graphNode.dimensions.width,
        height: graphNode.dimensions.height,
      });

      // if (node.parentNode) {
      //   dagreGraph.setParent(node.id, node.parentNode);
      // }
    }

    for (const edge of edges) {
      const sourceSchema = edge.data?.from.entity.schema || "";
      const targetSchema = edge.data?.to.entity.schema || "";
      const isWithinSchemaRelation = sourceSchema === targetSchema;

      dagreGraph.setEdge(edge.source, edge.target, {
        // higher = straighter + shorter
        weight: isWithinSchemaRelation ? 10 : 1,
        minlen: 1,
      });
    }

    dagre.layout(dagreGraph);

    // set nodes with updated positions
    return (node: Node): Node => {
      const nodeWithPosition = dagreGraph.node(node.id);
      return {
        ...node,
        ...dagreGraph.node(node.id),
        // targetPosition: isHorizontal ? Position.Left : Position.Top,
        // sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
        position: { x: nodeWithPosition.x, y: nodeWithPosition.y },
      };
    };
  }

  return { graph, layout, previousDirection: direction };
}
