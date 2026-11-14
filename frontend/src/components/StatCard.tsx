import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  valueColor?: string;
  change?: string;
  changeType?: 'up' | 'down' | 'warn' | 'muted';
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, valueColor, change, changeType }) => {
  const changeColor = changeType === 'up' ? '#16a34a' : changeType === 'down' ? '#dc2626' : changeType === 'warn' ? '#d97706' : '#94a3b8';
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: valueColor || '#0f172a' }}>{value}</div>
      {change && <div className="stat-sub" style={{ color: changeColor }}>{change}</div>}
    </div>
  );
};
