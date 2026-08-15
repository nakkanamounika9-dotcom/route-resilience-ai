import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  GitBranch,
  Home,
  ListChecks,
  Network,
  ShieldAlert,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSimulator } from "@/hooks/useSimulator";
import { NetworkGraphView } from "@/components/network/NetworkGraphView";
import {
  AlgorithmPanel,
  ConstraintsPanel,
  FailurePanel,
  HealthPanel,
  PerformancePanel,
  RoutingSummary,
  SelfHealingPanel,
  TopologyPanel,
} from "@/components/network/panels";
import { routeLabel } from "@/lib/network/engine";

export const Route = createFileRoute("/simulator")({
  head: () => ({
    meta: [
      { title: "Network Simulator — Self-Healing Route Planner" },
      {
        name: "description",
        content:
          "Interactive NOC dashboard: simulate router and link failures, run Dijkstra, A* and Beam Search, validate routes with CSP and watch automatic self-healing.",
      },
      { property: "og:title", content: "Network Simulator — Self-Healing Route Planner" },
      {
        property: "og:description",
        content:
          "Simulate failures, compare routing algorithms, validate constraints and observe automatic network recovery.",
      },
    ],
  }),
  component: SimulatorPage,
});

const SECTIONS = [
  { id: "topology", label: "Network Topology", icon: Network },
  { id: "algorithms", label: "Routing Algorithms", icon: Waypoints },
  { id: "constraints", label: "Constraints", icon: ListChecks },
  { id: "failure", label: "Failure Simulation", icon: ShieldAlert },
  { id: "health", label: "Network Health", icon: Activity },
  { id: "performance", label: "Performance", icon: BarChart3 },
  { id: "healing", label: "Self-Healing Logs", icon: Sparkles },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const LEGEND = [
  ["Healthy", "bg-healthy"],
  ["Warning", "bg-warning"],
  ["Congested", "bg-congested"],
  ["Failed", "bg-failed"],
  ["Active route", "bg-active-route"],
  ["Backup route", "bg-backup-route"],
] as const;

function SimulatorPage() {
  const sim = useSimulator();
  const [section, setSection] = useState<SectionId>("topology");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<string | null>(null);

  const stateColor =
    sim.health.state === "Healthy"
      ? "text-healthy"
      : sim.health.state === "Warning"
        ? "text-warning"
        : sim.health.state === "Critical"
          ? "text-congested"
          : "text-failed";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-3">
          <GitBranch className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-sm font-semibold">AI-Driven Self-Healing Network Route Planner</h1>
            <p className="text-[11px] text-muted-foreground">Network Operations Console</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="font-mono">
            {sim.source} → {sim.destination}
          </span>
          <span className={cn("font-mono font-semibold", stateColor)}>
            HEALTH {sim.health.score} · {sim.health.state.toUpperCase()}
          </span>
          <Link to="/" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <Home className="h-3.5 w-3.5" /> Home
          </Link>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <aside className="border-b border-border bg-sidebar p-2 lg:w-56 lg:border-r lg:border-b-0">
          <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors",
                  section === s.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50",
                )}
              >
                <s.icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex flex-1 flex-col gap-3 p-3 xl:flex-row">
          <section className="flex min-h-[420px] flex-1 flex-col">
            <div className="panel grid-backdrop relative flex-1 overflow-hidden">
              <div className="absolute inset-0">
                <NetworkGraphView
                  graph={sim.graph}
                  activePath={sim.activePath}
                  backupPaths={sim.plan.backups.map((b) => b.path)}
                  source={sim.source}
                  destination={sim.destination}
                  selectedNode={selectedNode}
                  selectedLink={selectedLink}
                  onNodeClick={(id) => {
                    setSelectedNode(id);
                    setSelectedLink(null);
                    setSection("failure");
                  }}
                  onLinkClick={(id) => {
                    setSelectedLink(id);
                    setSelectedNode(null);
                    setSection("failure");
                  }}
                />
              </div>
              <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap gap-2 rounded bg-background/70 px-2 py-1 text-[10px] backdrop-blur">
                {LEGEND.map(([label, dot]) => (
                  <span key={label} className="flex items-center gap-1 text-muted-foreground">
                    <span className={cn("h-2 w-2 rounded-full", dot)} />
                    {label}
                  </span>
                ))}
              </div>
              {sim.healing && (
                <div className="pointer-events-none absolute top-2 right-2 rounded bg-failed/15 px-2 py-1 font-mono text-[11px] text-failed">
                  SELF-HEALING IN PROGRESS…
                </div>
              )}
            </div>
            <div className="panel mt-3 grid grid-cols-2 gap-3 p-3 text-[11px] md:grid-cols-4">
              <Stat label="Algorithm" value={sim.algorithm} />
              <Stat label="Candidate routes" value={String(sim.plan.candidateCount)} />
              <Stat label="Valid / rejected" value={`${sim.plan.ranked.length} / ${sim.plan.rejected.length}`} />
              <Stat label="Primary route" value={routeLabel(sim.plan.primary?.path ?? [])} mono />
            </div>
          </section>

          <section className="panel w-full overflow-y-auto p-4 xl:w-[26rem]">
            {section === "topology" && <TopologyPanel sim={sim} />}
            {section === "algorithms" && <AlgorithmPanel sim={sim} />}
            {section === "constraints" && <ConstraintsPanel sim={sim} />}
            {section === "failure" && (
              <FailurePanel sim={sim} selectedNode={selectedNode} selectedLink={selectedLink} />
            )}
            {section === "health" && <HealthPanel sim={sim} />}
            {section === "performance" && <PerformancePanel sim={sim} />}
            {section === "healing" && <SelfHealingPanel sim={sim} />}
          </section>

          <section className="w-full xl:w-80">
            <RoutingSummary sim={sim} />
          </section>
        </main>
      </div>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 truncate text-sm", mono && "font-mono text-active-route")}>{value}</div>
    </div>
  );
}
