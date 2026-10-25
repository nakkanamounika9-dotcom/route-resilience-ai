import { pathCost } from "./algorithms";
import {
  type NetworkGraph,
  getNode,
  isLinkUsable,
  linkCost,
} from "./topology";

const now = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

/* =====================================================================
 * Suurballe–Tarjan: two link-disjoint shortest paths (backup routing)
 * =====================================================================
 *
 * Pass 1 runs Dijkstra on the original link costs. Pass 2 runs Dijkstra on
 * the residual network built from reduced costs w'(u→v) = w + d1(u) − d1(v),
 * with every first-path arc reversed (tight arcs ⇒ reversed cost 0). The
 * intersection of the two walks decomposes into two link-disjoint paths.
 */

export interface DisjointPairResult {
  algorithm: "Suurballe–Tarjan";
  /** Up to two link-disjoint paths from source to destination. */
  paths: string[][];
  /** Combined cost of both paths (Infinity when no pair exists). */
  totalCost: number;
  timeMs: number;
}

interface Arc {
  from: string;
  to: string;
  cost: number;
  reversed: boolean;
}

function buildAdjacency(nodes: string[], arcs: Arc[]) {
  const adj = new Map<string, Arc[]>(nodes.map((n) => [n, []]));
  for (const a of arcs) adj.get(a.from)!.push(a);
  return adj;
}

function dijkstraOnArcs(
  nodes: string[],
  adj: Map<string, Arc[]>,
  src: string,
  dst: string,
) {
  const dist = new Map<string, number>([[src, 0]]);
  const prev = new Map<string, Arc>();
  const done = new Set<string>();
  for (;;) {
    let cur: string | null = null;
    let best = Infinity;
    for (const [n, d] of dist) if (!done.has(n) && d < best) ((best = d), (cur = n));
    if (cur === null) break;
    done.add(cur);
    if (cur === dst) break;
    for (const a of adj.get(cur) ?? []) {
      const nd = best + a.cost;
      if (nd < (dist.get(a.to) ?? Infinity)) {
        dist.set(a.to, nd);
        prev.set(a.to, a);
      }
    }
  }
  return { dist, prev };
}

function rebuildArcs(prev: Map<string, Arc>, src: string, dst: string): Arc[] {
  const arcs: Arc[] = [];
  let cur = dst;
  while (prev.has(cur)) {
    const a = prev.get(cur)!;
    arcs.unshift(a);
    cur = a.from;
    if (cur === src) return arcs;
  }
  return [];
}

function arcNodes(arcs: Arc[]): string[] {
  const out = [arcs[0]!.from];
  for (const a of arcs) out.push(a.to);
  return out;
}

/** Splits a directed-arc multiset into simple s→t walks (cycles dropped). */
function decompose(counts: Map<string, number>, src: string, dst: string): string[][] {
  const out: string[][] = [];
  let guard = 0;
  for (;;) {
    if (guard++ > 50) break;
    let first: string | null = null;
    for (const [key, c] of counts) {
      if (c > 0 && key.startsWith(src + ">")) {
        first = key;
        break;
      }
    }
    if (!first) break;
    const path = [src];
    const seen = new Set([src]);
    let cur = src;
    for (;;) {
      if (cur === dst) break;
      let nextKey: string | null = null;
      for (const [key, c] of counts) {
        if (c > 0 && key.startsWith(cur + ">")) {
          nextKey = key;
          break;
        }
      }
      if (!nextKey) break;
      counts.set(nextKey, (counts.get(nextKey) ?? 0) - 1);
      const nxt = nextKey.split(">")[1]!;
      if (seen.has(nxt)) {
        // Cycle detected: cut it out and continue from its first occurrence.
        const idx = path.indexOf(nxt);
        for (let i = idx + 1; i < path.length; i++) seen.delete(path[i]!);
        path.length = idx + 1;
      } else {
        seen.add(nxt);
        path.push(nxt);
      }
      cur = nxt;
    }
    if (cur === dst && path.length > 1) out.push(path);
    else break;
  }
  return out;
}

