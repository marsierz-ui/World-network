import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CONTINENTS, CONTINENT_COLORS } from '../../lib/continents';

interface Props {
  data: Record<string, number | string>[];
  year: number;
}

export function MobilityChart({ data, year }: Props) {
  return (
    <div className="mobility-chart">
      <div className="section-label">Network by region over time</div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
          <XAxis dataKey="year" stroke="#8a91a0" fontSize={11} />
          <YAxis stroke="#8a91a0" fontSize={11} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: '#171a21', border: '1px solid #2a2f3a', fontSize: 12 }}
            labelStyle={{ color: '#c7ccd6' }}
          />
          {CONTINENTS.map((c) => (
            <Area
              key={c}
              type="monotone"
              dataKey={c}
              stackId="1"
              stroke={CONTINENT_COLORS[c]}
              fill={CONTINENT_COLORS[c]}
              fillOpacity={0.5}
            />
          ))}
          <ReferenceLine x={year} stroke="#fff" strokeDasharray="2 2" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
