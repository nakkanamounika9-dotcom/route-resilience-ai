import { type NetworkGraph, pathLinks } from "./topology";

export interface Constraints {
  minBandwidth: number;
  maxLatency: number;
  maxHops: number;
  maxPacketLoss: number;
  minReliability: number;
  qos: boolean;
}

export const defaultConstraints: Constraints = {
  minBandwidth: 10,
  maxLatency: 50,
  maxHops: 5,
  maxPacketLoss: 2,
  minReliability: 90,
  qos: true,
};

export interface RouteMetrics {
  bandwidth: number; // bottleneck Mbps
  latency: number; // ms total
  hops: number;
  packetLoss: number; // % aggregate
  reliability: number; // % product
  congestion: number; // avg %
  qosOk: boolean;
}

export function routeMetrics(g: NetworkGraph, path: string[]): RouteMetrics {
  const links = pathLinks(g, path);
  if (!links.length) {
    return {
      bandwidth: 0,
      latency: 0,
      hops: 0,
      packetLoss: 100,
      reliability: 0,
      congestion: 100,
      qosOk: false,
    };
  }
  const bandwidth = Math.min(...links.map((l) => l.bandwidth));
  const latency = links.reduce((s, l) => s + l.latency * (1 + l.congestion / 200), 0);
  const survive = links.reduce((s, l) => s * (1 - l.packetLoss / 100), 1);
  const packetLoss = (1 - survive) * 100;
  const reliability = links.reduce((s, l) => s * (l.reliability / 100), 1) * 100;
  const congestion = links.reduce((s, l) => s + l.congestion, 0) / links.length;
  return {
    bandwidth,
    latency: round(latency),
    hops: links.length,
    packetLoss: round(packetLoss),
    reliability: round(reliability),
    congestion: round(congestion),
    qosOk: congestion < 70 && bandwidth >= 20,
  };
}

export interface CSPResult {
  path: string[];
  metrics: RouteMetrics;
  valid: boolean;
  violations: string[];
}

export function checkConstraints(
  g: NetworkGraph,
  path: string[],
  c: Constraints,
): CSPResult {
  const m = routeMetrics(g, path);
  const violations: string[] = [];
  if (!path.length) violations.push("No path available");
  if (m.bandwidth < c.minBandwidth)
    violations.push(
      `Insufficient bandwidth (${m.bandwidth} Mbps < ${c.minBandwidth} Mbps)`,
    );
  if (m.latency > c.maxLatency)
    violations.push(`Latency too high (${m.latency} ms > ${c.maxLatency} ms)`);
  if (m.hops > c.maxHops) violations.push(`Too many hops (${m.hops} > ${c.maxHops})`);
  if (m.packetLoss > c.maxPacketLoss)
    violations.push(
      `Packet loss too high (${m.packetLoss}% > ${c.maxPacketLoss}%)`,
    );
  if (m.reliability < c.minReliability)
    violations.push(
      `Reliability too low (${m.reliability}% < ${c.minReliability}%)`,
    );
  if (c.qos && !m.qosOk) violations.push("QoS requirement not met (congestion/bandwidth)");
  return { path, metrics: m, valid: violations.length === 0, violations };
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}
