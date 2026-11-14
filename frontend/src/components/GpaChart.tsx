import React from 'react';

interface GpaChartProps {
  currentGpa: number;
  targetGpa: number;
  history?: { semester: string; gpa: number }[];
}

export const GpaChart: React.FC<GpaChartProps> = ({
  currentGpa,
  targetGpa,
  history = [
    { semester: 'Sem 1', gpa: 2.80 },
    { semester: 'Sem 2', gpa: 3.00 },
    { semester: 'Sem 3', gpa: 2.94 },
    { semester: 'Sem 4', gpa: 3.08 },
    { semester: 'Sem 5', gpa: currentGpa || 3.12 },
  ],
}) => {
  const maxGpa = 4.0;
  const progressPercent = Math.min(100, Math.round((currentGpa / maxGpa) * 100));

  return (
    <div className="bg-[#1A1D27] border border-[#2E3248] rounded-[12px] p-5">
      <div className="text-xs font-semibold text-[#8B8FA8] uppercase tracking-wider mb-3">
        GPA Trend
      </div>
      <div className="bg-[#22263A] rounded-lg h-40 flex items-end justify-between gap-3 p-4 overflow-hidden">
        {history.map((item, idx) => {
          const isLatest = idx === history.length - 1;
          const heightPercent = Math.max(15, Math.min(100, (item.gpa / maxGpa) * 100));

          return (
            <div key={item.semester} className="flex flex-col items-center gap-1.5 flex-1 h-full justify-end group">
              <span className="text-[10px] text-[#8B8FA8] opacity-0 group-hover:opacity-100 transition-opacity">
                {item.gpa.toFixed(2)}
              </span>
              <div
                className="w-full rounded-t transition-all duration-300 group-hover:opacity-80"
                style={{
                  height: `${heightPercent}%`,
                  backgroundColor: isLatest ? '#6C63FF' : `rgba(108, 99, 255, ${0.35 + idx * 0.1})`,
                }}
              />
              <div className="text-[11px] text-[#8B8FA8] font-medium text-center whitespace-nowrap">
                {item.semester} {isLatest ? '▲' : ''}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center mt-3 text-xs">
        <span className="text-[#8B8FA8]">Target GPA: <strong className="text-appText">{targetGpa.toFixed(2)}</strong></span>
        <span className="text-[#6C63FF] font-semibold">Current: {currentGpa.toFixed(2)}</span>
      </div>

      <div className="w-full bg-[#22263A] rounded-full h-2 mt-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progressPercent}%`,
            background: 'linear-gradient(90deg, #6C63FF 0%, #4ECDC4 100%)',
          }}
        />
      </div>
      <div className="text-[10px] text-[#8B8FA8] mt-1 text-right">
        {progressPercent}% towards 4.00 max scale
      </div>
    </div>
  );
};
