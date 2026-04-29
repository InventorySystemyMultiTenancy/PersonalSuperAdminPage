import React, { useMemo } from "react";

export default function MiniLineChart({ data, maxValue }) {
  const points = useMemo(() => {
    const width = 100;
    const height = 32;
    return data
      .map((value, index) => {
        const x = (index / (data.length - 1 || 1)) * width;
        const y = height - (value / (maxValue || 1)) * height;
        return `${x},${y}`;
      })
      .join(" ");
  }, [data, maxValue]);

  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      className="h-16 w-full"
    >
      <defs>
        <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,170,56,0.28)" />
          <stop offset="100%" stopColor="rgba(255,170,56,0.01)" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke="var(--sm-accent)"
        strokeWidth="2.4"
        points={points}
      />
      <polygon fill="url(#lineFill)" points={`0,32 ${points} 100,32`} />
    </svg>
  );
}
