// Custom badge artwork. One hand-drawn SVG illustration per badge (shuttlecock,
// crossed rackets, flame...) on a dark plate, with the art breaking out past the plate edge
// like Apple's award badges. Colours come from the badge's hue; gradients give the 3D look.
import { useId, type ReactNode } from "react";
import type { BadgeDef } from "./catalog";

type Pal = (l: number, s?: number, a?: number) => string;

const star = (cx: number, cy: number, n: number, r1: number, r2: number) =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = (Math.PI * i) / n - Math.PI / 2;
    const r = i % 2 ? r2 : r1;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");

/** A gradient helper: `g("name", [[offset, colour], ...])` as a vertical linearGradient. */
const Grad = ({
  id,
  stops,
  x2 = 0,
  y2 = 1,
}: {
  id: string;
  stops: [number, string][];
  x2?: number;
  y2?: number;
}) => (
  <linearGradient id={id} x1="0" y1="0" x2={x2} y2={y2}>
    {stops.map(([o, c]) => (
      <stop key={o} offset={o} stopColor={c} />
    ))}
  </linearGradient>
);

const GOLD: [number, string][] = [
  [0, "#fff0a8"],
  [0.5, "#f5bd2b"],
  [1, "#c27d08"],
];

type Art = (p: { P: Pal; u: (s: string) => string; h: number }) => {
  defs?: ReactNode;
  body: ReactNode;
};

