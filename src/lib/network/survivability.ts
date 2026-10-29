/*
 * Network Survivability engine — based on:
 *   F. A. Kuipers, "An Overview of Algorithms for Network Survivability",
 *   ISRN Communications and Networking, vol. 2012, Article ID 932456, 2012.
 *
 * Implements the paper's three ingredients of survivability:
 *   (1) Network connectivity  — Menger's theorem, min cuts (max-flow), bridges,
 *       articulation points, algebraic connectivity (Fiedler eigenvalue).
 *   (2) Network augmentation  — Eswaran–Tarjan style suggestions to reach
 *       2-link-connectivity by pairing the leaves of the bridge-block tree.
 *   (3) Path protection       — Suurballe's algorithm for two link/node-disjoint
 *       min-cost paths, 1:1 / 1+1 protection vs. restoration, max-reliability
 *       disjoint pairs (She et al. weights w = -ln(1-p)) and SRLG checks.
 */
import {
  type Link,
  type NetworkGraph,
  isLinkUsable,
  linkCost,
  linkId,
  pathLinks,
} from "./topology";

/* ------------------------------------------------------------------ */
/* Basic helpers                                                       */
/* ------------------------------------------------------------------ */

/** Undirected adjacency over usable (non-failed) links only. */
function usableAdj(g: NetworkGraph): Map<string, { node: string; link: Link }[]> {
  const adj = new Map<string, { node: string; link: Link }[]>();
  for (const n of g.nodes) adj.set(n.id, []);
  for (const l of g.links) {
    if (!isLinkUsable(g, l)) continue;
    adj.get(l.a)?.push({ node: l.b, link: l });
    adj.get(l.b)?.push({ node: l.a, link: l });
  }
  return adj;
}

export function connectedComponents(g: NetworkGraph): string[][] {
  const adj = usableAdj(g);
  const seen = new Set<string>();
  const comps: string[][] = [];
  for (const n of g.nodes) {
    if (seen.has(n.id)) continue;
    const comp: string[] = [];
    const q = [n.id];
    seen.add(n.id);
    while (q.length) {
      const u = q.shift()!;
      comp.push(u);
      for (const { node: v } of adj.get(u) ?? []) {
        if (!seen.has(v)) {
          seen.add(v);
          q.push(v);
        }
      }
    }
    comps.push(comp);
  }
  return comps;
}

/* ------------------------------------------------------------------ */
/* (1a) Bridges and articulation points — Tarjan DFS                   */
/* ------------------------------------------------------------------ */

export interface CriticalComponents {
  bridges: string[]; // link ids whose removal disconnects the graph
  articulationPoints: string[]; // routers whose removal disconnects the graph
}

export function findCriticalComponents(g: NetworkGraph): CriticalComponents {
  const adj = usableAdj(g);
  const visited = new Set<string>();
  const disc = new Map<string, number>();
  const low = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const bridges: string[] = [];
  const artics = new Set<string>();
  let timer = 0;

  const dfs = (u: string) => {
    visited.add(u);
    disc.set(u, timer);
    low.set(u, timer);
    timer++;
    let children = 0;
    for (const { node: v, link } of adj.get(u) ?? []) {
      if (v === parent.get(u)) continue;
      if (visited.has(v)) {
        low.set(u, Math.min(low.get(u)!, disc.get(v)!));
      } else {
        parent.set(v, u);
        children++;
        dfs(v);
        low.set(u, Math.min(low.get(u)!, low.get(v)!));
        if (low.get(v)! > disc.get(u)!) bridges.push(link.id);
        if (parent.get(u) == null && children > 1) artics.add(u);
        if (parent.get(u) != null && low.get(v)! >= disc.get(u)!) artics.add(u);
      }
    }
  };

  for (const n of g.nodes) {
    if (!visited.has(n.id)) {
      parent.set(n.id, null);
      dfs(n.id);
    }
  }
  return { bridges, articulationPoints: [...artics] };
}

/* ------------------------------------------------------------------ */
/* (1b) Max-flow (Edmonds–Karp) on unit capacities → disjoint path     */
/* counts and minimum cuts (Menger's theorem)                          */
/* ------------------------------------------------------------------ */

