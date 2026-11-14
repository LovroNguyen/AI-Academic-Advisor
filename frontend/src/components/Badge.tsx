import React from 'react';

type Variant = 'green' | 'blue' | 'yellow' | 'red' | 'gray' | 'purple';

interface BadgeProps { variant?: Variant; children: React.ReactNode; }

const map: Record<string, string> = {
  green:  'badge-green',
  blue:   'badge-blue',
  purple: 'badge-blue',
  yellow: 'badge-yellow',
  red:    'badge-red',
  gray:   'badge-gray',
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'gray', children }) => (
  <span className={`badge ${map[variant] ?? 'badge-gray'}`}>{children}</span>
);
