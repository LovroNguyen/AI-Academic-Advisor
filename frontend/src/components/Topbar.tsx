import React from 'react';

interface TopbarProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const Topbar: React.FC<TopbarProps> = ({ title, subtitle, action }) => (
  <div className="page-header">
    <div>
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-sub">{subtitle}</p>}
    </div>
    {action && <div>{action}</div>}
  </div>
);
