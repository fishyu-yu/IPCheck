import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
export function LatencyChart({ samples }: { samples: number[] }) {
  return (
    <div
      className="latency-chart"
      role="img"
      aria-label={samples.length ? 'Latency samples in milliseconds' : 'No latency measurements yet'}
    >
      {samples.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={samples.map((ms, i) => ({ sample: i + 1, ms: Math.round(ms * 10) / 10 }))}
            margin={{ top: 10, right: 12, left: -25, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" />
            <XAxis dataKey="sample" stroke="var(--muted)" tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted)" tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }}
              formatter={(v) => [`${v} ms`, 'RTT']}
            />
            <Line
              type="linear"
              dataKey="ms"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={{ r: 3, fill: 'var(--card)' }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="chart-placeholder">
          <div />
          <div />
          <div />
          <span>Run a test to measure your connection</span>
        </div>
      )}
    </div>
  );
}