/** Simple adjacency-array max-flow. Arc i and its reverse are i ^ 1. */
function maxFlow(
  n: number,
  arcs: [number, number, number][], // from, to, capacity
  s: number,
  t: number,
): { flow: number; reachable: boolean[] } {
  const graph: number[][] = Array.from({ length: n }, () => []);
  const to: number[] = [];
  const cap: number[] = [];
  const add = (a: number, b: number, c: number) => {
    graph[a]!.push(to.length);
    to.push(b);
    cap.push(c);
    graph[b]!.push(to.length);
    to.push(a);
    cap.push(0);
  };
  for (const [a, b, c] of arcs) add(a, b, c);

  let flow = 0;
  for (;;) {
    const prev = new Int32Array(n).fill(-1);
    const prevArc = new Int32Array(n).fill(-1);
    prev[s] = s;
    const q = [s];
    for (let qi = 0; qi < q.length && prev[t] === -1; qi++) {
      const u = q[qi]!;
      for (const ai of graph[u]!) {
        if (cap[ai]! > 0 && prev[to[ai]!] === -1) {
          prev[to[ai]!] = u;
          prevArc[to[ai]!] = ai;
          q.push(to[ai]!);
        }
      }
    }
    if (prev[t] === -1) break;
    let f = Infinity;
    for (let v = t; v !== s; v = prev[v]!) f = Math.min(f, cap[prevArc[v]!]!);
    for (let v = t; v !== s; v = prev[v!]!) {
      cap[prevArc[v]!]! -= f;
      cap[prevArc[v]! ^ 1]! += f;
    }
    flow += f;
  }

  const reachable = new Array<boolean>(n).fill(false);
  reachable[s] = true;
  const q2 = [s];
  for (let qi = 0; qi < q2.length; qi++) {
    const u = q2[qi]!;
    for (const ai of graph[u]!) {
      if (cap[ai]! > 0 && !reachable[to[ai]!]) {
        reachable[to[ai]!] = true;
        q2.push(to[ai]!);
      }
    }
  }
  return { flow, reachable };
}

/** Max number of link-disjoint s→t paths + the minimum s-t cut (Menger). */
export function linkDisjointInfo(
  g: NetworkGraph,
  s: string,
  t: string,
): { pairs: number; cutLinks: string[] } {
  const idx = new Map(g.nodes.map((n, i) => [n.id, i] as const));
  const si = idx.get(s);
  const ti = idx.get(t);
  if (si == null || ti == null || s === t) return { pairs: 0, cutLinks: [] };
  const usable = g.links.filter((l) => isLinkUsable(g, l));
  const arcLink: { id: string; a: number; b: number }[] = [];
  const arcs: [number, number, number][] = [];
  for (const l of usable) {
    const a = idx.get(l.a)!;
    const b = idx.get(l.b)!;
    arcLink.push({ id: l.id, a, b });
    arcs.push([a, b, 1]);
    arcs.push([b, a, 1]); // undirected: the link is traversable both ways
  }
  const { flow, reachable } = maxFlow(g.nodes.length, arcs, si, ti);
  const cutLinks = arcLink.filter((e) => reachable[e.a] !== reachable[e.b]).map((e) => e.id);
  return { pairs: flow, cutLinks };
}

/** Max number of node-disjoint (internally disjoint) s→t paths. */
export function nodeDisjointPairs(g: NetworkGraph, s: string, t: string): number {
  const idx = new Map(g.nodes.map((n, i) => [n.id, i] as const));
  const si = idx.get(s);
  const ti = idx.get(t);
  if (si == null || ti == null || s === t) return 0;
  const n = g.nodes.length;
  const usable = g.links.filter((l) => isLinkUsable(g, l));
  const arcs: [number, number, number][] = [];
  // split every node except s and t: in = i, out = n + i, internal capacity 1
  for (let i = 0; i < n; i++) {
    if (i !== si && i !== ti) arcs.push([i, n + i, 1]);
  }
  for (const l of usable) {
    const a = idx.get(l.a)!;
    const b = idx.get(l.b)!;
    const outA = a !== si && a !== ti ? n + a : a;
    const outB = b !== si && b !== ti ? n + b : b;
    arcs.push([outA, b, 1]);
    arcs.push([outB, a, 1]);
  }
  return maxFlow(2 * n, arcs, si, ti).flow;
}

/* ------------------------------------------------------------------ */
/* (1c) Algebraic connectivity — Fiedler value of the Laplacian        */
/* ------------------------------------------------------------------ */

