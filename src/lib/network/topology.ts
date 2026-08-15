export type NodeStatus = "healthy" | "warning" | "congested" | "failed";

export interface RouterNode {
  id: string;
  x: number; // 0..100 layout space
  y: number;
  status: NodeStatus;
  cpu: number; // %
  packetLoss: number; // %
  congestion: number; // %
  latencyTrend: "stable" | "increasing";
}

export interface Link {
  id: string;
  a: string;
  b: string;
  latency: number; // ms
  bandwidth: number; // Mbps
  packetLoss: number; // %
  reliability: number; // %
  congestion: number; // %
  status: NodeStatus;
}

export interface NetworkGraph {
  nodes: RouterNode[];
  links: Link[];
}

export const linkId = (a: string, b: string) => [a, b].sort().join("-");

export function makeNode(id: string, x: number, y: number): RouterNode {
  return {
    id,
    x,
    y,
    status: "healthy",
    cpu: 20 + Math.round(Math.random() * 30),
    packetLoss: Math.round(Math.random() * 5) / 10,
    congestion: 10 + Math.round(Math.random() * 25),
    latencyTrend: "stable",
  };
}

export function makeLink(
  a: string,
  b: string,
  latency: number,
  bandwidth: number,
  overrides: Partial<Link> = {},
): Link {
  return {
    id: linkId(a, b),
    a,
    b,
    latency,
    bandwidth,
    packetLoss: Math.round(Math.random() * 3) / 10,
    reliability: 99 + Math.round(Math.random() * 9) / 10,
    congestion: 8 + Math.round(Math.random() * 22),
    status: "healthy",
    ...overrides,
  };
}

/** Default 10-router demo topology (R1 .. R10). */
export function defaultTopology(): NetworkGraph {
  const coords: Record<string, [number, number]> = {
    R1: [8, 50],
    R2: [26, 22],
    R3: [26, 78],
    R4: [45, 8],
    R5: [45, 42],
    R6: [45, 74],
    R7: [64, 22],
    R8: [64, 60],
    R9: [80, 86],
    R10: [92, 48],
  };
  const nodes = Object.entries(coords).map(([id, [x, y]]) => makeNode(id, x, y));

  const raw: [string, string, number, number][] = [
    ["R1", "R2", 8, 100],
    ["R1", "R3", 12, 60],
    ["R2", "R4", 10, 80],
    ["R2", "R5", 7, 40],
    ["R3", "R5", 14, 70],
    ["R3", "R6", 9, 90],
    ["R4", "R7", 11, 75],
    ["R5", "R7", 6, 55],
    ["R5", "R8", 9, 30],
    ["R6", "R8", 13, 85],
    ["R6", "R9", 10, 65],
    ["R7", "R10", 12, 70],
    ["R8", "R10", 8, 95],
    ["R9", "R10", 15, 50],
    ["R4", "R5", 16, 45],
    ["R8", "R9", 7, 60],
  ];
  const links = raw.map(([a, b, l, bw]) => makeLink(a, b, l, bw));
  return { nodes, links };
}

/** Effective traversal cost of a link, used by every algorithm. */
export function linkCost(l: Link): number {
  return (
    l.latency * (1 + l.congestion / 100) +
    l.packetLoss * 8 +
    (100 - l.reliability) * 1.5 +
    (l.bandwidth < 40 ? 6 : 0)
  );
}

export function isLinkUsable(g: NetworkGraph, l: Link): boolean {
  if (l.status === "failed") return false;
  const na = g.nodes.find((n) => n.id === l.a);
  const nb = g.nodes.find((n) => n.id === l.b);
  return na?.status !== "failed" && nb?.status !== "failed";
}

export function neighbors(g: NetworkGraph, id: string): { node: string; link: Link }[] {
  return g.links
    .filter((l) => (l.a === id || l.b === id) && isLinkUsable(g, l))
    .map((l) => ({ node: l.a === id ? l.b : l.a, link: l }));
}

export function pathLinks(g: NetworkGraph, path: string[]): Link[] {
  const out: Link[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const l = g.links.find((x) => x.id === linkId(path[i]!, path[i + 1]!));
    if (l) out.push(l);
  }
  return out;
}

export function getNode(g: NetworkGraph, id: string) {
  return g.nodes.find((n) => n.id === id);
}