export function suurballeTarjan(
  g: NetworkGraph,
  src: string,
  dst: string,
): DisjointPairResult {
  const t0 = now();
  const fail: DisjointPairResult = {
    algorithm: "Suurballe–Tarjan",
    paths: [],
    totalCost: Infinity,
    timeMs: 0,
  };
  if (!getNode(g, src) || !getNode(g, dst) || src === dst)
    return { ...fail, timeMs: now() - t0 };

  const links = g.links.filter((l) => isLinkUsable(g, l));
  const cost = new Map(links.map((l) => [l.id, linkCost(l)]));
  const nodes = g.nodes.map((n) => n.id);

  // Pass 1 — shortest path on the original costs.
  const adj1 = buildAdjacency(
    nodes,
    links.flatMap((l) => [
      { from: l.a, to: l.b, cost: cost.get(l.id)!, reversed: false },
      { from: l.b, to: l.a, cost: cost.get(l.id)!, reversed: false },
    ]),
  );
  const pass1 = dijkstraOnArcs(nodes, adj1, src, dst);
  const p1Arcs = rebuildArcs(pass1.prev, src, dst);
  if (!p1Arcs.length) return { ...fail, timeMs: now() - t0 };
  const path1 = arcNodes(p1Arcs);

  // Reduced costs w'(u→v) = w + d1(u) − d1(v) ≥ 0 on undirected graphs.
  const d1 = pass1.dist;
  const reduced = (from: string, to: string, w: number) =>
    w + (d1.get(from) ?? 0) - (d1.get(to) ?? 0);

  // Pass 2 — residual network: first-path arcs reversed (cost 0, they are
  // tight), every other arc keeps its non-negative reduced cost.
  const onP1 = new Set(p1Arcs.map((a) => a.from + ">" + a.to));
  const arcs2: Arc[] = [];
  for (const l of links) {
    const w = cost.get(l.id)!;
    if (onP1.has(l.a + ">" + l.b)) {
      arcs2.push({ from: l.b, to: l.a, cost: -reduced(l.a, l.b, w), reversed: true });
    } else if (onP1.has(l.b + ">" + l.a)) {
      arcs2.push({ from: l.a, to: l.b, cost: -reduced(l.b, l.a, w), reversed: true });
    } else {
      arcs2.push({ from: l.a, to: l.b, cost: reduced(l.a, l.b, w), reversed: false });
      arcs2.push({ from: l.b, to: l.a, cost: reduced(l.b, l.a, w), reversed: false });
    }
  }
  const adj2 = buildAdjacency(nodes, arcs2);
  const pass2 = dijkstraOnArcs(nodes, adj2, src, dst);
  const p2Arcs = rebuildArcs(pass2.prev, src, dst);

  let paths = [path1];
  if (p2Arcs.length) {
    // Multiset of directed arcs: P1 plus the pass-2 walk, cancelled where
    // the walk un-uses a first-path arc. Decomposition yields the pair.
    const counts = new Map<string, number>();
    const bump = (key: string, delta: number) =>
      counts.set(key, (counts.get(key) ?? 0) + delta);
    for (const a of p1Arcs) bump(a.from + ">" + a.to, 1);
    for (const a of p2Arcs) {
      if (a.reversed) bump(a.to + ">" + a.from, -1);
      else bump(a.from + ">" + a.to, 1);
    }
    const split = decompose(counts, src, dst);
    if (split.length) paths = split;
  }

  const totalCost = paths.reduce((s, p) => s + pathCost(g, p), 0);
  return {
    algorithm: "Suurballe–Tarjan",
    paths,
    totalCost,
    timeMs: now() - t0,
  };
}

/* =====================================================================
 * Dinitz (Dinic) max-flow / min-cut: network connectivity evaluation
 * ===================================================================== */

export interface MinCutLink {
  id: string;
  label: string;
  capacity: number;
}

export interface ConnectivityResult {
  algorithm: "Dinitz (max-flow min-cut)";
  /** Aggregate bandwidth capacity (Mbps) between source and destination. */
  maxFlow: number;
  /** Unit-capacity max flow = number of link-disjoint s→t routes. */
  edgeConnectivity: number;
  /** Links in the minimum s→t cut (unit capacities). */
  minCutLinks: MinCutLink[];
  timeMs: number;
}