const ARTS: Record<string, Art> = {
  // Shuttlecock mid-flight with a speed trail
  regular: ({ P, u }) => ({
    defs: (
      <>
        <Grad
          id={u("a")}
          stops={[
            [0, "#ffffff"],
            [1, P(88, 40)],
          ]}
        />
        <Grad
          id={u("b")}
          stops={[
            [0, "#fff8ea"],
            [1, "#d9b27a"],
          ]}
        />
      </>
    ),
    body: (
      <>
        <path d="M112 24 L76 56 L70 46 Z" fill={P(74, 90, 0.9)} />
        <path d="M118 46 L82 72 L77 62 Z" fill={P(62, 90, 0.7)} />
        <path d="M104 8 L72 40 L68 33 Z" fill={P(84, 90, 0.6)} />
        <g transform="rotate(38 62 56)">
          <path d="M52 84 L32 28 Q62 17 92 28 L72 84 Z" fill={`url(#${u("a")})`} />
          {[36, 49, 62, 75, 88].map((x) => (
            <path
              key={x}
              d={`M${62 + (x - 62) * 0.2} 84 L${x} 25`}
              stroke={P(55, 50, 0.4)}
              strokeWidth="1.6"
            />
          ))}
          <path
            d="M32 28 Q62 17 92 28"
            stroke={P(52)}
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M34 33 Q62 22 90 33"
            stroke="#fff"
            strokeOpacity=".4"
            strokeWidth="1.5"
            fill="none"
          />
          <circle cx="62" cy="91" r="12" fill={`url(#${u("b")})`} />
          <ellipse cx="57" cy="86" rx="4.5" ry="3" fill="#fff" fillOpacity=".7" />
        </g>
      </>
    ),
  }),

  // Shield with a check
  "never-missed": ({ P, u }) => ({
    defs: (
      <Grad
        id={u("a")}
        stops={[
          [0, P(78)],
          [0.55, P(56)],
          [1, P(36)],
        ]}
      />
    ),
    body: (
      <>
        <path d="M60 6 L100 22 V58 Q100 94 60 112 Q20 94 20 58 V22 Z" fill={`url(#${u("a")})`} />
        <path d="M60 6 L20 22 V58 Q20 94 60 112 Z" fill="#fff" fillOpacity=".16" />
        <path
          d="M60 16 L91 28 V58 Q91 86 60 101 Q29 86 29 58 V28 Z"
          fill="none"
          stroke="#fff"
          strokeOpacity=".4"
          strokeWidth="2"
        />
        <path
          d="M39 62 L54 77 L83 44"
          stroke="#000"
          strokeOpacity=".25"
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform="translate(0 3)"
        />
        <path
          d="M39 62 L54 77 L83 44"
          stroke="#fff"
          strokeWidth="11"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ),
  }),

  // Layered flame with embers
  streak: ({ P, u, h }) => ({
    defs: (
      <>
        <Grad
          id={u("a")}
          stops={[
            [0, P(72)],
            [0.5, P(54)],
            [1, `hsl(${h - 18} 90% 38%)`],
          ]}
        />
        <Grad
          id={u("b")}
          stops={[
            [0, "#fff1a0"],
            [1, "#ffa72b"],
          ]}
        />
      </>
    ),
    body: (
      <>
        <path
          d="M60 4 C70 28 94 38 94 68 C94 92 78 110 60 110 C42 110 26 92 26 68 C26 50 38 42 42 30 C46 42 52 46 55 44 C58 32 54 18 60 4 Z"
          fill={`url(#${u("a")})`}
        />
        <path
          d="M60 46 C67 60 80 66 80 84 C80 97 71 104 60 104 C49 104 40 97 40 84 C40 68 54 62 60 46 Z"
          fill={`url(#${u("b")})`}
        />
        <ellipse cx="60" cy="93" rx="11" ry="9" fill="#fff6cf" fillOpacity=".95" />
        <path
          d="M36 70 C34 82 38 92 46 98"
          stroke="#fff"
          strokeOpacity=".45"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />
        {[
          [20, 38, 3],
          [100, 50, 2.5],
          [92, 18, 3.5],
          [14, 66, 2],
        ].map(([x, y, r]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r={r} fill={P(80)} fillOpacity=".85" />
        ))}
      </>
    ),
  }),

  // Sun rising over a hill, birds flying
  "early-bird": ({ P, u }) => ({
    defs: (
      <>
        <Grad
          id={u("a")}
          stops={[
            [0, "#fff0a0"],
            [1, P(56)],
          ]}
        />
        <Grad
          id={u("b")}
          stops={[
            [0, P(34)],
            [1, P(18)],
          ]}
        />
      </>
    ),
    body: (
      <>
        {Array.from({ length: 9 }, (_, i) => {
          const a = Math.PI + (Math.PI * (i + 0.5)) / 9;
          const c = Math.cos(a);
          const s = Math.sin(a);
          return (
            <path
              key={i}
              d={`M${60 + 44 * c} ${82 + 44 * s} L${60 + 58 * c} ${82 + 58 * s}`}
              stroke={P(78)}
              strokeWidth="4.5"
              strokeLinecap="round"
            />
          );
        })}
        <path d="M22 82 A38 38 0 0 1 98 82 Z" fill={`url(#${u("a")})`} />
        <path
          d="M32 78 A29 29 0 0 1 52 54"
          stroke="#fff"
          strokeOpacity=".6"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M4 108 Q60 66 116 108 V118 H4 Z" fill={`url(#${u("b")})`} />
        <path
          d="M80 34 q6 -8 12 0 q6 -8 12 0"
          stroke="#fff"
          strokeWidth="3.6"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M18 40 q4 -6 8 0 q4 -6 8 0"
          stroke="#fff"
          strokeOpacity=".8"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      </>
    ),
  }),

  // Crown
  champion: ({ u }) => ({
    defs: (
      <>
        <Grad id={u("a")} stops={GOLD} />
        <Grad
          id={u("b")}
          stops={[
            [0, "#f6c33f"],
            [1, "#a96806"],
          ]}
        />
      </>
    ),
    body: (
      <>
        <path d="M18 88 L10 36 L38 58 L60 22 L82 58 L110 36 L102 88 Z" fill={`url(#${u("a")})`} />
        <path
          d="M24 82 L17 48 L40 65"
          stroke="#fff"
          strokeOpacity=".55"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="18" y="86" width="84" height="16" rx="6" fill={`url(#${u("b")})`} />
        <circle cx="60" cy="94" r="5" fill="#ff4d6d" />
        <circle cx="36" cy="94" r="3.6" fill="#4dd2ff" />
        <circle cx="84" cy="94" r="3.6" fill="#4dd2ff" />
        {[
          [10, 36],
          [60, 22],
          [110, 36],
        ].map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r="6" fill="#fff4b8" />
        ))}
      </>
    ),
  }),

  // Podium steps with a star
  podium: ({ P, u }) => ({
    defs: (
      <>
        <Grad
          id={u("a")}
          stops={[
            [0, P(76)],
            [1, P(48)],
          ]}
        />
        <Grad
          id={u("b")}
          stops={[
            [0, P(66)],
            [1, P(38)],
          ]}
        />
        <Grad id={u("c")} stops={GOLD} />
      </>
    ),
    body: (
      <>
        <rect x="16" y="64" width="28" height="42" rx="3" fill={`url(#${u("b")})`} />
        <rect x="76" y="76" width="28" height="30" rx="3" fill={`url(#${u("b")})`} />
        <rect x="44" y="46" width="32" height="60" rx="3" fill={`url(#${u("a")})`} />
        <path
          d="M16 64 L22 58 H50 L44 64 Z M76 76 L82 70 H110 L104 76 Z M44 46 L50 40 H82 L76 46 Z"
          fill="#fff"
          fillOpacity=".35"
        />
        {[
          ["2", 30, 90],
          ["1", 60, 82],
          ["3", 90, 96],
        ].map(([t, x, y]) => (
          <text
            key={t}
            x={x}
            y={y}
            textAnchor="middle"
            fontSize="22"
            fontWeight="900"
            fill="#fff"
            fillOpacity=".95"
          >
            {t}
          </text>
        ))}
        <polygon points={star(60, 22, 5, 17, 7.5)} fill={`url(#${u("c")})`} />
        <path
          d="M54 18 L60 10"
          stroke="#fff"
          strokeOpacity=".7"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </>
    ),
  }),

  // Lightning bolt with speed lines
  "hot-hand": ({ P, u }) => ({
    defs: (
      <Grad
        id={u("a")}
        stops={[
          [0, "#fff39a"],
          [0.45, "#ffa534"],
          [1, P(46)],
        ]}
      />
    ),
    body: (
      <>
        {[
          [6, 38, 30],
          [2, 60, 26],
          [8, 82, 30],
        ].map(([x, y, w]) => (
          <path
            key={y}
            d={`M${x} ${y} H${x + w}`}
            stroke={P(76)}
            strokeOpacity=".75"
            strokeWidth="4"
            strokeLinecap="round"
          />
        ))}
        <path d="M72 2 L28 66 H54 L44 118 L98 46 H68 Z" fill={`url(#${u("a")})`} />
        <path d="M72 2 L28 66 H54 Z" fill="#fff" fillOpacity=".3" />
        <path d="M104 14 L96 26 H102 L99 38 L112 22 H105 Z" fill={P(80)} />
      </>
    ),
  }),

  // Two crossed rackets
  duo: ({ P, u }) => {
    const racket = (rot: number, grad: string, id: string) => (
      <g transform={`translate(60 64) rotate(${rot})`}>
        <clipPath id={u(id)}>
          <ellipse cx="0" cy="-26" rx="16" ry="21" />
        </clipPath>
        <ellipse cx="0" cy="-26" rx="16" ry="21" fill="#fff" fillOpacity=".12" />
        <g clipPath={`url(#${u(id)})`} stroke="#fff" strokeOpacity=".6" strokeWidth="1.2">
          {[-10, -5, 0, 5, 10].map((x) => (
            <path key={x} d={`M${x} -50 V-4`} />
          ))}
          {[-40, -33, -26, -19, -12].map((y) => (
            <path key={y} d={`M-18 ${y} H18`} />
          ))}
        </g>
        <ellipse
          cx="0"
          cy="-26"
          rx="16"
          ry="21"
          fill="none"
          stroke={`url(#${grad})`}
          strokeWidth="5"
        />
        <path
          d="M-7 -7 L-2.5 6 H2.5 L7 -7"
          fill="none"
          stroke={`url(#${grad})`}
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <rect x="-3.5" y="5" width="7" height="42" rx="3.5" fill={`url(#${grad})`} />
        <path
          d="M-3 16 L3 20 M-3 25 L3 29 M-3 34 L3 38"
          stroke="#000"
          strokeOpacity=".25"
          strokeWidth="1.6"
        />
      </g>
    );
    return {
      defs: (
        <>
          <Grad
            id={u("a")}
            stops={[
              [0, P(82)],
              [1, P(52)],
            ]}
          />
          <Grad
            id={u("b")}
            stops={[
              [0, P(62)],
              [1, P(34)],
            ]}
          />
        </>
      ),
      body: (
        <>
          {racket(-38, u("b"), "c1")}
          {racket(38, u("a"), "c2")}
          <polygon points={star(60, 58, 4, 11, 3.5)} fill="#fff" fillOpacity=".9" />
        </>
      ),
    };
  },

  // Trophy cup
  rally: ({ P, u }) => ({
    defs: (
      <>
        <Grad id={u("a")} stops={GOLD} />
        <Grad
          id={u("b")}
          stops={[
            [0, P(70)],
            [1, P(36)],
          ]}
        />
      </>
    ),
    body: (
      <>
        <path
          d="M34 22 H18 Q14 52 40 58"
          stroke={`url(#${u("a")})`}
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M86 22 H102 Q106 52 80 58"
          stroke={`url(#${u("a")})`}
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M32 10 H88 V44 Q88 78 60 82 Q32 78 32 44 Z" fill={`url(#${u("a")})`} />
        <path
          d="M40 16 V44 Q40 64 52 72"
          stroke="#fff"
          strokeOpacity=".5"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />
        <polygon points={star(62, 42, 5, 13, 5.5)} fill="#fff" fillOpacity=".85" />
        <rect x="53" y="80" width="14" height="14" fill="#c27d08" />
        <rect x="34" y="92" width="52" height="16" rx="5" fill={`url(#${u("b")})`} />
        <rect x="42" y="97" width="36" height="3" rx="1.5" fill="#fff" fillOpacity=".4" />
      </>
    ),
  }),

  // Two friends and a plus
  friend: ({ P, u }) => ({
    defs: (
      <>
        <Grad
          id={u("a")}
          stops={[
            [0, P(80)],
            [1, P(52)],
          ]}
        />
        <Grad
          id={u("b")}
          stops={[
            [0, P(62)],
            [1, P(36)],
          ]}
        />
      </>
    ),
    body: (
      <>
        <circle cx="76" cy="44" r="13" fill={`url(#${u("b")})`} />
        <path d="M50 104 Q50 64 76 64 Q102 64 102 104 Z" fill={`url(#${u("b")})`} />
        <circle cx="44" cy="48" r="15" fill={`url(#${u("a")})`} />
        <path d="M14 108 Q14 66 44 66 Q74 66 74 108 Z" fill={`url(#${u("a")})`} />
        <ellipse cx="39" cy="42" rx="5" ry="3.5" fill="#fff" fillOpacity=".5" />
        <circle cx="98" cy="26" r="15" fill="#fff" />
        <path d="M98 18 V34 M90 26 H106" stroke={P(46)} strokeWidth="5.5" strokeLinecap="round" />
      </>
    ),
  }),

  // Rosette with ribbons and a check
  reliable: ({ P, u }) => ({
    defs: (
      <>
        <Grad
          id={u("a")}
          stops={[
            [0, P(80)],
            [1, P(48)],
          ]}
        />
        <Grad
          id={u("b")}
          stops={[
            [0, P(58)],
            [1, P(30)],
          ]}
        />
      </>
    ),
    body: (
      <>
        <path d="M40 66 L26 114 L44 104 L54 118 L62 74 Z" fill={`url(#${u("b")})`} />
        <path
          d="M80 66 L94 114 L76 104 L66 118 L58 74 Z"
          fill={`url(#${u("b")})`}
          fillOpacity=".85"
        />
        <polygon points={star(60, 52, 14, 46, 40)} fill={`url(#${u("a")})`} />
        <circle
          cx="60"
          cy="52"
          r="30"
          fill={P(52)}
          fillOpacity=".5"
          stroke="#fff"
          strokeOpacity=".55"
          strokeWidth="2.5"
        />
        <path
          d="M45 53 L56 64 L76 40"
          stroke="#000"
          strokeOpacity=".22"
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          transform="translate(0 2.5)"
        />
        <path
          d="M45 53 L56 64 L76 40"
          stroke="#fff"
          strokeWidth="8.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M30 34 Q40 18 58 14"
          stroke="#fff"
          strokeOpacity=".5"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      </>
    ),
  }),

  // Seedling in a pot
  founder: ({ P, u }) => ({
    defs: (
      <>
        <Grad
          id={u("a")}
          stops={[
            [0, "#7ff0a0"],
            [1, "#1f9f55"],
          ]}
        />
        <Grad
          id={u("b")}
          stops={[
            [0, P(58)],
            [1, P(34)],
          ]}
        />
      </>
    ),
    body: (
      <>
        <path d="M61 78 V52" stroke="#1f9f55" strokeWidth="5" strokeLinecap="round" />
        <path d="M60 58 C38 58 24 46 26 24 C48 24 60 38 60 58 Z" fill={`url(#${u("a")})`} />
        <path d="M62 48 C64 26 80 12 102 16 C102 38 86 52 62 48 Z" fill={`url(#${u("a")})`} />
        <path
          d="M34 30 C42 34 50 42 55 52 M70 38 C80 32 90 26 98 22"
          stroke="#fff"
          strokeOpacity=".45"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M36 80 H84 L78 110 H42 Z" fill={`url(#${u("b")})`} />
        <rect x="32" y="72" width="56" height="12" rx="5" fill={P(66)} />
        <circle cx="16" cy="40" r="3" fill="#fff" fillOpacity=".8" />
        <circle cx="106" cy="62" r="2.5" fill="#fff" fillOpacity=".7" />
      </>
    ),
  }),
};

