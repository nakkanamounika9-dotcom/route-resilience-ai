import {
  type NetworkGraph,
  getNode,
  linkCost,
  neighbors,
  pathLinks,
} from "./topology";

export interface RouteResult {
  algorithm: "Dijkstra" | "A*" | "Beam Search";
  path: string[];
  cost: number;
  nodesExplored: number;
  timeMs: number;
  candidates: Candidate[];
  trace: TraceStep[];
}

export interface Candidate {
  path: string[];
  cost: number;
  score: number;
  kept: boolean;
}

export interface TraceStep {
  node: string;
  g: number;
  h: number;
  f: number;
}

const now = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

export function pathCost(g: NetworkGraph, path: string[]): number {
  return pathLinks(g, path).reduce((s, l) => s + linkCost(l), 0);
}

/** Straight-line style heuristic scaled to network cost units. */
export function heuristic(g: NetworkGraph, from: string, to: string): number {
  const a = getNode(g, from);
  const b = getNode(g, to);
  if (!a || !b) return 0;
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  return d * 0.16;
}

export function dijkstra(g: NetworkGraph, src: string, dst: string): RouteResult {
  const t0 = now();
  const dist = new Map<string, number>([[src, 0]]);
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  const trace: TraceStep[] = [];

  while (true) {
    let cur: string | null = null;
    let best = Infinity;
    for (const [n, d] of dist) if (!visited.has(n) && d < best) ((best = d), (cur = n));
    if (cur === null) break;
    visited.add(cur);
    trace.push({ node: cur, g: best, h: 0, f: best });
    if (cur === dst) break;
    for (const { node, link } of neighbors(g, cur)) {
      const nd = best + linkCost(link);
      if (nd < (dist.get(node) ?? Infinity)) {
        dist.set(node, nd);
        prev.set(node, cur);
      }
    }
  }

  const path = rebuild(prev, src, dst);
  return {
    algorithm: "Dijkstra",
    path,
    cost: path.length ? pathCost(g, path) : Infinity,
    nodesExplored: visited.size,
    timeMs: now() - t0,
    candidates: path.length
      ? [{ path, cost: pathCost(g, path), score: 0, kept: true }]
      : [],
    trace,
  };
}

export function astar(g: NetworkGraph, src: string, dst: string): RouteResult {
  const t0 = now();
  const gScore = new Map<string, number>([[src, 0]]);
  const open = new Set<string>([src]);
  const prev = new Map<string, string>();
  const closed = new Set<string>();
  const trace: TraceStep[] = [];

  while (open.size) {
    let cur = "";
    let bestF = Infinity;
    for (const n of open) {
      const f = (gScore.get(n) ?? Infinity) + heuristic(g, n, dst);
      if (f < bestF) ((bestF = f), (cur = n));
    }
    open.delete(cur);
    closed.add(cur);
    const gc = gScore.get(cur) ?? 0;
    trace.push({ node: cur, g: gc, h: heuristic(g, cur, dst), f: bestF });
    if (cur === dst) break;
    for (const { node, link } of neighbors(g, cur)) {
      if (closed.has(node)) continue;
      const tentative = gc + linkCost(link);
      if (tentative < (gScore.get(node) ?? Infinity)) {
        gScore.set(node, tentative);
        prev.set(node, cur);
        open.add(node);
      }
    }
  }

  const path = rebuild(prev, src, dst);
  return {
    algorithm: "A*",
    path,
    cost: path.length ? pathCost(g, path) : Infinity,
    nodesExplored: closed.size,
    timeMs: now() - t0,
    candidates: path.length
      ? [{ path, cost: pathCost(g, path), score: 0, kept: true }]
      : [],
    trace,
  };
}

export function beamSearch(
  g: NetworkGraph,
  src: string,
  dst: string,
  width = 3,
): RouteResult {
  const t0 = now();
  let beam: { path: string[]; cost: number }[] = [{ path: [src], cost: 0 }];
  const completed: { path: string[]; cost: number }[] = [];
  const candidates: Candidate[] = [];
  let explored = 0;
  const maxDepth = g.nodes.length + 2;

  for (let depth = 0; depth < maxDepth && beam.length; depth++) {
    const expanded: { path: string[]; cost: number }[] = [];
    for (const b of beam) {
      const tail = b.path[b.path.length - 1]!;
      explored++;
      for (const { node, link } of neighbors(g, tail)) {
        if (b.path.includes(node)) continue;
        const next = { path: [...b.path, node], cost: b.cost + linkCost(link) };
        if (node === dst) completed.push(next);
        else expanded.push(next);
      }
    }
    const scored = expanded
      .map((e) => ({ ...e, score: e.cost + heuristic(g, e.path[e.path.length - 1]!, dst) }))
      .sort((x, y) => x.score - y.score);
    scored.forEach((s, i) =>
      candidates.push({
        path: s.path,
        cost: s.cost,
        score: s.score,
        kept: i < width,
      }),
    );
    beam = scored.slice(0, width).map(({ path, cost }) => ({ path, cost }));
  }

  completed.sort((a, b) => a.cost - b.cost);
  const finals: Candidate[] = completed.slice(0, Math.max(width, 3)).map((c) => ({
    path: c.path,
    cost: c.cost,
    score: c.cost,
    kept: true,
  }));
  const best = completed[0];
  return {
    algorithm: "Beam Search",
    path: best?.path ?? [],
    cost: best?.cost ?? Infinity,
    nodesExplored: explored,
    timeMs: now() - t0,
    candidates: finals.length ? finals : candidates.filter((c) => c.kept).slice(0, width),
    trace: [],
  };
}

function rebuild(prev: Map<string, string>, src: string, dst: string): string[] {
  if (src === dst) return [src];
  const out = [dst];
  let cur = dst;
  while (prev.has(cur)) {
    cur = prev.get(cur)!;
    out.unshift(cur);
    if (cur === src) return out;
  }
  return [];
}

/** K alternative simple paths (used for backup route generation). */
export function kAlternativePaths(
  g: NetworkGraph,
  src: string,
  dst: string,
  k = 5,
): string[][] {
  const results: string[][] = [];
  const seen = new Set<string>();
  const stack: { path: string[]; cost: number }[] = [{ path: [src], cost: 0 }];
  let guard = 0;
  while (stack.length && results.length < 60 && guard++ < 20000) {
    const cur = stack.pop()!;
    const tail = cur.path[cur.path.length - 1]!;
    if (tail === dst) {
      const key = cur.path.join(">");
      if (!seen.has(key)) {
        seen.add(key);
        results.push(cur.path);
      }
      continue;
    }
    if (cur.path.length > 7) continue;
    for (const { node } of neighbors(g, tail)) {
      if (cur.path.includes(node)) continue;
      stack.push({ path: [...cur.path, node], cost: 0 });
    }
  }
  return results.sort((a, b) => pathCost(g, a) - pathCost(g, b)).slice(0, k);
}