function jacobiEigenvalues(m: number[][]): number[] {
  const n = m.length;
  const a = m.map((r) => [...r]);
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) off += a[i]![j]! * a[i]![j]!;
    if (off < 1e-12) break;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = a[p]![q]!;
        if (Math.abs(apq) < 1e-14) continue;
        const theta = (a[q]![q]! - a[p]![p]!) / (2 * apq);
        const t =
          theta >= 0
            ? 1 / (theta + Math.sqrt(theta * theta + 1))
            : -1 / (-theta + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k]![p]!;
          const akq = a[k]![q]!;
          a[k]![p] = c * akp - s * akq;
          a[k]![q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p]![k]!;
          const aqk = a[q]![k]!;
          a[p]![k] = c * apk - s * aqk;
          a[q]![k] = s * apk + c * aqk;
        }
      }
    }
  }
  return a.map((r, i) => r[i]!).sort((x, y) => x - y);
}

/** α(G): second-smallest eigenvalue of the Laplacian Q = Δ − A (0 ⇒ disconnected). */
export function algebraicConnectivity(g: NetworkGraph): number {
  const n = g.nodes.length;
  if (n < 2) return 0;
  const idx = new Map(g.nodes.map((n2, i) => [n2.id, i] as const));
  const A: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (const l of g.links) {
    if (!isLinkUsable(g, l)) continue;
    const a = idx.get(l.a);
    const b = idx.get(l.b);
    if (a == null || b == null) continue;
    A[a]![b] = 1;
    A[b]![a] = 1;
  }
  const Q = A.map((row, i) => row.map((v, j) => (i === j ? row.reduce((s, x) => s + x, 0) : -v)));
  const eigs = jacobiEigenvalues(Q);
  return Math.round((eigs[1] ?? 0) * 1000) / 1000;
}

/* ------------------------------------------------------------------ */
/* (1d) Aggregate connectivity report                                  */
/* ------------------------------------------------------------------ */

export interface SurvivabilityReport {
  nodeCount: number;
  usableLinks: number;
  linkConnectivity: number; // λ(G) — min link cut / link-disjoint pairs
  nodeConnectivity: number; // κ(G) — min node cut
  algebraicConnectivity: number; // α(G)
  minDegree: number; // δ(G)
  components: number;
  bridges: string[];
  articulationPoints: string[];
  menger: { s: string; t: string; disjointPairs: number; cutLinks: string[] } | null;
}

/**
 * α(G) ≤ κ(G) ≤ λ(G) ≤ δ(G) must hold (Kuipers eq. 1).
 * λ and κ are computed with a minimum-degree source: for any source s,
 * min over t of maxflow(s,t) equals the global minimum cut.
 */
export function connectivityReport(g: NetworkGraph, s: string, t: string): SurvivabilityReport {
  const adj = usableAdj(g);
  const degrees = g.nodes.map((n) => (adj.get(n.id) ?? []).length);
  const minDegree = g.nodes.length ? Math.min(...degrees) : 0;
  const minDegNode = g.nodes[degrees.indexOf(minDegree)]?.id ?? s;

  let lambda = 0;
  if (g.nodes.length > 1 && minDegree > 0) {
    lambda = Infinity;
    for (const n of g.nodes) {
      if (n.id === minDegNode) continue;
      lambda = Math.min(lambda, linkDisjointInfo(g, minDegNode, n.id).pairs);
    }
  }
  let kappa = 0;
  if (g.nodes.length > 1 && minDegree > 0) {
    kappa = Infinity;
    for (const n of g.nodes) {
      if (n.id === minDegNode) continue;
      kappa = Math.min(kappa, nodeDisjointPairs(g, minDegNode, n.id));
    }
  }

  const usable = g.links.filter((l) => isLinkUsable(g, l)).length;
  const comps = connectedComponents(g);
  const crit = findCriticalComponents(g);
  const menger =
    g.nodes.some((n) => n.id === s) && g.nodes.some((n) => n.id === t) && s !== t
      ? (() => {
          const info = linkDisjointInfo(g, s, t);
          return { s, t, disjointPairs: info.pairs, cutLinks: info.cutLinks };
        })()
      : null;

  return {
    nodeCount: g.nodes.length,
    usableLinks: usable,
    linkConnectivity: Number.isFinite(lambda) ? lambda : 0,
    nodeConnectivity: Number.isFinite(kappa) ? kappa : 0,
    algebraicConnectivity: algebraicConnectivity(g),
    minDegree,
    components: comps.length,
    bridges: crit.bridges,
    articulationPoints: crit.articulationPoints,
    menger,
  };
}

