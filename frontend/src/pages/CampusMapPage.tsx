import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Search,
  Compass,
  Users,
  Sparkles,
  BookOpen,
  Info,
  CheckCircle2,
  Navigation,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export interface RoomData {
  id: string; // e.g. '201', '202', 'WC', 'Elevators', 'Gym', 'Art Studio', 'Innovation Lab', 'skylights'
  name: string;
  category: string;
  capacity: number;
  facilities: string[];
  currentClass?: {
    code: string;
    name: string;
    time: string;
    lecturer: string;
  };
  svgCoords: [number, number, number, number]; // [x, y, width, height]
  labelCoords: [number, number]; // [x, y] center for label
}

export const CAMPUS_ROOMS: RoomData[] = [
  // ─── LEFT COLUMN (Vertical stack) ──────────────────────────────────────────
  {
    id: '201',
    name: 'Classroom 201',
    category: 'Classroom',
    capacity: 45,
    facilities: ['Laser Projector', 'Air Conditioned', 'Whiteboard', 'Wi-Fi 6'],
    currentClass: {
      code: 'ML201',
      name: 'Machine Learning',
      time: '08:30 - 11:45',
      lecturer: 'Dept. of AI',
    },
    svgCoords: [45, 50, 110, 105],
    labelCoords: [100, 102],
  },
  {
    id: '202',
    name: 'Classroom 202',
    category: 'Classroom',
    capacity: 45,
    facilities: ['Smart Display', 'Air Conditioned', 'Whiteboard', 'Wi-Fi 6'],
    currentClass: {
      code: 'SE301',
      name: 'Software Engineering',
      time: '13:00 - 16:15',
      lecturer: 'Dept. of Software',
    },
    svgCoords: [45, 155, 110, 105],
    labelCoords: [100, 207],
  },
  {
    id: '203',
    name: 'Classroom 203',
    category: 'Classroom',
    capacity: 45,
    facilities: ['Dual Monitors', 'Air Conditioned', 'Audio System'],
    currentClass: {
      code: 'WEB201',
      name: 'Web Development',
      time: '13:30 - 15:30',
      lecturer: 'Faculty of IT',
    },
    svgCoords: [45, 260, 110, 105],
    labelCoords: [100, 312],
  },

  // ─── BETWEEN 201 & 205: WC (Restrooms) ─────────────────────────────────────
  {
    id: 'WC',
    name: 'Restrooms (WC)',
    category: 'Sanitary Facilities',
    capacity: 15,
    facilities: ['Restrooms', 'Handwash Sinks', 'Auto Dryers', 'Accessible Cubicle'],
    svgCoords: [190, 50, 110, 85],
    labelCoords: [245, 92],
  },

  // ─── UTILITY CORE: ELEVATOR SHAFT (ATTACHED DIRECTLY ABOVE 204) ────────────
  {
    id: 'Elevator Shaft',
    name: 'Elevator Shaft & Service Core',
    category: 'Vertical Circulation & Utility',
    capacity: 0,
    facilities: ['Dual Passenger Elevators', 'Utility Shaft', 'Non-Classroom Core'],
    svgCoords: [190, 175, 110, 65],
    labelCoords: [245, 207],
  },

  // ─── ROOM 204 (RESTORED TO ORIGINAL SQUARE CLASSROOM DIMENSIONS) ───────────
  {
    id: '204',
    name: 'Classroom 204',
    category: 'Classroom',
    capacity: 40,
    facilities: ['Laser Projector', 'Air Conditioned', 'Whiteboard', 'Wi-Fi 6'],
    currentClass: {
      code: 'OOP201',
      name: 'Object-Oriented Programming',
      time: '07:30 - 09:45',
      lecturer: 'Dept. of Software',
    },
    svgCoords: [190, 240, 110, 105],
    labelCoords: [245, 292],
  },

  // ─── CENTER-LEFT AREA ──────────────────────────────────────────────────────
  {
    id: '205',
    name: 'Classroom 205',
    category: 'Classroom',
    capacity: 40,
    facilities: ['Whiteboard', 'Air Conditioned', 'Wi-Fi 6'],
    svgCoords: [335, 50, 110, 105],
    labelCoords: [390, 102],
  },
  {
    id: '206',
    name: 'Classroom 206',
    category: 'Classroom',
    capacity: 40,
    facilities: ['Projector', 'Air Conditioned', 'Whiteboard'],
    svgCoords: [335, 190, 110, 105],
    labelCoords: [390, 242],
  },
  {
    id: 'Art Studio',
    name: 'Art Studio',
    category: 'Design Studio',
    capacity: 30,
    facilities: ['Drawing Boards', 'Color Lighting', 'Design PCs', 'Air Conditioned'],
    svgCoords: [335, 295, 110, 50],
    labelCoords: [390, 325],
  },

  // ─── BOTTOM ROW (West to Center) ───────────────────────────────────────────
  {
    id: 'Gym',
    name: 'Campus Gymnasium',
    category: 'Sports & Fitness',
    capacity: 80,
    facilities: ['Fitness Equipment', 'Locker Room', 'Shower', 'Air Conditioned'],
    svgCoords: [115, 380, 110, 105],
    labelCoords: [170, 432],
  },
  {
    id: 'Innovation Lab',
    name: 'Innovation Lab',
    category: 'High-Tech Lab',
    capacity: 40,
    facilities: ['AI Workstations', '3D Printers', 'IoT Kits', 'Gigabit LAN'],
    currentClass: {
      code: 'DL401',
      name: 'Deep Learning & AI Research',
      time: '09:00 - 12:00',
      lecturer: 'AI Research Group',
    },
    svgCoords: [225, 380, 110, 105],
    labelCoords: [280, 432],
  },
  {
    id: 'Office',
    name: 'Administrative Office',
    category: 'Administration',
    capacity: 25,
    facilities: ['Service Counter', 'Consulting Desks', 'Queue Kiosk'],
    svgCoords: [335, 380, 110, 105],
    labelCoords: [390, 432],
  },

  // ─── CENTER SKYLIGHT ATRIUM & MULTIPURPOSE AREAS ───────────────────────────
  {
    id: 'Multipurpose (North)',
    name: 'Multipurpose Area (North) · Study Pods & Event Booths',
    category: 'Multipurpose Event Area',
    capacity: 100,
    facilities: ['Flexible Tables & Chairs', 'Event Booth Power Outlets', 'Open Discussion Pods', 'Display Banners'],
    svgCoords: [485, 50, 190, 135],
    labelCoords: [580, 117],
  },
  {
    id: 'skylights',
    name: 'Central Skylights Atrium',
    category: 'Architectural Lightwell',
    capacity: 0,
    facilities: ['Natural Skylight Illumination', 'Open-Air Ventilation', 'Glass Guardrails'],
    svgCoords: [485, 215, 190, 130],
    labelCoords: [580, 280],
  },
  {
    id: 'Multipurpose (South)',
    name: 'Multipurpose Area (South) · Exhibition & Event Hall',
    category: 'Multipurpose Event Area',
    capacity: 120,
    facilities: ['Club Fair Booth Stalls', 'Student Lounge Sofas', 'Stage Backdrop Anchor', 'High-Speed Wi-Fi'],
    svgCoords: [485, 375, 190, 110],
    labelCoords: [580, 430],
  },

  // ─── TOP RIGHT (2 Large Lecture Halls) ──────────────────────────────────────
  {
    id: '207',
    name: 'Lecture Hall 207',
    category: 'Lecture Hall',
    capacity: 70,
    facilities: ['Dual Projectors', 'Surround Sound', 'Air Conditioned'],
    svgCoords: [715, 50, 110, 105],
    labelCoords: [770, 102],
  },
  {
    id: '208',
    name: 'Lecture Hall 208',
    category: 'Lecture Hall',
    capacity: 70,
    facilities: ['Dual Projectors', 'Surround Sound', 'Air Conditioned'],
    svgCoords: [825, 50, 110, 105],
    labelCoords: [880, 102],
  },

  // ─── MIDDLE RIGHT (2 Columns of 3 Rooms) ───────────────────────────────────
  {
    id: '209',
    name: 'Classroom 209',
    category: 'Classroom',
    capacity: 35,
    facilities: ['Whiteboard', 'Air Conditioned', 'Wi-Fi 6'],
    svgCoords: [715, 190, 110, 52],
    labelCoords: [770, 216],
  },
  {
    id: '210',
    name: 'Classroom 210',
    category: 'Classroom',
    capacity: 35,
    facilities: ['Whiteboard', 'Air Conditioned', 'Wi-Fi 6'],
    svgCoords: [715, 242, 110, 52],
    labelCoords: [770, 268],
  },
  {
    id: '211',
    name: 'Classroom 211',
    category: 'Classroom',
    capacity: 35,
    facilities: ['Whiteboard', 'Air Conditioned', 'Wi-Fi 6'],
    svgCoords: [715, 294, 110, 52],
    labelCoords: [770, 320],
  },
  {
    id: '212',
    name: 'Classroom 212',
    category: 'Classroom',
    capacity: 35,
    facilities: ['Whiteboard', 'Air Conditioned', 'Wi-Fi 6'],
    svgCoords: [860, 190, 110, 52],
    labelCoords: [915, 216],
  },
  {
    id: '213',
    name: 'Classroom 213',
    category: 'Classroom',
    capacity: 35,
    facilities: ['Whiteboard', 'Air Conditioned', 'Wi-Fi 6'],
    svgCoords: [860, 242, 110, 52],
    labelCoords: [915, 268],
  },
  {
    id: '214',
    name: 'Classroom 214',
    category: 'Classroom',
    capacity: 35,
    facilities: ['Whiteboard', 'Air Conditioned', 'Wi-Fi 6'],
    svgCoords: [860, 294, 110, 52],
    labelCoords: [915, 320],
  },

  // ─── BOTTOM RIGHT ──────────────────────────────────────────────────────────
  {
    id: '215',
    name: 'Classroom 215',
    category: 'Classroom',
    capacity: 40,
    facilities: ['Whiteboard', 'Air Conditioned', 'Wi-Fi 6'],
    svgCoords: [715, 380, 110, 105],
    labelCoords: [770, 432],
  },
  {
    id: 'Office (East)',
    name: 'Faculty Office',
    category: 'Staff Office',
    capacity: 20,
    facilities: ['Staff Desks', 'Meeting Table', 'Air Conditioned'],
    svgCoords: [860, 380, 110, 52],
    labelCoords: [915, 406],
  },
  {
    id: 'Meditation room',
    name: 'Meditation Room',
    category: 'Wellness & Quiet Space',
    capacity: 25,
    facilities: ['Sound Isolation', 'Soft Mats', 'Aromatherapy', 'Quiet Policy'],
    svgCoords: [860, 432, 110, 53],
    labelCoords: [915, 458],
  },
];

