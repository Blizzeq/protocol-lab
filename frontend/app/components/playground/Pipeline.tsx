"use client";

import { useEffect, useRef, useState } from "react";

// The "watch the message move" lifecycle pipeline: a row of named stages connected
// by lines, lighting up idle → active → done (or error) as a message travels.

export type StageStatus = "idle" | "active" | "done" | "error";
export type Stage = { label: string; status: StageStatus };

function nodeStyle(status: StageStatus): React.CSSProperties {
  const lit = status === "done" || status === "active";
  const border = lit ? "#4ade80" : status === "error" ? "#f87171" : "#3f4d63";
  const fill = lit ? "#4ade80" : status === "error" ? "#f87171" : "transparent";
  const filled = status !== "idle";
  return {
    width: 30,
    height: 30,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
    flex: "none",
    border: `1.5px solid ${border}`,
    color: filled ? "#0b0f17" : "#3f4d63",
    background: fill,
    animation: status === "active" ? "pl-stage 1.1s ease-in-out infinite" : undefined,
  };
}

function icon(status: StageStatus, i: number): string {
  if (status === "done") return "✓";
  if (status === "error") return "✗";
  return String(i + 1);
}

export function StagePipeline({
  stages,
  maxWidth = 780,
}: {
  stages: Stage[];
  maxWidth?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        padding: "4px 4px 0",
        maxWidth,
        margin: "0 auto",
      }}
    >
      {stages.map((st, i) => {
        const prev = stages[i - 1];
        const lineLit = i > 0 && (prev.status === "done" || prev.status === "error");
        const labelColor = st.status === "idle" ? "#3f4d63" : nodeBorder(st.status);
        return (
          <div key={i} style={{ display: "contents" }}>
            {i > 0 && (
              <div
                style={{
                  flex: 1,
                  minWidth: 12,
                  height: 1.5,
                  marginTop: 14,
                  background: lineLit ? "#4ade80" : "#202c3e",
                }}
              />
            )}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
              <div style={nodeStyle(st.status)}>{icon(st.status, i)}</div>
              <div
                style={{
                  fontSize: 10.5,
                  marginTop: 8,
                  textAlign: "center",
                  color: labelColor,
                  maxWidth: 80,
                  lineHeight: 1.3,
                }}
              >
                {st.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function nodeBorder(status: StageStatus): string {
  const lit = status === "done" || status === "active";
  return lit ? "#4ade80" : status === "error" ? "#f87171" : "#3f4d63";
}

/**
 * Drives a StagePipeline animation. `animate(finalStatus)` resets to idle, then
 * advances one stage per `intervalMs`, leaving the last stage in `finalStatus`.
 * Returns a promise that resolves when the animation completes.
 */
export function useStagePipeline(labels: string[], intervalMs = 350, initialDelay = 120) {
  const make = (): Stage[] => labels.map((label) => ({ label, status: "idle" as StageStatus }));
  const [stages, setStages] = useState<Stage[]>(make);
  const [running, setRunning] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => clear(), []);

  const reset = () => {
    clear();
    setStages(make());
    setRunning(false);
  };

  const animate = (finalStatus: StageStatus = "done"): Promise<void> =>
    new Promise<void>((resolve) => {
      clear();
      setRunning(true);
      const n = labels.length;
      let c = 0;
      const step = () => {
        setStages(
          labels.map((label, idx) => ({
            label,
            status:
              idx < c
                ? "done"
                : idx === c
                  ? idx === n - 1
                    ? finalStatus
                    : "active"
                  : "idle",
          })),
        );
        if (c >= n - 1) {
          setRunning(false);
          resolve();
          return;
        }
        c++;
        timers.current.push(setTimeout(step, intervalMs));
      };
      timers.current.push(setTimeout(step, initialDelay));
    });

  return { stages, animate, reset, running, setStages };
}