/* ------------------------------------------------------------------ */
/* (3) Suurballe — two disjoint min-cost paths (protection paths)      */
/* ------------------------------------------------------------------ */

export interface DisjointPathPair {
  mode: "link" | "node" | "reliability";
  exists: boolean;
  path1: string[];
  path2: string[];
  cost1: number;
  cost2: number;
  /** % probability that at least one of the two paths survives. */
  pairReliability: number;
  /** Shared Risk Link Groups used by both paths (SRLG violation). */
  sharedRiskGroups: number[];
}

function emptyPair(mode: DisjointPathPair["mode"]): DisjointPathPair {
  return {
    mode,
    exists: false,
    path1: [],
    path2: [],
    cost1: Infinity,
    cost2: Infinity,
    pairReliability: 0,
    sharedRiskGroups: [],
  };
}

function pathReliability(g: NetworkGraph, p: string[]): number {
  return pathLinks(g, p).reduce((acc, l) => acc * (l.reliability / 100), 1);
}

function riskGroupsOf(g: NetworkGraph, p: string[]): Set<number> {
  const out = new Set<number>();
  for (const l of pathLinks(g, p)) if (l.riskGroup != null) out.add(l.riskGroup);
  return out;
}

/**
 * Suurballe's algorithm (Kuipers §4.1): two link- or node-disjoint min-cost
 * paths via successive shortest paths on the residual graph, then flow
 * decomposition. `weight` defaults to the graph's effective link cost.
 */
export function suurballePaths(
  g: NetworkGraph,
  s: string,
  t: string,
  mode: "link" | "node",
  weight?: (l: Link) => number,
): DisjointPathPair {
  const w = weight ?? linkCost;
  const ids = g.nodes.map((n) => n.id);
  const idx = new Map(ids.map((id, i) => [id, i] as const));
  const si = idx.get(s);
  const ti = idx.get(t);
  if (si == null || ti == null || s === t) return emptyPair(mode);

  const n = ids.length;
  const nodeOut = (i: number) => (mode === "node" && i !== si && i !== ti ? n + i : i);
  const total = mode === "node" ? 2 * n : n;

  interface Arc {
    a: number;
    b: number;
    cap: number;
    res: number;
  }
  const arcs: Arc[] = [];
  const costs: number[] = [];
  const addArc = (a: number, b: number, cost: number) => {
    arcs.push({ a, b, cap: 1, res: 1 }); // forward (index even)
    arcs.push({ a: b, b: a, cap: 0, res: 0 }); // residual reverse (cost −cost)
    costs.push(cost);
    costs.push(-cost);
  };
  if (mode === "node") {
    for (let i = 0; i < n; i++) {
      if (i !== si && i !== ti) {
        addArc(i, n + i, 0);
      }
    }
  }
  for (const l of g.links) {
    if (!isLinkUsable(g, l)) continue;
    const a = idx.get(l.a)!;
    const b = idx.get(l.b)!;
    const c = w(l);
    addArc(nodeOut(a), b, c);
    addArc(nodeOut(b), a, c);
  }

  const spfa = (src: number): number[] | null => {
    const dist = new Array<number>(total).fill(Infinity);
    const prevArc = new Array<number>(total).fill(-1);
    dist[src] = 0;
    const inQ = new Array<boolean>(total).fill(false);
    const q = [src];
    inQ[src] = true;
    for (let qi = 0; qi < q.length; qi++) {
      const u = q[qi]!;
      inQ[u] = false;
      for (let i = 0; i < arcs.length; i++) {
        const arc = arcs[i]!;
        if (arc.a !== u || arc.res <= 0) continue;
        const nd = dist[u]! + costs[i]!;
        if (nd < dist[arc.b]!) {
          dist[arc.b] = nd;
          prevArc[arc.b] = i;
          if (!inQ[arc.b]) {
            inQ[arc.b] = true;
            q.push(arc.b);
          }
        }
      }
    }
    return dist[ti] === Infinity ? null : prevArc;
  };

  let units = 0;
  for (let unit = 0; unit < 2; unit++) {
    const prevArc = spfa(si);
    if (!prevArc) break;
    for (let v = ti; v !== si; ) {
      const i = prevArc[v]!;
      arcs[i]!.res -= 1;
      arcs[i! ^ 1]!.res += 1;
      v = arcs[i]!.a;
    }
    units++;
  }

  // Flow decomposition into `units` s-t paths (cycle-free after splicing).
  const flowOn = (i: number) => arcs[i]!.cap - arcs[i]!.res;
  const raw: number[][] = [];
  for (let unit = 0; unit < units; unit++) {
    let cur = si;
    const walk = [si];
    let guard = 0;
    while (cur !== ti && guard++ < 4 * total) {
      const next = arcs.findIndex((a, i) => a.a === cur && flowOn(i) > 0);
      if (next < 0) break;
      arcs[next]!.res += 1;
      cur = arcs[next]!.b;
      walk.push(cur);
    }
    // splice out cycles
    const seen = new Map<number, number>();
    const clean: number[] = [];
    for (const v of walk) {
      const at = seen.get(v);
      if (at != null) {
        for (let k = clean.length - 1; k >= at; k--) seen.delete(clean[k]!);
        clean.length = at;
      } else {
        seen.set(v, clean.length);
        clean.push(v);
      }
    }
    raw.push(clean);
  }

  const toOriginal = (path: number[]): string[] => {
    if (mode === "link") return path.map((i) => ids[i]!);
    const out: string[] = [];
    for (const i of path) {
      if (i >= n) continue; // "out" half of a split node
      const id = ids[i]!;
      if (!out.length || out[out.length - 1] !== id) out.push(id);
    }
    return out;
  };

  const p1 = toOriginal(raw[0] ?? []);
  const p2 = toOriginal(raw[1] ?? []);
  const exists = p1.length > 1 && p2.length > 1;
  const q1 = exists ? pathReliability(g, p1) : 0;
  const q2 = exists ? pathReliability(g, p2) : 0;
  const shared = exists
    ? [...riskGroupsOf(g, p1)].filter((x) => riskGroupsOf(g, p2).has(x))
    : [];
  return {
    mode,
    exists,
    path1: p1,
    path2: p2,
    cost1: p1.length ? Math.round(linkDisjointCost(g, p1) * 10) / 10 : Infinity,
    cost2: p2.length ? Math.round(linkDisjointCost(g, p2) * 10) / 10 : Infinity,
    pairReliability: exists
      ? Math.round((q1 + q2 - q1 * q2) * 1000) / 10 // 1 − (1−q1)(1−q2)
      : p1.length > 1
        ? Math.round(q1 * 1000) / 10
        : 0,
    sharedRiskGroups: shared,
  };
}