export const CampusMapPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedRoom, setSelectedRoom] = useState<RoomData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [enrolledClasses, setEnrolledClasses] = useState<any[]>([]);

  useEffect(() => {
    api.get('/classes?enrolledOnly=true')
      .then((res) => {
        if (res.data) setEnrolledClasses(res.data);
      })
      .catch(console.error);
  }, []);

  // Helper to normalize room code (e.g. 'A201' -> '201', 'Room 201' -> '201')
  const normalizeRoomCode = (raw: string) => {
    const cleaned = raw.trim().toLowerCase().replace(/^room\s*/i, '');
    if (cleaned === 'a201' || cleaned === 'b201' || cleaned === '201') return '201';
    if (cleaned === 'c202' || cleaned === '202') return '202';
    if (cleaned === 'a103' || cleaned === '203') return '203';
    if (cleaned === 'lab1' || cleaned === 'lab 1' || cleaned.includes('innovation')) return 'Innovation Lab';
    if (cleaned.includes('gym')) return 'Gym';
    if (cleaned.includes('art')) return 'Art Studio';
    if (cleaned.includes('meditation')) return 'Meditation room';
    if (cleaned.includes('skylight') || cleaned.includes('giếng')) return 'skylights';
    if (cleaned.includes('wc') || cleaned.includes('restroom') || cleaned.includes('vệ sinh')) return 'WC';
    if (cleaned.includes('shaft') || cleaned.includes('elevator') || cleaned.includes('thang máy')) return 'Elevator Shaft';
    if (cleaned === '204') return '204';
    if (cleaned.includes('đa năng') || cleaned.includes('multipurpose') || cleaned.includes('booth') || cleaned.includes('event')) {
      return 'Multipurpose (North)';
    }
    if (cleaned.includes('office')) return 'Office';
    return cleaned;
  };

  // Sync with URL param `?room=...`
  useEffect(() => {
    const roomParam = searchParams.get('room');
    if (roomParam) {
      const target = normalizeRoomCode(roomParam);
      const match = CAMPUS_ROOMS.find(
        (r) =>
          r.id.toLowerCase() === target.toLowerCase() ||
          r.id.toLowerCase().includes(target.toLowerCase()) ||
          r.name.toLowerCase().includes(target.toLowerCase())
      );
      if (match) {
        setSelectedRoom(match);
      }
    } else if (!selectedRoom) {
      // Default selection to 201
      setSelectedRoom(CAMPUS_ROOMS[0]);
    }
  }, [searchParams]);

  const handleSelectRoom = (room: RoomData) => {
    setSelectedRoom(room);
    setSearchParams({ room: room.id });
  };

  const handleSearch = (term: string) => {
    setSearchQuery(term);
    if (!term.trim()) return;
    const target = normalizeRoomCode(term);
    const match = CAMPUS_ROOMS.find(
      (r) =>
        r.id.toLowerCase() === target.toLowerCase() ||
        r.id.toLowerCase().includes(target.toLowerCase()) ||
        r.name.toLowerCase().includes(term.toLowerCase()) ||
        r.category.toLowerCase().includes(term.toLowerCase()) ||
        r.currentClass?.name.toLowerCase().includes(term.toLowerCase()) ||
        r.currentClass?.code.toLowerCase().includes(term.toLowerCase())
    );
    if (match) {
      handleSelectRoom(match);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 select-none font-sans pb-12">
      {/* ─── 1. PAGE HEADER ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            <Compass className="w-4 h-4 text-slate-700" />
            <span>Interactive Campus Layout</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Floor Plan &amp; Classroom Locator
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Exact blueprint including lecture halls, skylight atrium, event zones, elevators, and facilities.
          </p>
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search (201, 204, WC, Elevator...)"
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all text-slate-900 placeholder:text-slate-400 shadow-xs"
          />
        </div>
      </div>

      {/* ─── 2. QUICK JUMP: POPULAR PLACES & COURSES ─────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 px-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
            <BookOpen className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900">Quick Locator</div>
            <div className="text-[11px] text-slate-500">Jump directly to key academic &amp; campus areas:</div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {[
            { label: 'Room 201', room: '201' },
            { label: 'Room 204', room: '204' },
            { label: 'Restrooms (WC)', room: 'WC' },
            { label: 'Elevator Shaft', room: 'Elevator Shaft' },
            { label: 'Multipurpose Area', room: 'Multipurpose (North)' },
            { label: 'Central Skylights', room: 'skylights' },
            { label: 'Innovation Lab', room: 'Innovation Lab' },
            { label: 'Gym', room: 'Gym' },
          ].map((c) => (
            <button
              key={c.room}
              type="button"
              onClick={() => handleSearch(c.room)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                selectedRoom?.id === c.room
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <MapPin className="w-3 h-3 text-slate-400" />
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── 3. MAIN MAP & DETAILS ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* SVG Blueprint Canvas (8 Cols) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-300 shadow-xs overflow-hidden flex flex-col">
          {/* Blueprint Header */}
          <div className="p-3 px-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 font-mono">
            <div className="flex items-center gap-2 font-sans font-semibold text-slate-800">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-900" />
              <span>Campus Level 2 Architectural Blueprint</span>
              <span className="text-slate-400 font-normal">· Clean Grid Plan</span>
            </div>
            <div className="text-[11px] text-slate-400 font-sans">
              Click any space to view specs &amp; details
            </div>
          </div>

          {/* SVG Canvas Container */}
          <div className="p-4 sm:p-6 bg-[#fafafa] flex items-center justify-center overflow-x-auto min-h-[500px]">
            <svg
              viewBox="0 0 1020 530"
              className="w-full h-auto max-w-[980px] filter drop-shadow-sm select-none"
              style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #d1d5db' }}
            >
              <defs>
                {/* Graph paper grid matching user's diagram */}
                <pattern id="archGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="0.8" />
                </pattern>

                {/* Diagonal hatch pattern for Skylight Glass / Giếng trời */}
                <pattern id="skylightHatch" width="12" height="12" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="12" stroke="#cbd5e1" strokeWidth="1.2" />
                </pattern>

                {/* Dot pattern for Multipurpose Event Zones / Khu Đa Năng */}
                <pattern id="eventDots" width="14" height="14" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.2" fill="#cbd5e1" />
                </pattern>

                {/* Golden Amber Glow Filter for Highlighted Room */}
                <filter id="roomGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#f59e0b" floodOpacity="0.75" />
                </filter>
              </defs>

              {/* Grid Background */}
              <rect width="1020" height="530" fill="url(#archGrid)" />

              {/* Render Every Room and Zone */}
              {CAMPUS_ROOMS.map((room) => {
                const isSelected = selectedRoom?.id === room.id;
                const [x, y, w, h] = room.svgCoords;
                const [lx, ly] = room.labelCoords;

                // Special rendering for Skylights, Multipurpose, Elevator Shaft, WC
                const isSkylight = room.id === 'skylights';
                const isMultipurpose = room.id.includes('Multipurpose');
                const isElevatorShaft = room.id === 'Elevator Shaft';
                const isWC = room.id === 'WC';

                return (
                  <g
                    key={room.id}
                    onClick={() => handleSelectRoom(room)}
                    className="cursor-pointer transition-all duration-200"
                    filter={isSelected ? 'url(#roomGlow)' : undefined}
                  >
                    {/* Room Box (Monochrome white with crisp slate border) */}
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      fill={
                        isSelected
                          ? '#fef3c7'
                          : isSkylight
                          ? 'url(#skylightHatch)'
                          : isMultipurpose
                          ? 'url(#eventDots)'
                          : isElevatorShaft
                          ? '#f8fafc'
                          : '#ffffff'
                      }
                      stroke={isSelected ? '#f59e0b' : '#1e293b'}
                      strokeWidth={isSelected ? '3.5' : isMultipurpose ? '1.5' : '1.5'}
                      strokeDasharray={isMultipurpose && !isSelected ? '4 3' : undefined}
                      className="transition-colors duration-150 hover:bg-slate-50"
                    />

                    {/* Elevator Shaft: Non-classroom area with diagonal X cross-hatch (no text) */}
                    {isElevatorShaft && (
                      <g>
                        <line x1={x} y1={y} x2={x + w} y2={y + h} stroke={isSelected ? '#d97706' : '#94a3b8'} strokeWidth="1.2" />
                        <line x1={x + w} y1={y} x2={x} y2={y + h} stroke={isSelected ? '#d97706' : '#94a3b8'} strokeWidth="1.2" />
                      </g>
                    )}

                    {/* Skylight Inner Border & Sun Symbol */}
                    {isSkylight && (
                      <rect
                        x={x + 12}
                        y={y + 12}
                        width={w - 24}
                        height={h - 24}
                        fill="#ffffff"
                        fillOpacity="0.85"
                        stroke="#94a3b8"
                        strokeWidth="1"
                        strokeDasharray="4 2"
                      />
                    )}

                    {/* Room Label (rendered for all spaces except Elevator Shaft) */}
                    {!isElevatorShaft && (
                      <text
                        x={lx}
                        y={ly + 4}
                        textAnchor="middle"
                        fill={isSelected ? '#92400e' : '#0f172a'}
                        fontSize={
                          isMultipurpose
                            ? '11'
                            : isSkylight
                            ? '12'
                            : room.id.length > 8
                            ? '10.5'
                            : '13'
                        }
                        fontWeight="bold"
                        fontFamily="system-ui, -apple-system, sans-serif"
                        letterSpacing="0.2"
                      >
                        {room.id}
                      </text>
                    )}

                    {/* Subtitle for Skylight and Multipurpose (English) */}
                    {isSkylight && (
                      <text x={lx} y={ly + 20} textAnchor="middle" fontSize="9.5" fill="#64748b" fontWeight="600">
                        (Central Lightwell)
                      </text>
                    )}
                    {isMultipurpose && (
                      <text x={lx} y={ly + 20} textAnchor="middle" fontSize="9" fill="#64748b">
                        (Study Pods &amp; Event Booths)
                      </text>
                    )}

                    {/* Pulsing Pin Marker on Highlighted Room */}
                    {isSelected && (
                      <g transform={`translate(${lx - 12}, ${isElevatorShaft ? ly - 28 : ly - 42})`} className="animate-bounce">
                        <circle cx="12" cy="12" r="14" fill="#f59e0b" fillOpacity="0.3" />
                        <path
                          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                          fill="#d97706"
                        />
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Room Details Sidebar Panel (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {selectedRoom ? (
            <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm space-y-4 animate-in fade-in duration-200">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {selectedRoom.category}
                  </span>
                  <h2 className="text-xl font-bold text-slate-900 mt-1 font-mono">
                    {selectedRoom.name}
                  </h2>
                  <p className="text-xs text-slate-500">Location ID: {selectedRoom.id}</p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <MapPin className="w-5 h-5" />
                </div>
              </div>

              {/* Current Scheduled Class or Special Usage */}
              {selectedRoom.currentClass ? (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Scheduled Course</span>
                  </div>
                  <div className="font-semibold text-slate-900 text-sm">
                    {selectedRoom.currentClass.name}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Code: {selectedRoom.currentClass.code} · {selectedRoom.currentClass.time}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Instructor: <span className="font-medium text-slate-800">{selectedRoom.currentClass.lecturer}</span>
                  </div>
                </div>
              ) : selectedRoom.id.includes('Multipurpose') ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs space-y-1 text-blue-900">
                  <div className="font-semibold flex items-center gap-1">
                    <span>🎪 Multipurpose &amp; Event Space</span>
                  </div>
                  <p className="text-[11px] text-blue-700 leading-relaxed">
                    Open communal space surrounding the central atrium. Arranged with study desks daily; reconfigured for club booths and student exhibitions during university events.
                  </p>
                </div>
              ) : selectedRoom.id === 'skylights' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                  <div className="font-semibold">☀️ Central Skylights Atrium</div>
                  <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">
                    Central architectural lightwell providing natural illumination and open ventilation across all campus floors.
                  </p>
                </div>
              ) : selectedRoom.id === 'WC' ? (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700">
                  <div className="font-semibold">🚻 Level 2 Restrooms (WC)</div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Located along the central corridor between Room 201 and Room 205.
                  </p>
                </div>
              ) : selectedRoom.id === 'Elevator Shaft' ? (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700">
                  <div className="font-semibold flex items-center gap-1.5">
                    <span>🛗 Elevator Shaft &amp; Service Core</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Vertical transit shaft with dual passenger elevators serving all floors. Non-classroom service core.
                  </p>
                </div>
              ) : selectedRoom.id === '204' ? (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700">
                  <div className="font-semibold flex items-center gap-1.5">
                    <span>🏫 Classroom 204</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Standard lecture classroom situated directly adjacent to the campus elevator shaft.
                  </p>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-500">
                  Open study / Available space. No classes currently in session.
                </div>
              )}

              {/* Room Specifications */}
              <div className="space-y-2 text-xs">
                {selectedRoom.capacity > 0 && (
                  <div className="flex items-center justify-between py-1 border-b border-slate-100 text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>Capacity:</span>
                    </span>
                    <span className="font-semibold text-slate-900 font-mono">
                      {selectedRoom.capacity} seats
                    </span>
                  </div>
                )}

                <div className="pt-2">
                  <div className="text-xs font-semibold text-slate-800 mb-1.5">
                    Facilities &amp; Amenities:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedRoom.facilities.map((f, i) => (
                      <span
                        key={i}
                        className="text-[11px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action: Ask AI about this Room */}
              <button
                type="button"
                onClick={() => navigate(`/chat?q=Where+is+${encodeURIComponent(selectedRoom.id)}`)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-medium transition-colors shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                <span>Ask AcadAI About This Room</span>
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-xs text-slate-500">
              Select any room or area on the blueprint to view details.
            </div>
          )}

          {/* Sơ đồ thông tin hướng dẫn */}
          <div className="bg-slate-900 text-white rounded-xl p-4 text-xs space-y-2 shadow-xs">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <Info className="w-4 h-4 text-amber-400" />
              <span>Campus Map Navigation</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              When querying the AI Assistant in chat or the bottom-right bubble, clicking any room or zone will jump here and highlight it automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampusMapPage;