/** The badge artwork. `plate` adds the dark disc behind it (leave off for tiny uses). */
export function BadgeArt({
  b,
  size,
  plate = true,
  showArt = true,
  locked = false,
}: {
  b: BadgeDef;
  size: number;
  plate?: boolean;
  /** Turn off to draw just the plate (used to float the art in front of it) */
  showArt?: boolean;
  locked?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const u = (s: string) => `${uid}-${s}`;
  const h = b.hue;
  const P: Pal = (l, s = 85, a = 1) => `hsl(${h} ${s}% ${l}% / ${a})`;
  const { defs, body } = ARTS[b.id]({ P, u, h });
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      overflow="visible"
      aria-hidden
      style={locked ? { filter: "grayscale(1) brightness(.5)", opacity: 0.8 } : undefined}
    >
      <defs>
        {defs}
        <linearGradient id={u("rim")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5b5970" />
          <stop offset="1" stopColor="#14131a" />
        </linearGradient>
        <radialGradient id={u("plate")} cx="50%" cy="38%" r="65%">
          <stop offset="0" stopColor={P(30, 60)} />
          <stop offset="1" stopColor="#0d0c12" />
        </radialGradient>
        <filter id={u("shadow")} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000" floodOpacity=".5" />
        </filter>
      </defs>
      {plate && (
        <>
          <circle cx="60" cy="60" r="57" fill={`url(#${u("rim")})`} />
          <circle cx="60" cy="60" r="51" fill={`url(#${u("plate")})`} />
          <path
            d="M16 46 A46 46 0 0 1 104 46"
            stroke="#fff"
            strokeOpacity=".1"
            strokeWidth="2"
            fill="none"
          />
        </>
      )}
      {showArt && <g filter={`url(#${u("shadow")})`}>{body}</g>}
    </svg>
  );
}
