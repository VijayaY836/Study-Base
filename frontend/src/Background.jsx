// Ambient animated background — drifting pastel gradient blobs + floating
// stationery doodles. Pure CSS/SVG, no dependencies. Sits behind everything,
// ignores pointer events, and freezes under prefers-reduced-motion.

const SHAPES = {
  star: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%">
      <path d="M12 2l2.5 6.9H21l-5.4 4 2 6.9L12 15.9 6.4 19.8l2-6.9L3 8.9h6.5z" fill={c} />
    </svg>
  ),
  ring: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%">
      <circle cx="12" cy="12" r="8" fill="none" stroke={c} strokeWidth="2.4" />
    </svg>
  ),
  plus: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%">
      <path d="M12 4v16M4 12h16" stroke={c} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  ),
  squiggle: (c) => (
    <svg viewBox="0 0 44 12" width="100%" height="100%">
      <path d="M2 6 Q7 0 12 6 T22 6 T32 6 T42 6" fill="none" stroke={c}
        strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  ),
  sparkle: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%">
      <path d="M12 2c0 5.5-4.5 10-10 10 5.5 0 10 4.5 10 10 0-5.5 4.5-10 10-10-5.5 0-10-4.5-10-10z" fill={c} />
    </svg>
  ),
  dot: (c) => (
    <svg viewBox="0 0 24 24" width="100%" height="100%"><circle cx="12" cy="12" r="5" fill={c} /></svg>
  ),
}

// hand-placed spread so it feels organic, not gridded
const DOODLES = [
  { s: 'star',     c: 'var(--butter-deep)', t: '8%',  l: '6%',  z: 26, d: 22, delay: 0,   r: '18deg',  op: 0.5 },
  { s: 'ring',     c: 'var(--sky-deep)',    t: '15%', l: '84%', z: 30, d: 28, delay: 2,   r: '-14deg', op: 0.4 },
  { s: 'squiggle', c: 'var(--coral)',       t: '26%', l: '18%', z: 40, d: 25, delay: 1.5, r: '10deg',  op: 0.35 },
  { s: 'plus',     c: 'var(--mint-deep)',   t: '32%', l: '70%', z: 22, d: 20, delay: 3,   r: '20deg',  op: 0.45 },
  { s: 'sparkle',  c: 'var(--lilac-deep)',  t: '44%', l: '90%', z: 24, d: 24, delay: 0.5, r: '-16deg', op: 0.5 },
  { s: 'dot',      c: 'var(--peach-deep)',  t: '52%', l: '10%', z: 18, d: 18, delay: 2.5, r: '0deg',   op: 0.5 },
  { s: 'ring',     c: 'var(--lilac-deep)',  t: '60%', l: '78%', z: 28, d: 30, delay: 1,   r: '12deg',  op: 0.35 },
  { s: 'star',     c: 'var(--coral)',       t: '70%', l: '30%', z: 22, d: 23, delay: 3.5, r: '-18deg', op: 0.4 },
  { s: 'squiggle', c: 'var(--sky-deep)',    t: '78%', l: '60%', z: 42, d: 27, delay: 0.8, r: '-8deg',  op: 0.35 },
  { s: 'plus',     c: 'var(--butter-deep)', t: '86%', l: '14%', z: 24, d: 21, delay: 2.2, r: '16deg',  op: 0.45 },
  { s: 'sparkle',  c: 'var(--mint-deep)',   t: '88%', l: '88%', z: 22, d: 26, delay: 1.2, r: '14deg',  op: 0.45 },
  { s: 'dot',      c: 'var(--sky-deep)',    t: '6%',  l: '46%', z: 16, d: 19, delay: 3.2, r: '0deg',   op: 0.4 },
  { s: 'ring',     c: 'var(--peach-deep)',  t: '40%', l: '40%', z: 20, d: 29, delay: 2.8, r: '-12deg', op: 0.28 },
  { s: 'star',     c: 'var(--lilac-deep)',  t: '66%', l: '50%', z: 18, d: 22, delay: 1.8, r: '22deg',  op: 0.32 },
]

export default function Background() {
  return (
    <div className="bg-layer" aria-hidden="true">
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
      {DOODLES.map((d, i) => (
        <span
          key={i}
          className="doodle"
          style={{
            top: d.t, left: d.l, width: d.z, height: d.z, opacity: d.op,
            '--dur': `${d.d}s`, '--delay': `${d.delay}s`, '--rot': d.r,
          }}
        >
          {SHAPES[d.s](d.c)}
        </span>
      ))}
    </div>
  )
}