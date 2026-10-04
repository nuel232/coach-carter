"use client";
import { useState } from "react";

type Position = { id: string; x: number; y: number };
type Action = { from: string; to: string; type: "screen" | "drive" | "pass" | "cut" | "pick" };

interface DiagramData {
  play: string;
  positions: Position[];
  actions: Action[];
}

const COLORS: Record<string, string> = {
  PG: "#f97316", SG: "#3b82f6", SF: "#22c55e", PF: "#a855f7", C: "#ef4444",
};

export default function CourtDiagram({ data }: { data: DiagramData }) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [positions, setPositions] = useState<Position[]>(data.positions);

  const W = 400, H = 360;

  const toSVG = (x: number, y: number) => ({
    svgX: (x / 100) * W,
    svgY: (y / 100) * H,
  });

  const getPos = (id: string) => positions.find(p => p.id === id);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPositions(ps => ps.map(p => p.id === dragging ? { ...p, x: Math.max(2, Math.min(98, x)), y: Math.max(2, Math.min(98, y)) } : p));
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-ink-900">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="font-display text-lg font-bold uppercase tracking-wider text-ember-400">{data.play}</span>
        <span className="font-mono text-[10px] text-dust/70">drag players to adjust</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ cursor: dragging ? "grabbing" : "default", userSelect: "none" }}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setDragging(null)}
        onMouseLeave={() => setDragging(null)}
      >
        {/* Court surface */}
        <rect width={W} height={H} className="fill-court" />

        {/* Court lines */}
        <g className="stroke-court-line" strokeWidth="1.5" fill="none" opacity="0.55">
          {/* Boundary */}
          <rect x="20" y="15" width={W-40} height={H-30} rx="4" />
          {/* Half court line */}
          <line x1="20" y1={H/2} x2={W-20} y2={H/2} />
          {/* Centre circle */}
          <circle cx={W/2} cy={H/2} r="35" />
          {/* Left paint */}
          <rect x="20" y={H/2-55} width="90" height="110" />
          <rect x="20" y={H/2-35} width="55" height="70" />
          {/* Left arc */}
          <path d={`M 20 ${H/2-55} Q 165 ${H/2} 20 ${H/2+55}`} fill="none" />
          {/* Left basket */}
          <circle cx="55" cy={H/2} r="10" />
          <circle cx="55" cy={H/2} r="5" className="fill-court-line" opacity="0.8" />
          <line x1="20" y1={H/2} x2="45" y2={H/2} strokeWidth="2" />
          {/* Right paint */}
          <rect x={W-110} y={H/2-55} width="90" height="110" />
          <rect x={W-75} y={H/2-35} width="55" height="70" />
          {/* Right arc */}
          <path d={`M ${W-20} ${H/2-55} Q ${W-165} ${H/2} ${W-20} ${H/2+55}`} fill="none" />
          {/* Right basket */}
          <circle cx={W-55} cy={H/2} r="10" />
          <circle cx={W-55} cy={H/2} r="5" className="fill-court-line" opacity="0.8" />
          <line x1={W-20} y1={H/2} x2={W-45} y2={H/2} strokeWidth="2" />
          {/* Three point line left */}
          <path d={`M 20 ${H/2-90} Q 145 ${H/2} 20 ${H/2+90}`} />
          {/* Three point line right */}
          <path d={`M ${W-20} ${H/2-90} Q ${W-145} ${H/2} ${W-20} ${H/2+90}`} />
        </g>

        {/* Actions (arrows) */}
        <defs>
          {Object.entries(COLORS).map(([id, color]) => (
            <marker key={id} id={`arrow-${id}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3 z" fill={color} opacity="0.7" />
            </marker>
          ))}
          <marker id="arrow-basket" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#f97316" opacity="0.7" />
          </marker>
        </defs>

        {data.actions.map((action, i) => {
          const from = getPos(action.from);
          if (!from) return null;
          let toX: number, toY: number, markerId: string;
          if (action.to === "basket") {
            toX = (20 / 100) * W + 35; toY = H / 2;
            markerId = "arrow-basket";
          } else {
            const toPos = getPos(action.to);
            if (!toPos) return null;
            const sv = toSVG(toPos.x, toPos.y);
            toX = sv.svgX; toY = sv.svgY;
            markerId = `arrow-${action.from}`;
          }
          const { svgX: fx, svgY: fy } = toSVG(from.x, from.y);
          const color = COLORS[action.from] || "#f97316";
          const isDash = action.type === "screen" || action.type === "pick";
          return (
            <line key={i} x1={fx} y1={fy} x2={toX} y2={toY}
              stroke={color} strokeWidth="1.5" strokeOpacity="0.7"
              strokeDasharray={isDash ? "5,3" : undefined}
              markerEnd={`url(#${markerId})`}
            />
          );
        })}

        {/* Player tokens — draggable */}
        {positions.map(p => {
          const { svgX, svgY } = toSVG(p.x, p.y);
          const color = COLORS[p.id] || "#f97316";
          return (
            <g key={p.id} style={{ cursor: "grab" }}
              onMouseDown={e => { e.preventDefault(); setDragging(p.id); }}
            >
              <circle cx={svgX} cy={svgY} r="16" fill={color} opacity="0.15" />
              <circle cx={svgX} cy={svgY} r="12" fill={color} opacity="0.9" />
              <text x={svgX} y={svgY+1} textAnchor="middle" dominantBaseline="middle"
                fill="white" fontSize="9" fontWeight="700" fontFamily="monospace"
              >{p.id}</text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-3">
        {positions.map(p => (
          <div key={p.id} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: COLORS[p.id] }} />
            <span className="text-[10px] font-mono text-dust">{p.id}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-6 border-t border-dashed border-dust/60" />
          <span className="text-[10px] font-mono text-dust">screen/pick</span>
          <div className="w-6 border-t border-dust/60" />
          <span className="text-[10px] font-mono text-dust">drive/pass</span>
        </div>
      </div>
    </div>
  );
}
