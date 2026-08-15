import { type NetworkGraph, type RouterNode, isLinkUsable } from "./topology";

export interface HealthFactors {
  latency: number;
  congestion: number;
  reliability: number;
  packetLoss: number;
  utilization: number;
  failureRisk: number;
}

export interface NetworkHealth {
  score: number;
  state: "Healthy" | "Warning" | "Critical" | "Severe";
  factors: HealthFactors;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function networkHealth(g: NetworkGraph): NetworkHealth {
  const active = g.links.filter((l) => isLinkUsable(g, l));
  const failedLinks = g.links.length - active.length;
  const failedNodes = g.nodes.filter((n) => n.status === "failed").length;

  const avg = (f: (x: (typeof active)[number]) => number) =>
    active.length ? active.reduce((s, l) => s + f(l), 0) / active.length : 0;

  const latency = clamp(100 - avg((l) => l.latency) * 3.2);
  const congestion = clamp(100 - avg((l) => l.congestion));
  const reliability = clamp(avg((l) => l.reliability));
  const packetLoss = clamp(100 - avg((l) => l.packetLoss) * 12);
  const utilization = clamp(100 - avg((l) => l.congestion) * 0.8 - failedLinks * 4);
  const risks = g.nodes.map((n) => failurePrediction(n).risk);
  const failureRisk = clamp(risks.reduce((s, r) => s + r, 0) / (risks.length || 1));

  const raw =
    latency * 0.2 +
    congestion * 0.2 +
    reliability * 0.2 +
    packetLoss * 0.15 +
    utilization * 0.1 +
    (100 - failureRisk) * 0.15 -
    failedNodes * 5 -
    failedLinks * 2;

  const score = clamp(raw);
  const state =
    score >= 90 ? "Healthy" : score >= 70 ? "Warning" : score >= 40 ? "Critical" : "Severe";

  return {
    score,
    state,
    factors: { latency, congestion, reliability, packetLoss, utilization, failureRisk },
  };
}

export interface Prediction {
  risk: number; // 0..100
  level: "LOW" | "MEDIUM" | "HIGH";
  message: string;
}

/** Simulated failure-prediction model over router telemetry. */
export function failurePrediction(n: RouterNode): Prediction {
  if (n.status === "failed")
    return { risk: 100, level: "HIGH", message: `${n.id} has failed.` };
  const risk = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        n.cpu * 0.35 +
          n.congestion * 0.35 +
          n.packetLoss * 6 +
          (n.latencyTrend === "increasing" ? 15 : 0),
      ),
    ),
  );
  const level = risk >= 70 ? "HIGH" : risk >= 45 ? "MEDIUM" : "LOW";
  const message =
    level === "HIGH"
      ? `${n.id} may become unstable.`
      : level === "MEDIUM"
        ? `${n.id} is under elevated load.`
        : `${n.id} operating normally.`;
  return { risk, level, message };
}
