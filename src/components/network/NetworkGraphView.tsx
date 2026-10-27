import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { failurePrediction } from "@/lib/network/health";
import type { NetworkGraph } from "@/lib/network/topology";
import { pathLinkIds } from "@/lib/network/engine";

interface Props {
  graph: NetworkGraph;
  activePath: string[];
  backupPaths: string[][];
  source: string;
  destination: string;
  selectedNode?: string | null;
  selectedLink?: string | null;
  onNodeClick?: (id: string) => void;
  onLinkClick?: (id: string) => void;
  /** Survivability overlay: disjoint path pairs drawn as dashed polylines. */
  overlayPaths?: string[][];
  /** Articulation points (routers whose removal disconnects the graph). */
  criticalNodes?: string[];
  /** Bridges (links whose removal disconnects the graph). */
  criticalLinks?: string[];
}

const nodeColor = (status: string) =>
  status === "failed"
    ? "var(--failed)"
    : status === "congested"
      ? "var(--congested)"
      : status === "warning"
        ? "var(--warning)"
        : "var(--healthy)";

export function NetworkGraphView({
  graph,
  activePath,
  backupPaths,
  source,
  destination,
  selectedNode,
  selectedLink,
  onNodeClick,
  onLinkClick,
  overlayPaths = [],
  criticalNodes = [],
  criticalLinks = [],
}: Props) {
  const activeLinks = useMemo(() => new Set(pathLinkIds(graph, activePath)), [graph, activePath]);
  const backupLinks = useMemo(
    () => new Set(backupPaths.flatMap((p) => pathLinkIds(graph, p))),
    [graph, backupPaths],
  );
  const pos = (id: string) => graph.nodes.find((n) => n.id === id);

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      {graph.links.map((l) => {
        const a = pos(l.a);
        const b = pos(l.b);
        if (!a || !b) return null;
        const isActive = activeLinks.has(l.id);
        const isBackup = !isActive && backupLinks.has(l.id);
        const stroke = l.status === "failed"
          ? "var(--failed)"
          : isActive
            ? "var(--active-route)"
            : isBackup
              ? "var(--backup-route)"
              : l.congestion > 65
                ? "var(--congested)"
                : l.congestion > 45
                  ? "var(--warning)"
                  : "var(--border)";
        return (
          <g key={l.id} className="cursor-pointer" onClick={() => onLinkClick?.(l.id)}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={2.4} />
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={stroke}
              strokeWidth={isActive ? 1.05 : selectedLink === l.id ? 0.95 : 0.5}
              strokeLinecap="round"
              strokeDasharray={l.status === "failed" ? "1.6 1.6" : undefined}
              className={cn(isActive && "route-flow")}
              opacity={l.status === "failed" ? 0.75 : 1}
            />
            <text
              x={(a.x + b.x) / 2}
              y={(a.y + b.y) / 2 - 0.9}
              textAnchor="middle"
              fontSize={1.7}
              fill="var(--muted-foreground)"
              className="font-mono select-none"
            >
              {l.latency}ms
            </text>
          </g>
        );
      })}

      {criticalLinks.map((id) => {
        const l = graph.links.find((x) => x.id === id);
        const a = l && pos(l.a);
        const b = l && pos(l.b);
        if (!l || !a || !b) return null;
        return (
          <line
            key={`crit-${id}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="var(--warning)"
            strokeWidth={0.85}
            strokeDasharray="1.1 0.9"
            strokeLinecap="round"
            pointerEvents="none"
            opacity={0.95}
          />
        );
      })}

      {overlayPaths.map((p, i) => {
        const pts = p
          .map((id) => pos(id))
          .filter((n): n is NonNullable<typeof n> => !!n)
          .map((n) => `${n.x},${n.y}`)
          .join(" ");
        if (!pts) return null;
        return (
          <polyline
            key={`overlay-${i}`}
            points={pts}
            fill="none"
            stroke={i % 2 === 0 ? "var(--chart-1)" : "var(--chart-3)"}
            strokeWidth={0.9}
            strokeDasharray="2 1.2"
            strokeLinejoin="round"
            strokeLinecap="round"
            pointerEvents="none"
            opacity={0.95}
          />
        );
      })}

      {graph.nodes.map((n) => {
        const risk = failurePrediction(n);
        const isSrc = n.id === source;
        const isDst = n.id === destination;
        const onPath = activePath.includes(n.id);
        return (
          <g key={n.id} className="cursor-pointer" onClick={() => onNodeClick?.(n.id)}>
            {(risk.level === "HIGH" || n.status === "failed") && (
              <circle cx={n.x} cy={n.y} r={3.4} fill={nodeColor(n.status)} className="node-pulse" opacity={0.4} />
            )}
            <circle
              cx={n.x}
              cy={n.y}
              r={onPath ? 3.1 : 2.7}
              fill="var(--card)"
              stroke={onPath ? "var(--active-route)" : nodeColor(n.status)}
              strokeWidth={selectedNode === n.id ? 1 : 0.55}
            />
            <circle cx={n.x} cy={n.y} r={1.35} fill={nodeColor(n.status)} />
            <text
              x={n.x}
              y={n.y + 5.6}
              textAnchor="middle"
              fontSize={2.4}
              fill="var(--foreground)"
              className="font-mono select-none"
            >
              {n.id}
            </text>
            {(isSrc || isDst) && (
              <text
                x={n.x}
                y={n.y - 4}
                textAnchor="middle"
                fontSize={2}
                fill={isSrc ? "var(--active-route)" : "var(--healthy)"}
                className="font-mono select-none"
              >
                {isSrc ? "SRC" : "DST"}
              </text>
            )}
          </g>
        );
      })}

      {criticalNodes.map((id) => {
        const n = pos(id);
        if (!n) return null;
        return (
          <circle
            key={`critn-${id}`}
            cx={n.x}
            cy={n.y}
            r={4.1}
            fill="none"
            stroke="var(--warning)"
            strokeWidth={0.5}
            strokeDasharray="1 0.8"
            pointerEvents="none"
          />
        );
      })}
    </svg>
  );
}
