"use client";

import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { useEffect, useRef } from "react";

import type { AdminChartPoint } from "@/lib/web-api";

ChartJS.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, Filler, Tooltip);

export function AdminChart({ title, points }: { title: string; points: AdminChartPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current || points.length === 0) return;

    const chart = new ChartJS(canvasRef.current, {
      type: "line",
      data: {
        labels: points.map((point) => point.label),
        datasets: [
          {
            label: title,
            data: points.map((point) => point.value),
            borderColor: "#111111",
            backgroundColor: "rgba(17, 17, 17, 0.08)",
            borderWidth: 1.5,
            pointRadius: 2,
            tension: 0.25,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#6f695f", font: { size: 10 } } },
          y: { beginAtZero: true, grid: { color: "#ded7cd" }, ticks: { color: "#6f695f", font: { size: 10 } } },
        },
      },
    });

    return () => chart.destroy();
  }, [points, title]);

  return (
    <div className="border border-[#b8b1a5] bg-[#fbfaf7] p-4">
      <p className="text-[8px] uppercase tracking-[0.14em] text-[#5f5a53] sm:text-[9px]">{title}</p>
      {points.length > 0 ? (
        <div className="mt-3 h-[180px] w-full sm:h-[220px]">
          <canvas ref={canvasRef} aria-label={title} />
        </div>
      ) : (
        <p className="mt-6 text-[10px] leading-[1.55] text-[#8a847a] sm:text-[11px]">No chart data yet.</p>
      )}
    </div>
  );
}