function linkDisjointCost(g: NetworkGraph, p: string[]): number {
  return pathLinks(g, p).reduce((sum, l) => sum + linkCost(l), 0);
}

/**
 * Maximum-reliability disjoint pair (She et al., Kuipers §4.2): link weights
 * w = −ln(1 − p) turn the min-sum objective into max-reliability. Suurballe
 * guarantees true disjointness whenever it exists.
 */
export function maxReliabilityPair(g: NetworkGraph, s: string, t: string): DisjointPathPair {
  const pair = suurballePaths(g, s, t, "link", (l) =>
    -Math.log(Math.max(0.01, 1 - l.reliability / 100)),
  );
  pair.mode = "reliability";
  return pair;
}

/* ------------------------------------------------------------------ */
/* (2) Network augmentation — Eswaran–Tarjan leaf pairing              */
/* ------------------------------------------------------------------ */

export interface AugmentationSuggestion {
  a: string;
  b: string;
  reason: string;
}

export interface AugmentationResult {
  currentLambda: number;
  components: number;
  suggestions: AugmentationSuggestion[];
  goalAchieved: boolean;
}

function usableDegree(g: NetworkGraph, id: string): number {
  return g.links.filter((l) => isLinkUsable(g, l) && (l.a === id || l.b === id)).length;
}

/**
 * Minimal set of links to add so the network becomes 2-link-connected
 * (λ ≥ 2): first join disconnected components, then pair the leaves of the
 * bridge-block tree (Eswaran–Tarjan, Kuipers §3.1).
 */
