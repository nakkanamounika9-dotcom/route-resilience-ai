import { type NetworkGraph, linkId, pathLinks } from "./topology";

export interface Diversity {
  score: number; // 0..100 (100 = fully disjoint)
  sharedNodes: string[];
  sharedLinks: string[];
}

export function routeDiversity(
  g: NetworkGraph,
  primary: string[],
  backup: string[],
): Diversity {
  if (!primary.length || !backup.length)
    return { score: 100, sharedNodes: [], sharedLinks: [] };

  const interiorA = primary.slice(1, -1);
  const interiorB = backup.slice(1, -1);
  const sharedNodes = interiorA.filter((n) => interiorB.includes(n));

  const la = pathLinks(g, primary).map((l) => l.id);
  const lb = pathLinks(g, backup).map((l) => l.id);
  const sharedLinks = la.filter((id) => lb.includes(id));

  const nodePenalty = interiorB.length ? (sharedNodes.length / interiorB.length) * 60 : 0;
  const linkPenalty = lb.length ? (sharedLinks.length / lb.length) * 40 : 0;
  return {
    score: Math.max(0, Math.round(100 - nodePenalty - linkPenalty)),
    sharedNodes,
    sharedLinks: sharedLinks.map((id) => id.replace("-", " ↔ ")),
  };
}

export const prettyLink = (a: string, b: string) => linkId(a, b).replace("-", " ↔ ");
