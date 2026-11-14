// Utility to detect campus rooms and areas from AI chat responses

const ROOM_PATTERNS = [
  // Exact numbered rooms from diagram
  '201', '202', '203', '204', '205', '206', '207', '208', '209', '210', '211', '212', '213', '214', '215',
  // Named rooms & core facilities from diagram
  'Innovation Lab',
  'Art Studio',
  'Gym',
  'Meditation room',
  'skylight',
  'skylights',
  'giếng trời',
  'Office',
  'WC',
  'Restrooms',
  'nhà vệ sinh',
  'Thang máy',
  'Elevators',
  'Elevator',
  'Khu đa năng',
  'Multipurpose Zone',
  'Event Zone',
  'Booth',
  // Common database aliases
  'A201', 'B201', 'C202', 'A103', 'B105', 'Lab1', 'Lab 1',
];

export const extractCampusRooms = (text: string): string[] => {
  if (!text) return [];
  const found = new Set<string>();

  for (const pattern of ROOM_PATTERNS) {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:room|phòng|lab|venue|khu|nhà)?\\s*\\b${escaped}\\b`, 'i');
    if (regex.test(text)) {
      const p = pattern.toLowerCase();
      // Normalize aliases to diagram IDs
      if (p === 'a201' || p === 'b201' || p === '201') found.add('201');
      else if (p === 'c202' || p === '202') found.add('202');
      else if (p === 'a103' || p === '203') found.add('203');
      else if (p === 'lab1' || p === 'lab 1' || p.includes('innovation')) found.add('Innovation Lab');
      else if (p.includes('gym')) found.add('Gym');
      else if (p.includes('art')) found.add('Art Studio');
      else if (p.includes('meditation')) found.add('Meditation room');
      else if (p.includes('skylight') || p.includes('giếng trời')) found.add('skylights');
      else if (p.includes('wc') || p.includes('restroom') || p.includes('vệ sinh')) found.add('WC');
      else if (p === '204') found.add('204');
      else if (p.includes('thang máy') || p.includes('elevator') || p.includes('shaft')) found.add('Elevator Shaft');
      else if (p.includes('đa năng') || p.includes('multipurpose') || p.includes('booth') || p.includes('event')) found.add('Multipurpose (North)');
      else if (p.includes('office')) found.add('Office');
      else found.add(pattern);
    }
  }

  return Array.from(found);
};