export function augmentationSuggestions(g: NetworkGraph): AugmentationResult {
  const comps = connectedComponents(g);
  const suggestions: AugmentationSuggestion[] = [];

  if (comps.length > 1) {
    const reps = comps.map((c) =>
      c.reduce((best, id) => (usableDegree(g, id) > usableDegree(g, best) ? id : best), c[0]!),
    );
    for (let i = 1; i < reps.length; i++) {
      suggestions.push({
        a: reps[i - 1]!,
        b: reps[i]!,
        reason: `Reconnect isolated component ${i + 1} to the rest of the network`,
      });
    }
  }

  const { bridges } = findCriticalComponents(g);
  if (bridges.length) {
    const bridgeSet = new Set(bridges);
    // blocks = components left after removing the bridges
    const blockOf = new Map<string, number>();
    const blockNodes: string[][] = [];
    const adj = usableAdj(g);
    const seen = new Set<string>();
    for (const n of g.nodes) {
      if (seen.has(n.id)) continue;
      const block: string[] = [];
      const q = [n.id];
      seen.add(n.id);
      while (q.length) {
        const u = q.shift()!;
        blockOf.set(u, blockNodes.length);
        block.push(u);
        for (const { node: v, link } of adj.get(u) ?? []) {
          if (bridgeSet.has(link.id) || seen.has(v)) continue;
          seen.add(v);
          q.push(v);
        }
      }
      blockNodes.push(block);
    }
    // bridge tree degree per block
    const blockDegree = new Map<number, number>();
    const blockBridge = new Map<number, string>();
    for (const id of bridges) {
      const l = g.links.find((x) => x.id === id);
      if (!l) continue;
      const ba = blockOf.get(l.a)!;
      const bb = blockOf.get(l.b)!;
      blockDegree.set(ba, (blockDegree.get(ba) ?? 0) + 1);
      blockDegree.set(bb, (blockDegree.get(bb) ?? 0) + 1);
      blockBridge.set(ba, id);
      blockBridge.set(bb, id);
    }
    const leaves = [...blockDegree.entries()]
      .filter(([, d]) => d === 1)
      .map(([b]) => b)
      .sort((x, y) => x - y);
    const rep = (b: number): string => {
      const bridgeId = blockBridge.get(b)!;
      const l = g.links.find((x) => x.id === bridgeId)!;
      return blockOf.get(l.a) === b ? l.a : l.b;
    };
    const r = leaves.length;
    const m = Math.floor(r / 2);
    for (let i = 0; i < m; i++) {
      const a = rep(leaves[i]!);
      const b = rep(leaves[i + m]!);
      if (a === b) continue;
      suggestions.push({
        a,
        b,
        reason: `Bridge-tree leaf pairing — removes a single point of failure (Eswaran–Tarjan)`,
      });
    }
    if (r > 2 && r % 2 === 1) {
      const a = rep(leaves[m - 1]!);
      const b = rep(leaves[r - 1]!);
      if (a !== b && !suggestions.some((s2) => (s2.a === a && s2.b === b) || (s2.a === b && s2.b === a))) {
        suggestions.push({
          a,
          b,
          reason: "Bridge-tree leaf pairing — removes a single point of failure (Eswaran–Tarjan)",
        });
      }
    }
  }

  const report = connectivityReport(g, g.nodes[0]?.id ?? "", g.nodes[1]?.id ?? "");
  return {
    currentLambda: report.linkConnectivity,
    components: comps.length,
    suggestions,
    goalAchieved: suggestions.length === 0,
  };
}

/* ------------------------------------------------------------------ */
/* Protection scheme comparison (Kuipers §1.3)                         */
/* ------------------------------------------------------------------ */

export interface ProtectionSchemeRow {
  scheme: string;
  backup: string;
  capacityOverhead: string;
  recoveryTime: string;
  guarantee: string;
}

export function protectionSchemeRows(): ProtectionSchemeRow[] {
  return [
    {
      scheme: "1:1 protection",
      backup: "Precomputed disjoint backup path, reserved in advance",
      capacityOverhead: "100% (backup reserved, idle)",
      recoveryTime: "Near-instant switching on failure detection",
      guarantee: "Guaranteed against single failure (if truly disjoint)",
    },
    {
      scheme: "1+1 protection",
      backup: "Traffic duplicated on both paths concurrently",
      capacityOverhead: "200% (double bandwidth on both paths)",
      recoveryTime: "Zero — receiver picks whichever copy arrives",
      guarantee: "Strongest — survives even detection failure",
    },
    {
      scheme: "Restoration",
      backup: "Computed reactively after the failure is sensed",
      capacityOverhead: "0% reserved (spare capacity only)",
      recoveryTime: "Longer — search + signalling after failure",
      guarantee: "No guarantee — a backup may not exist when needed",
    },
  ];
}
