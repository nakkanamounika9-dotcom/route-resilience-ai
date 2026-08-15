import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  GitBranch,
  Layers,
  Radar,
  ShieldCheck,
  Split,
  Waypoints,
} from "lucide-react";
import { defaultTopology } from "@/lib/network/topology";
import { NetworkGraphView } from "@/components/network/NetworkGraphView";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI-Driven Self-Healing Network Route Planner" },
      {
        name: "description",
        content:
          "Intelligent routing, predictive failure detection and automatic network recovery — Dijkstra, A*, Beam Search, CSP validation and self-healing in one simulator.",
      },
      { property: "og:title", content: "AI-Driven Self-Healing Network Route Planner" },
      {
        property: "og:description",
        content:
          "Interactive network simulator demonstrating intelligent routing, failure prediction and automatic recovery.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Waypoints, title: "Dijkstra Baseline Routing", text: "Lowest-cost baseline path over the weighted network graph." },
  { icon: BrainCircuit, title: "A* Heuristic Search", text: "Goal-directed search using f(n) = g(n) + h(n)." },
  { icon: Layers, title: "Beam Search", text: "Keeps the K most promising candidates for fast backup generation." },
  { icon: ShieldCheck, title: "Constraint Satisfaction", text: "Bandwidth, latency, hops, packet loss, reliability and QoS." },
  { icon: Activity, title: "Network Health Score", text: "0-100 score from latency, congestion, loss and risk factors." },
  { icon: Radar, title: "Failure Prediction", text: "Telemetry-driven risk scoring before components fully fail." },
  { icon: Split, title: "Route Diversity", text: "Penalises backups sharing critical routers or links." },
  { icon: GitBranch, title: "Automatic Self-Healing", text: "Detect, re-plan, validate and reroute with minimal downtime." },
];

function Landing() {
  const demoGraph = defaultTopology();

  return (
    <div className="min-h-screen bg-background">
      <div style={{ backgroundImage: "var(--gradient-noc)" }}>
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold">Self-Healing Route Planner</span>
          </div>
          <Link
            to="/simulator"
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Open console
          </Link>
        </header>

        <section className="mx-auto grid max-w-6xl gap-10 px-6 pt-10 pb-20 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 font-mono text-[11px] text-primary">
              NETWORK OPERATIONS · AI ROUTING
            </span>
            <h1 className="mt-5 text-4xl leading-tight font-bold tracking-tight md:text-5xl">
              AI-Driven Self-Healing Network Route Planner
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Intelligent routing, predictive failure detection, and automatic network recovery.
            </p>
            <p className="mt-4 max-w-xl text-sm text-muted-foreground">
              The network is modelled as a weighted graph. Dijkstra provides the baseline route, A* adds
              heuristic goal-direction, and Beam Search keeps several promising backups alive. Every candidate is
              validated by a Constraint Satisfaction module, scored by network health and route diversity, and
              installed automatically when a router or link fails — so traffic recovers with minimal disruption.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/simulator"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
                style={{ boxShadow: "var(--glow-primary)" }}
              >
                Launch Network Simulator <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center rounded-md border border-border px-5 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Explore capabilities
              </a>
            </div>
          </div>

          <div className="panel grid-backdrop h-[360px] overflow-hidden p-2">
            <NetworkGraphView
              graph={demoGraph}
              activePath={["R1", "R2", "R5", "R8", "R10"]}
              backupPaths={[["R1", "R3", "R6", "R9", "R10"]]}
              source="R1"
              destination="R10"
            />
          </div>
        </section>
      </div>

      <section id="features" className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="text-xl font-semibold">Core modules</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each module is independent and operates on the same shared network graph for fair comparison.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="panel p-4 transition-colors hover:border-primary/50">
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-xs text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Network simulation platform for demonstrating intelligent, self-healing routing.
      </footer>
    </div>
  );
}
