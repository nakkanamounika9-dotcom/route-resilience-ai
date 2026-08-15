import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { planRoutes, type AlgorithmName, type PlanResult } from "@/lib/network/engine";
import { defaultConstraints, type Constraints } from "@/lib/network/csp";
import { networkHealth } from "@/lib/network/health";
import {
  defaultTopology,
  linkId,
  makeLink,
  makeNode,
  type NetworkGraph,
  type NodeStatus,
} from "@/lib/network/topology";

export interface LogEntry {
  time: string;
  message: string;
  level: "info" | "warn" | "error" | "success";
}

export const HEAL_STEPS = [
  "Monitor Network",
  "Detect / Predict Failure",
  "Update Network Graph",
  "Generate Candidate Routes",
  "Search (Dijkstra / A* / Beam)",
  "CSP Validation",
  "Route Health Evaluation",
  "Route Diversity Evaluation",
  "Select Best Valid Route",
  "Reroute Traffic",
  "Network Recovered",
] as const;

const stamp = () => new Date().toTimeString().slice(0, 8);

export function useSimulator() {
  const [graph, setGraph] = useState<NetworkGraph>(() => defaultTopology());
  const [source, setSource] = useState("R1");
  const [destination, setDestination] = useState("R10");
  const [algorithm, setAlgorithm] = useState<AlgorithmName>("Dijkstra");
  const [beamWidth, setBeamWidth] = useState(3);
  const [constraints, setConstraints] = useState<Constraints>(defaultConstraints);
  const [logs, setLogs] = useState<LogEntry[]>([
    { time: stamp(), message: "Network monitoring started", level: "info" },
  ]);
  const [healStep, setHealStep] = useState(-1);
  const [healing, setHealing] = useState(false);
  const [autoHeal, setAutoHeal] = useState(true);
  const [activePath, setActivePath] = useState<string[]>([]);
  const [recoveryMs, setRecoveryMs] = useState<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const log = useCallback((message: string, level: LogEntry["level"] = "info") => {
    setLogs((l) => [...l.slice(-199), { time: stamp(), message, level }]);
  }, []);

  const plan: PlanResult = useMemo(
    () => planRoutes(graph, algorithm, source, destination, constraints, beamWidth),
    [graph, algorithm, source, destination, constraints, beamWidth],
  );

  const health = useMemo(() => networkHealth(graph), [graph]);

  // Keep the active (installed) route in sync when it becomes invalid.
  useEffect(() => {
    if (!activePath.length && plan.primary) setActivePath(plan.primary.path);
  }, [plan.primary, activePath.length]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const patchNode = useCallback((id: string, patch: Partial<NetworkGraph["nodes"][number]>) => {
    setGraph((g) => ({
      ...g,
      nodes: g.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    }));
  }, []);

  const patchLink = useCallback((id: string, patch: Partial<NetworkGraph["links"][number]>) => {
    setGraph((g) => ({
      ...g,
      links: g.links.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  }, []);

  const runHealing = useCallback(
    (reason: string) => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setHealing(true);
      setRecoveryMs(null);
      const t0 = Date.now();
      log(reason, "error");
      const messages = [
        "Failure detected by monitoring agent",
        "Network graph updated — failed components removed",
        "Generating alternative candidate routes",
        `${algorithm} search executed`,
        "CSP validating candidate routes",
        "Route health scores computed",
        "Route diversity evaluated",
        "Best valid route selected",
        "Traffic rerouted to backup path",
        "Network recovered",
      ];
      HEAL_STEPS.forEach((_, i) => {
        const t = setTimeout(() => {
          setHealStep(i);
          if (i > 0 && messages[i - 1]) log(messages[i - 1]!, i === HEAL_STEPS.length - 1 ? "success" : "info");
          if (i === HEAL_STEPS.length - 1) {
            setHealing(false);
            setRecoveryMs(Date.now() - t0);
          }
        }, i * 320);
        timers.current.push(t);
      });
    },
    [algorithm, log],
  );

  // Auto self-heal when the installed route breaks.
  useEffect(() => {
    if (!autoHeal || !activePath.length) return;
    const broken =
      activePath.some((id) => graph.nodes.find((n) => n.id === id)?.status === "failed") ||
      activePath
        .slice(0, -1)
        .some(
          (n, i) =>
            graph.links.find((l) => l.id === linkId(n, activePath[i + 1]!))?.status ===
            "failed",
        );
    if (broken) {
      runHealing("Active route is unavailable — self-healing triggered");
      const t = setTimeout(() => {
        setActivePath(plan.primary?.path ?? []);
      }, HEAL_STEPS.length * 320);
      timers.current.push(t);
    }
  }, [graph, activePath, autoHeal, plan.primary, runHealing]);

  const failNode = (id: string) => {
    patchNode(id, { status: "failed" });
    log(`Router ${id} FAILED`, "error");
  };
  const restoreNode = (id: string) => {
    patchNode(id, { status: "healthy", cpu: 30, congestion: 20, packetLoss: 0.3, latencyTrend: "stable" });
    log(`Router ${id} restored`, "success");
  };
  const failLink = (id: string) => {
    patchLink(id, { status: "failed" });
    log(`Link ${id.replace("-", " ↔ ")} FAILED`, "error");
  };
  const restoreLink = (id: string) => {
    patchLink(id, { status: "healthy", congestion: 20, packetLoss: 0.3 });
    log(`Link ${id.replace("-", " ↔ ")} restored`, "success");
  };

  const stressLink = (id: string, kind: "latency" | "congestion" | "loss") => {
    setGraph((g) => ({
      ...g,
      links: g.links.map((l) => {
        if (l.id !== id) return l;
        if (kind === "latency") return { ...l, latency: Math.round(l.latency * 1.6) };
        if (kind === "loss")
          return { ...l, packetLoss: Math.round((l.packetLoss + 2.5) * 10) / 10 };
        const congestion = Math.min(100, l.congestion + 30);
        return {
          ...l,
          congestion,
          status: (congestion > 65 ? "congested" : l.status) as NodeStatus,
        };
      }),
    }));
    log(
      `${kind === "latency" ? "Latency" : kind === "loss" ? "Packet loss" : "Congestion"} increased on ${id.replace("-", " ↔ ")}`,
      "warn",
    );
  };

  const addRouter = () => {
    setGraph((g) => {
      const idx = g.nodes.length + 1;
      let id = `R${idx}`;
      let i = idx;
      while (g.nodes.some((n) => n.id === id)) id = `R${++i}`;
      return {
        ...g,
        nodes: [...g.nodes, makeNode(id, 20 + Math.random() * 60, 15 + Math.random() * 70)],
      };
    });
  };

  const removeRouter = (id: string) => {
    setGraph((g) => ({
      nodes: g.nodes.filter((n) => n.id !== id),
      links: g.links.filter((l) => l.a !== id && l.b !== id),
    }));
    log(`Router ${id} removed from topology`, "warn");
  };

  const addLink = (a: string, b: string, latency = 10, bandwidth = 60) => {
    if (a === b) return;
    setGraph((g) =>
      g.links.some((l) => l.id === linkId(a, b))
        ? g
        : { ...g, links: [...g.links, makeLink(a, b, latency, bandwidth)] },
    );
    log(`Link ${a} ↔ ${b} added`, "success");
  };

  const removeLink = (id: string) => {
    setGraph((g) => ({ ...g, links: g.links.filter((l) => l.id !== id) }));
    log(`Link ${id.replace("-", " ↔ ")} removed`, "warn");
  };

  const applyRoute = () => {
    if (plan.primary) {
      setActivePath(plan.primary.path);
      log(`Traffic installed on ${plan.primary.path.join(" → ")}`, "success");
    }
  };

  const reset = () => {
    timers.current.forEach(clearTimeout);
    setGraph(defaultTopology());
    setActivePath([]);
    setHealStep(-1);
    setHealing(false);
    setRecoveryMs(null);
    log("Topology reset to baseline", "info");
  };

  const runDemo = () => {
    reset();
    const seq: [number, () => void][] = [
      [400, () => { setSource("R1"); setDestination("R10"); log("Demo scenario started: R1 → R10", "info"); }],
      [900, () => { patchNode("R5", { cpu: 88, congestion: 78, packetLoss: 6, latencyTrend: "increasing" }); log("Router R5 health decreased", "warn"); }],
      [1600, () => log("Failure risk on R5: HIGH", "warn")],
      [2200, () => failNode("R5")],
    ];
    seq.forEach(([ms, fn]) => timers.current.push(setTimeout(fn, ms)));
  };

  return {
    graph,
    source,
    destination,
    algorithm,
    beamWidth,
    constraints,
    logs,
    plan,
    health,
    healStep,
    healing,
    autoHeal,
    activePath,
    recoveryMs,
    setSource,
    setDestination,
    setAlgorithm,
    setBeamWidth,
    setConstraints,
    setAutoHeal,
    failNode,
    restoreNode,
    failLink,
    restoreLink,
    stressLink,
    addRouter,
    removeRouter,
    addLink,
    removeLink,
    applyRoute,
    reset,
    runDemo,
    log,
  };
}

export type Simulator = ReturnType<typeof useSimulator>;
