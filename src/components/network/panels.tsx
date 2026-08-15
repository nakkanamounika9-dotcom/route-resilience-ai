import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Simulator } from "@/hooks/useSimulator";
import { HEAL_STEPS } from "@/hooks/useSimulator";
import { comparisonRun, routeLabel, type AlgorithmName } from "@/lib/network/engine";
import { failurePrediction } from "@/lib/network/health";

export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold tracking-wide uppercase text-foreground">{title}</h2>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function StatusBadge({ ok, labelOk = "VALID", labelNo = "INVALID" }: { ok: boolean; labelOk?: string; labelNo?: string }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold",
        ok ? "bg-healthy/15 text-healthy" : "bg-failed/15 text-failed",
      )}
    >
      {ok ? labelOk : labelNo}
    </span>
  );
}

/* ---------------- Topology ---------------- */
export function TopologyPanel({ sim }: { sim: Simulator }) {
  const [a, setA] = useState("R1");
  const [b, setB] = useState("R4");
  const ids = sim.graph.nodes.map((n) => n.id);

  return (
    <div className="space-y-4">
      <SectionTitle title="Network Topology" hint="Add or remove routers and links. Click graph elements to inspect." />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs text-muted-foreground">Source</Label>
          <Select value={sim.source} onValueChange={sim.setSource}>
            <SelectTrigger className="mt-1 h-8 font-mono text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{ids.map((i) => <SelectItem key={i} value={i} className="font-mono text-xs">{i}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Destination</Label>
          <Select value={sim.destination} onValueChange={sim.setDestination}>
            <SelectTrigger className="mt-1 h-8 font-mono text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{ids.map((i) => <SelectItem key={i} value={i} className="font-mono text-xs">{i}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <Separator />
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={sim.addRouter}>Add router</Button>
        <Button size="sm" variant="secondary" onClick={sim.reset}>Reset topology</Button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Add link</Label>
        <div className="flex items-center gap-2">
          <Select value={a} onValueChange={setA}>
            <SelectTrigger className="h-8 w-24 font-mono text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{ids.map((i) => <SelectItem key={i} value={i} className="font-mono text-xs">{i}</SelectItem>)}</SelectContent>
          </Select>
          <span className="text-muted-foreground">↔</span>
          <Select value={b} onValueChange={setB}>
            <SelectTrigger className="h-8 w-24 font-mono text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{ids.map((i) => <SelectItem key={i} value={i} className="font-mono text-xs">{i}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" onClick={() => sim.addLink(a, b)}>Add</Button>
        </div>
      </div>

      <Separator />
      <ScrollArea className="h-56 rounded border border-border">
        <table className="w-full text-xs">
          <tbody>
            {sim.graph.links.map((l) => (
              <tr key={l.id} className="border-b border-border/60 last:border-0">
                <td className="px-2 py-1.5 font-mono">{l.a} ↔ {l.b}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{l.latency}ms · {l.bandwidth}Mbps</td>
                <td className="px-2 py-1.5 text-right">
                  <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => sim.removeLink(l.id)}>Remove</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>

      <div className="flex flex-wrap gap-1.5">
        {sim.graph.nodes.map((n) => (
          <Button key={n.id} size="sm" variant="ghost" className="h-7 font-mono text-[11px]" onClick={() => sim.removeRouter(n.id)}>
            − {n.id}
          </Button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Algorithms ---------------- */
const ALGO_INFO: Record<AlgorithmName, string> = {
  Dijkstra: "Baseline shortest/lowest-cost route finder.",
  "A*": "Goal-directed heuristic search using actual cost g(n) and estimated remaining cost h(n).",
  "Beam Search": "Maintains multiple promising route candidates for faster recovery.",
};

export function AlgorithmPanel({ sim }: { sim: Simulator }) {
  const [compare, setCompare] = useState(false);
  const rows = compare
    ? comparisonRun(sim.graph, sim.source, sim.destination, sim.constraints, sim.beamWidth)
    : [];
  const r = sim.plan.algoResult;

  return (
    <div className="space-y-4">
      <SectionTitle title="Routing Algorithms" hint="All algorithms operate on the same weighted graph." />
      <div className="space-y-2">
        {(Object.keys(ALGO_INFO) as AlgorithmName[]).map((a) => (
          <button
            key={a}
            onClick={() => sim.setAlgorithm(a)}
            className={cn(
              "w-full rounded-md border p-3 text-left transition-colors",
              sim.algorithm === a ? "border-primary bg-primary/10" : "border-border hover:bg-accent/40",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{a}</span>
              {sim.algorithm === a && <Badge variant="secondary" className="text-[10px]">ACTIVE</Badge>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{ALGO_INFO[a]}</p>
          </button>
        ))}
      </div>

      {sim.algorithm === "Beam Search" && (
        <div>
          <Label className="text-xs text-muted-foreground">Beam width — keeps only the K most promising candidates per stage</Label>
          <div className="mt-2 flex gap-2">
            {[2, 3, 4, 5].map((w) => (
              <Button key={w} size="sm" variant={sim.beamWidth === w ? "default" : "secondary"} onClick={() => sim.setBeamWidth(w)}>
                {w}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-md border border-border p-3 text-xs">
        <div className="mb-2 font-medium">{r.algorithm} result</div>
        <dl className="grid grid-cols-2 gap-y-1.5 font-mono text-[11px]">
          <dt className="text-muted-foreground">Route</dt><dd className="text-right">{routeLabel(r.path)}</dd>
          <dt className="text-muted-foreground">Cost</dt><dd className="text-right">{Number.isFinite(r.cost) ? r.cost.toFixed(1) : "∞"}</dd>
          <dt className="text-muted-foreground">Nodes explored</dt><dd className="text-right">{r.nodesExplored}</dd>
          <dt className="text-muted-foreground">Execution time</dt><dd className="text-right">{r.timeMs.toFixed(3)} ms</dd>
          <dt className="text-muted-foreground">Candidates</dt><dd className="text-right">{r.candidates.length}</dd>
        </dl>
      </div>

      {sim.algorithm === "A*" && r.trace.length > 0 && (
        <div>
          <Label className="text-xs text-muted-foreground">A* expansion — f(n) = g(n) + h(n)</Label>
          <ScrollArea className="mt-2 h-40 rounded border border-border">
            <Table>
              <TableHeader>
                <TableRow><TableHead className="h-7 text-[11px]">Node</TableHead><TableHead className="h-7 text-[11px]">g(n)</TableHead><TableHead className="h-7 text-[11px]">h(n)</TableHead><TableHead className="h-7 text-[11px]">f(n)</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {r.trace.map((t, i) => (
                  <TableRow key={i}>
                    <TableCell className="py-1 font-mono text-[11px]">{t.node}</TableCell>
                    <TableCell className="py-1 font-mono text-[11px]">{t.g.toFixed(1)}</TableCell>
                    <TableCell className="py-1 font-mono text-[11px]">{t.h.toFixed(1)}</TableCell>
                    <TableCell className="py-1 font-mono text-[11px]">{t.f.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      )}

      {sim.algorithm === "Beam Search" && (
        <div>
          <Label className="text-xs text-muted-foreground">
            Beam candidates (width {sim.beamWidth}) — retained {r.candidates.filter((c) => c.kept).length}, discarded {r.candidates.filter((c) => !c.kept).length}
          </Label>
          <div className="mt-2 space-y-1">
            {r.candidates.map((c, i) => (
              <div key={i} className="flex items-center justify-between rounded border border-border px-2 py-1 text-[11px]">
                <span className="font-mono">{routeLabel(c.path)}</span>
                <span className="text-muted-foreground">score {c.score.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Separator />
      <Button size="sm" variant={compare ? "default" : "secondary"} onClick={() => setCompare((c) => !c)}>
        Compare algorithms
      </Button>
      {compare && (
        <div className="space-y-1">
          {rows.map((row) => (
            <div key={row.algorithm} className="rounded border border-border p-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="font-medium">{row.algorithm}</span>
                <StatusBadge ok={row.valid} />
              </div>
              <div className="mt-1 font-mono text-muted-foreground">{routeLabel(row.path)}</div>
              <div className="mt-1 grid grid-cols-2 gap-x-3 font-mono text-muted-foreground">
                <span>cost {row.cost}</span>
                <span>{row.timeMs} ms</span>
                <span>{row.nodesExplored} explored</span>
                <span>{row.candidates} candidates</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Constraints ---------------- */
export function ConstraintsPanel({ sim }: { sim: Simulator }) {
  const c = sim.constraints;
  const set = (patch: Partial<typeof c>) => sim.setConstraints({ ...c, ...patch });
  const fields: [string, keyof typeof c, string][] = [
    ["Minimum bandwidth", "minBandwidth", "Mbps"],
    ["Maximum latency", "maxLatency", "ms"],
    ["Maximum hop count", "maxHops", "hops"],
    ["Maximum packet loss", "maxPacketLoss", "%"],
    ["Minimum reliability", "minReliability", "%"],
  ];

  return (
    <div className="space-y-4">
      <SectionTitle title="Constraint Satisfaction (CSP)" hint="Every candidate route is validated against these constraints." />
      {fields.map(([label, key, unit]) => (
        <div key={key} className="flex items-center justify-between gap-3">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              className="h-8 w-20 font-mono text-xs"
              value={c[key] as number}
              onChange={(e) => set({ [key]: Number(e.target.value) } as Partial<typeof c>)}
            />
            <span className="w-10 text-[11px] text-muted-foreground">{unit}</span>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">QoS requirement</Label>
        <Switch checked={c.qos} onCheckedChange={(v) => set({ qos: v })} />
      </div>

      <Separator />
      <SectionTitle title="CSP evaluation" />
      <ScrollArea className="h-80">
        <div className="space-y-2 pr-2">
          {[...sim.plan.ranked, ...sim.plan.rejected].map((r, i) => (
            <div key={i} className={cn("rounded border p-2 text-[11px]", r.valid ? "border-healthy/40" : "border-failed/40")}>
              <div className="flex items-center justify-between">
                <span className="font-mono">{routeLabel(r.path)}</span>
                <StatusBadge ok={r.valid} />
              </div>
              <div className="mt-1 grid grid-cols-3 gap-x-2 font-mono text-muted-foreground">
                <span>BW {r.metrics.bandwidth}</span>
                <span>Lat {r.metrics.latency}ms</span>
                <span>Hops {r.metrics.hops}</span>
                <span>Loss {r.metrics.packetLoss}%</span>
                <span>Rel {r.metrics.reliability}%</span>
                <span>QoS {r.metrics.qosOk ? "OK" : "FAIL"}</span>
              </div>
              {!r.valid && (
                <ul className="mt-1 list-disc pl-4 text-failed">
                  {r.violations.map((v, j) => <li key={j}>{v}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ---------------- Failure simulation ---------------- */
export function FailurePanel({ sim, selectedNode, selectedLink }: { sim: Simulator; selectedNode: string | null; selectedLink: string | null }) {
  const node = sim.graph.nodes.find((n) => n.id === selectedNode);
  const link = sim.graph.links.find((l) => l.id === selectedLink);

  return (
    <div className="space-y-4">
      <SectionTitle title="Failure Simulation" hint="Select a router or link on the graph, then inject a fault." />
      <div className="rounded border border-border p-2 text-xs">
        <div>Selected router: <span className="font-mono text-primary">{node?.id ?? "none"}</span></div>
        <div>Selected link: <span className="font-mono text-primary">{link ? `${link.a} ↔ ${link.b}` : "none"}</span></div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="destructive" disabled={!node} onClick={() => node && sim.failNode(node.id)}>Fail router</Button>
        <Button size="sm" variant="destructive" disabled={!link} onClick={() => link && sim.failLink(link.id)}>Fail link</Button>
        <Button size="sm" variant="secondary" disabled={!link} onClick={() => link && sim.stressLink(link.id, "latency")}>Increase latency</Button>
        <Button size="sm" variant="secondary" disabled={!link} onClick={() => link && sim.stressLink(link.id, "congestion")}>Increase congestion</Button>
        <Button size="sm" variant="secondary" disabled={!link} onClick={() => link && sim.stressLink(link.id, "loss")}>Increase packet loss</Button>
        <Button size="sm" variant="secondary" disabled={!node} onClick={() => node && sim.restoreNode(node.id)}>Restore router</Button>
        <Button size="sm" variant="secondary" disabled={!link} onClick={() => link && sim.restoreLink(link.id)}>Restore link</Button>
        <Button size="sm" variant="secondary" onClick={sim.reset}>Reset network</Button>
      </div>

      <Separator />
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Automatic self-healing</Label>
        <Switch checked={sim.autoHeal} onCheckedChange={sim.setAutoHeal} />
      </div>
      <Button size="sm" className="w-full" onClick={sim.runDemo}>Run R5 failure demo scenario</Button>
    </div>
  );
}

/* ---------------- Health + prediction ---------------- */
export function HealthPanel({ sim }: { sim: Simulator }) {
  const h = sim.health;
  const stateColor =
    h.state === "Healthy" ? "text-healthy" : h.state === "Warning" ? "text-warning" : h.state === "Critical" ? "text-congested" : "text-failed";

  const factors: [string, number][] = [
    ["Latency", h.factors.latency],
    ["Congestion", h.factors.congestion],
    ["Reliability", h.factors.reliability],
    ["Packet loss", h.factors.packetLoss],
    ["Link utilization", h.factors.utilization],
    ["Failure risk", h.factors.failureRisk],
  ];

  return (
    <div className="space-y-4">
      <SectionTitle title="Network Health Score" hint="90-100 Healthy · 70-89 Warning · 40-69 Critical · 0-39 Severe" />
      <div className="rounded-lg border border-border p-4 text-center">
        <div className={cn("font-mono text-4xl font-bold", stateColor)}>{h.score}<span className="text-lg text-muted-foreground"> / 100</span></div>
        <div className={cn("mt-1 text-xs font-semibold uppercase tracking-widest", stateColor)}>{h.state}</div>
        <Progress value={h.score} className="mt-3 h-2" />
      </div>
      <div className="space-y-2">
        {factors.map(([label, v]) => (
          <div key={label}>
            <div className="flex justify-between text-[11px]"><span className="text-muted-foreground">{label}</span><span className="font-mono">{v}%</span></div>
            <Progress value={v} className="mt-1 h-1.5" />
          </div>
        ))}
      </div>

      <Separator />
      <SectionTitle title="Failure Prediction" hint="Predicted risk from telemetry vs. actual failure state." />
      <ScrollArea className="h-72">
        <div className="space-y-2 pr-2">
          {sim.graph.nodes.map((n) => {
            const p = failurePrediction(n);
            const color = p.level === "HIGH" ? "text-failed" : p.level === "MEDIUM" ? "text-warning" : "text-healthy";
            return (
              <div key={n.id} className="rounded border border-border p-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-medium">{n.id}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("font-mono font-semibold", color)}>RISK {p.level}</span>
                    <StatusBadge ok={n.status !== "failed"} labelOk="ONLINE" labelNo="FAILED" />
                  </div>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-x-2 font-mono text-muted-foreground">
                  <span>CPU/Load {n.cpu}%</span>
                  <span>Loss {n.packetLoss}%</span>
                  <span>Congestion {n.congestion}%</span>
                  <span>Latency {n.latencyTrend}</span>
                </div>
                <p className="mt-1 text-muted-foreground">{p.message}</p>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ---------------- Performance ---------------- */
export function PerformancePanel({ sim }: { sim: Simulator }) {
  const rows = comparisonRun(sim.graph, sim.source, sim.destination, sim.constraints, sim.beamWidth);
  const chart = rows.map((r) => ({
    name: r.algorithm,
    time: Number((r.timeMs * 1000).toFixed(0)),
    explored: r.nodesExplored,
    cost: Number.isFinite(r.cost) ? r.cost : 0,
    effort: r.searchEffort,
  }));

  return (
    <div className="space-y-4">
      <SectionTitle title="Performance Comparison" hint="Same graph, same source/destination — fair comparison." />
      <div className="rounded border border-border p-2">
        <div className="mb-2 text-[11px] text-muted-foreground">Execution time (µs) vs nodes explored</div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
              <RTooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="time" name="Time (µs)" fill="var(--chart-1)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="explored" name="Nodes explored" fill="var(--chart-2)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded border border-border p-2">
        <div className="mb-2 text-[11px] text-muted-foreground">Route cost & search effort</div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
              <RTooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", fontSize: 11 }} />
              <Bar dataKey="cost" name="Route cost" radius={[2, 2, 0, 0]}>
                {chart.map((_, i) => <Cell key={i} fill="var(--chart-3)" />)}
              </Bar>
              <Bar dataKey="effort" name="Search effort" fill="var(--chart-4)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[11px]">Algorithm</TableHead>
            <TableHead className="text-[11px]">Route</TableHead>
            <TableHead className="text-[11px]">Cost</TableHead>
            <TableHead className="text-[11px]">CSP</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.algorithm}>
              <TableCell className="py-1.5 text-[11px]">{r.algorithm}</TableCell>
              <TableCell className="py-1.5 font-mono text-[11px]">{routeLabel(r.path)}</TableCell>
              <TableCell className="py-1.5 font-mono text-[11px]">{Number.isFinite(r.cost) ? r.cost : "∞"}</TableCell>
              <TableCell className="py-1.5"><StatusBadge ok={r.valid} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded border border-border p-2">
          <div className="text-muted-foreground">Last recovery time</div>
          <div className="font-mono text-lg">{sim.recoveryMs ? `${sim.recoveryMs} ms` : "—"}</div>
        </div>
        <div className="rounded border border-border p-2">
          <div className="text-muted-foreground">Constraint success rate</div>
          <div className="font-mono text-lg">
            {sim.plan.ranked.length + sim.plan.rejected.length > 0
              ? Math.round((sim.plan.ranked.length / (sim.plan.ranked.length + sim.plan.rejected.length)) * 100)
              : 0}
            %
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Self-healing + logs ---------------- */
export function SelfHealingPanel({ sim }: { sim: Simulator }) {
  return (
    <div className="space-y-4">
      <SectionTitle title="Self-Healing Engine" hint="Monitor → detect → re-plan → validate → reroute." />
      <ol className="space-y-1">
        {HEAL_STEPS.map((s, i) => {
          const done = sim.healStep >= i;
          const active = sim.healStep === i && sim.healing;
          return (
            <li
              key={s}
              className={cn(
                "flex items-center gap-2 rounded border px-2 py-1.5 text-[11px] transition-colors",
                active ? "border-primary bg-primary/10" : done ? "border-healthy/40 text-healthy" : "border-border text-muted-foreground",
              )}
            >
              <span className="font-mono">{String(i + 1).padStart(2, "0")}</span>
              <span>{s}</span>
            </li>
          );
        })}
      </ol>

      <Separator />
      <SectionTitle title="Event Log" />
      <ScrollArea className="h-72 rounded border border-border bg-background/40 p-2">
        <div className="space-y-0.5 font-mono text-[11px]">
          {sim.logs.map((l, i) => (
            <div
              key={i}
              className={cn(
                l.level === "error" && "text-failed",
                l.level === "warn" && "text-warning",
                l.level === "success" && "text-healthy",
                l.level === "info" && "text-muted-foreground",
              )}
            >
              [{l.time}] {l.message}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ---------------- Route ranking / diversity (right column) ---------------- */
export function RoutingSummary({ sim }: { sim: Simulator }) {
  const { plan } = sim;
  return (
    <div className="space-y-4">
      <div className="panel p-3">
        <SectionTitle title="Active Route" />
        <div className="font-mono text-sm text-active-route">{routeLabel(sim.activePath)}</div>
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={sim.applyRoute}>Install best route</Button>
        </div>
      </div>

      <div className="panel p-3">
        <SectionTitle title="Route Ranking" hint="Valid routes ranked by health, cost, risk and diversity." />
        <div className="space-y-1.5">
          {plan.ranked.slice(0, 5).map((r, i) => (
            <div
              key={i}
              className={cn(
                "rounded border p-2 text-[11px]",
                i === 0 ? "border-active-route bg-active-route/10" : "border-border",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono">{i + 1}. {routeLabel(r.path)}</span>
                <span className="font-mono font-semibold">{r.score}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-muted-foreground">
                <span>cost {r.cost}</span>
                <span>risk {r.riskScore}</span>
                <span>div {r.diversity.score}</span>
              </div>
            </div>
          ))}
          {!plan.ranked.length && <p className="text-[11px] text-failed">No valid route satisfies the current constraints.</p>}
        </div>
      </div>

      <div className="panel p-3">
        <SectionTitle title="Route Diversity" hint="Backups sharing routers/links with the primary are penalised." />
        <div className="space-y-1.5">
          {plan.backups.map((b, i) => (
            <div key={i} className="rounded border border-backup-route/40 p-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-backup-route">{routeLabel(b.path)}</span>
                <span className="font-mono">div {b.diversity.score}</span>
              </div>
              <div className="mt-1 text-muted-foreground">
                Shared nodes: {b.diversity.sharedNodes.join(", ") || "none"} · Shared links: {b.diversity.sharedLinks.join(", ") || "none"}
              </div>
            </div>
          ))}
          {!plan.backups.length && <p className="text-[11px] text-muted-foreground">No backup routes available.</p>}
        </div>
      </div>
    </div>
  );
}
