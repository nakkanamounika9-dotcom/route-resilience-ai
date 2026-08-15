import {
  astar,
  beamSearch,
  dijkstra,
  kAlternativePaths,
  pathCost,
  type RouteResult,
} from "./algorithms";
import { checkConstraints, type Constraints, type CSPResult } from "./csp";
import { routeDiversity, type Diversity } from "./diversity";
import { failurePrediction } from "./health";
import { type NetworkGraph, getNode, pathLinks } from "./topology";

export type AlgorithmName = "Dijkstra" | "A*" | "Beam Search";

export interface RankedRoute extends CSPResult {
  score: number;
  diversity: Diversity;
  riskScore: number;
  cost: number;
}

export function runAlgorithm(
  g: NetworkGraph,
  algo: AlgorithmName,
  src: string,
  dst: string,
  beamWidth: number,
): RouteResult {
  if (algo === "Dijkstra") return dijkstra(g, src, dst);
  if (algo === "A*") return astar(g, src, dst);
  return beamSearch(g, src, dst, beamWidth);
}

/** Route health/quality score used for final ranking (0..100). */
export function scoreRoute(
  g: NetworkGraph,
  r: CSPResult,
  diversity: Diversity,
  isPrimary: boolean,
): RankedRoute {
  const m = r.metrics;
  const risk =
    r.path.reduce((s, id) => {
      const n = getNode(g, id);
      return s + (n ? failurePrediction(n).risk : 0);
    }, 0) / Math.max(1, r.path.length);

  const latencyScore = Math.max(0, 100 - m.latency * 1.6);
  const bwScore = Math.min(100, m.bandwidth);
  const congestionScore = 100 - m.congestion;
  const hopScore = Math.max(0, 100 - m.hops * 12);
  const lossScore = Math.max(0, 100 - m.packetLoss * 20);

  const base =
    latencyScore * 0.22 +
    bwScore * 0.16 +
    congestionScore * 0.14 +
    hopScore * 0.1 +
    m.reliability * 0.16 +
    lossScore * 0.07 +
    (100 - risk) * 0.15;

  const diversityBonus = isPrimary ? 0 : (diversity.score - 50) * 0.12;
  const score = Math.max(0, Math.min(100, Math.round(base + diversityBonus)));

  return {
    ...r,
    score,
    diversity,
    riskScore: Math.round(risk),
    cost: Math.round(pathCost(g, r.path) * 10) / 10,
  };
}

export interface PlanResult {
  primary: RankedRoute | null;
  ranked: RankedRoute[];
  rejected: RankedRoute[];
  backups: RankedRoute[];
  algoResult: RouteResult;
  candidateCount: number;
}

export function planRoutes(
  g: NetworkGraph,
  algo: AlgorithmName,
  src: string,
  dst: string,
  constraints: Constraints,
  beamWidth: number,
): PlanResult {
  const algoResult = runAlgorithm(g, algo, src, dst, beamWidth);

  const pathsKey = new Set<string>();
  const paths: string[][] = [];
  const push = (p: string[]) => {
    if (!p.length) return;
    const k = p.join(">");
    if (pathsKey.has(k)) return;
    pathsKey.add(k);
    paths.push(p);
  };
  if (algoResult.path.length) push(algoResult.path);
  algoResult.candidates.forEach((c) => push(c.path));
  kAlternativePaths(g, src, dst, algo === "Beam Search" ? beamWidth + 3 : 5).forEach(push);

  const checked = paths.map((p) => checkConstraints(g, p, constraints));
  const valid = checked.filter((c) => c.valid);
  const invalid = checked.filter((c) => !c.valid);

  const preferred = valid.find((v) => v.path.join(">") === algoResult.path.join(">")) ?? valid[0];
  const ranked = valid
    .map((v) =>
      scoreRoute(
        g,
        v,
        routeDiversity(g, preferred?.path ?? [], v.path),
        v === preferred,
      ),
    )
    .sort((a, b) => b.score - a.score);

  const rejected = invalid.map((v) =>
    scoreRoute(g, v, routeDiversity(g, preferred?.path ?? [], v.path), false),
  );

  const primary = ranked[0] ?? null;
  const backups = ranked
    .slice(1)
    .map((r) =>
      scoreRoute(g, r, routeDiversity(g, primary?.path ?? [], r.path), false),
    )
    .sort((a, b) => b.diversity.score * 0.5 + b.score * 0.5 - (a.diversity.score * 0.5 + a.score * 0.5))
    .slice(0, 3);

  return {
    primary,
    ranked,
    rejected,
    backups,
    algoResult,
    candidateCount: paths.length,
  };
}

export function comparisonRun(
  g: NetworkGraph,
  src: string,
  dst: string,
  constraints: Constraints,
  beamWidth: number,
) {
  return (["Dijkstra", "A*", "Beam Search"] as AlgorithmName[]).map((algo) => {
    const r = runAlgorithm(g, algo, src, dst, beamWidth);
    const csp = checkConstraints(g, r.path, constraints);
    return {
      algorithm: algo,
      path: r.path,
      cost: Math.round(r.cost * 10) / 10,
      timeMs: Math.round(r.timeMs * 1000) / 1000,
      nodesExplored: r.nodesExplored,
      candidates: r.candidates.length,
      valid: csp.valid,
      violations: csp.violations,
      searchEffort: r.nodesExplored + r.candidates.length * 2,
    };
  });
}

export const routeLabel = (p: string[]) => (p.length ? p.join(" → ") : "—");

export const usesLink = (path: string[], id: string) =>
  path.length > 1 &&
  path.slice(0, -1).some((n, i) => [n, path[i + 1]!].sort().join("-") === id);

export const pathLinkIds = (g: NetworkGraph, p: string[]) =>
  pathLinks(g, p).map((l) => l.id);