interface FlowArc {
  to: string;
  rev: number;
  cap: number;
}

function dinic(
  nodeIds: string[],
  links: { a: string; b: string; cap: number }[],
  src: string,
  dst: string,
) {
  const graph = new Map<string, FlowArc[]>(nodeIds.map((n) => [n, []]));
  const addEdge = (u: string, v: string, cap: number) => {
    const gu = graph.get(u)!;
    const gv = graph.get(v)!;
    const i = gu.length;
    const j = gv.length;
    gu.push({ to: v, rev: j, cap });
    gv.push({ to: u, rev: i, cap });
  };
  for (const l of links) addEdge(l.a, l.b, l.cap);

  const level = new Map<string, number>();
  const ptr = new Map<string, number>();

  const bfs = () => {
    level.clear();
    level.set(src, 0);
    const q = [src];
    while (q.length) {
      const u = q.shift()!;
      for (const a of graph.get(u)!) {
        if (a.cap > 0 && !level.has(a.to)) {
          level.set(a.to, level.get(u)! + 1);
          q.push(a.to);
        }
      }
    }
    return level.has(dst);
  };

  const dfs = (u: string, f: number): number => {
    if (u === dst) return f;
    const arcs = graph.get(u)!;
    for (let i = ptr.get(u)!; i < arcs.length; i++) {
      ptr.set(u, i);
      const a = arcs[i]!;
      if (a.cap > 0 && level.get(a.to) === level.get(u)! + 1) {
        const d = dfs(a.to, Math.min(f, a.cap));
        if (d > 0) {
          a.cap -= d;
          graph.get(a.to)![a.rev]!.cap += d;
          return d;
        }
      }
    }
    return 0;
  };

  let flow = 0;
  while (bfs()) {
    ptr.clear();
    nodeIds.forEach((n) => ptr.set(n, 0));
    for (;;) {
      const f = dfs(src, Infinity);
      if (f === 0) break;
      flow += f;
    }
  }
  return { flow, graph };
}

export function networkResilience(
  g: NetworkGraph,
  src: string,
  dst: string,
): ConnectivityResult {
  const t0 = now();
  const base: ConnectivityResult = {
    algorithm: "Dinitz (max-flow min-cut)",
    maxFlow: 0,
    edgeConnectivity: 0,
    minCutLinks: [],
    timeMs: 0,
  };
  if (!getNode(g, src) || !getNode(g, dst) || src === dst)
    return { ...base, timeMs: now() - t0 };

  const nodeIds = g.nodes.map((n) => n.id);
  const usable = g.links.filter((l) => isLinkUsable(g, l));

  // Unit capacities → link-disjoint route count; bandwidth → aggregate capacity.
  const unit = dinic(
    nodeIds,
    usable.map((l) => ({ a: l.a, b: l.b, cap: 1 })),
    src,
    dst,
  );
  const bw = dinic(
    nodeIds,
    usable.map((l) => ({ a: l.a, b: l.b, cap: l.bandwidth })),
    src,
    dst,
  );

  // Minimum cut: endpoints still reachable from src in the unit residual graph.
  const reach = new Set<string>([src]);
  const stack = [src];
  while (stack.length) {
    const u = stack.pop()!;
    for (const a of unit.graph.get(u)!) {
      if (a.cap > 0 && !reach.has(a.to)) {
        reach.add(a.to);
        stack.push(a.to);
      }
    }
  }
  const minCutLinks: MinCutLink[] = usable
    .filter((l) => reach.has(l.a) !== reach.has(l.b))
    .map((l) => ({ id: l.id, label: `${l.a} ↔ ${l.b}`, capacity: l.bandwidth }));

  return {
    algorithm: "Dinitz (max-flow min-cut)",
    maxFlow: Math.round(bw.flow),
    edgeConnectivity: unit.flow,
    minCutLinks,
    timeMs: now() - t0,
  };
}
