import { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter, ZAxis, ReferenceLine, CartesianGrid, LabelList,
} from 'recharts'
import { get } from '../lib/api'

const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d
const TIP = {
  borderRadius: 12, border: '1px solid rgba(58,53,96,0.1)',
  fontFamily: 'DM Mono', fontSize: 12, boxShadow: '0 6px 20px rgba(58,53,96,0.12)',
}
const PALETTE = ['#e88a5d', '#8a6fd1', '#4b93c9', '#3f9d6e', '#c99a2e', '#e05c6e']

// core per-course analysis
function analyze(courses) {
  const totalCred = courses.reduce((s, c) => s + (Number(c.credit_hours) || 1), 0) || 1
  return courses.map((c, i) => {
    const comps = c.components || []
    const graded = comps.filter(x => x.score_pct != null)
    const gradedWeight = graded.reduce((s, x) => s + Number(x.weight_pct), 0)
    const banked = graded.reduce((s, x) => s + (Number(x.weight_pct) * Number(x.score_pct)) / 100, 0)
    const ungradedWeight = comps.filter(x => x.score_pct == null).reduce((s, x) => s + Number(x.weight_pct), 0)
    const currentAvg = gradedWeight > 0 ? (banked / gradedWeight) * 100 : 0
    const credit = Number(c.credit_hours) || 1
    const share = credit / totalCred
    // full-scale course % if you bomb (floor) vs ace (ceiling) the remaining work
    const floor = banked
    const ceil = banked + ungradedWeight
    // overall-standing points still winnable by acing rest vs coasting at current pace
    const upside = round((ungradedWeight * (100 - currentAvg) / 100) * share, 1)
    return {
      id: c.id, name: c.name, scale: c.scale, credit, share: round(share * 100, 1),
      currentAvg: round(currentAvg), ungradedWeight, floor: round(floor), ceil: round(ceil),
      range: round(ceil - floor), upside, hasRemaining: ungradedWeight > 0, components: comps,
    }
  })
}

export default function Focus() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [whatIf, setWhatIf] = useState(70)   // hypothetical score on remaining work

  useEffect(() => {
    get('/api/courses').then(cs => { setCourses(cs); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const rows = useMemo(() => analyze(courses), [courses])
  const ranked = useMemo(
    () => rows.filter(r => r.hasRemaining && r.upside > 0).sort((a, b) => b.upside - a.upside),
    [rows])

  // credit-weighted overall standing if every ungraded component scored `whatIf`
  const projected = useMemo(() => {
    const withRemaining = rows.filter(r => r.ungradedWeight > 0)
    if (rows.length === 0) return null
    const totalCred = rows.reduce((s, r) => s + r.credit, 0)
    const overall = rows.reduce((s, r) => {
      const projFinal = r.floor + (r.ungradedWeight * whatIf) / 100  // banked + remaining@whatIf
      const anchor = r.ungradedWeight > 0 ? projFinal : r.currentAvg  // fully-graded → keep standing
      return s + anchor * r.credit
    }, 0) / totalCred
    return { overall: round(overall), affected: withRemaining.length }
  }, [rows, whatIf])

  if (loading) return <div className="empty" style={{ marginTop: 40 }}>Crunching your courses…</div>

  if (ranked.length === 0) {
    return (
      <>
        <Head />
        <div className="empty" style={{ marginTop: 20 }}>
          Add some courses with ungraded components on the <b>GPA</b> tab, and the Focus Advisor
          will tell you exactly where to spend your study time.
        </div>
      </>
    )
  }

  const top = ranked[0]
  const maxUpside = ranked[0].upside || 1
  const rangeData = rows.filter(r => r.hasRemaining).map(r => ({
    name: r.name.length > 14 ? r.name.slice(0, 13) + '…' : r.name,
    floor: r.floor, gap: r.range, ceil: r.ceil, current: r.currentAvg,
  }))
  const scatter = ranked.map((r, i) => ({
    name: r.name, x: r.ungradedWeight, y: r.upside, z: r.credit, fill: PALETTE[i % PALETTE.length],
  }))

  return (
    <>
      <Head />

      {/* headline recommendation */}
      <div className="card focus-card">
        <div className="focus-head">
          <span className="focus-badge">🎯 Study this next</span>
          <span className="chip">ranked by GPA payoff</span>
        </div>
        <p className="focus-lead">
          Put your energy into <b>{top.name}</b>. You're tracking around <b>{top.currentAvg}%</b> there,
          and acing its remaining <b>{top.ungradedWeight}%</b> would add the most to your overall
          standing <b>(≈ +{top.upside} pts)</b>.
        </p>
        <div className="focus-list">
          {ranked.map(r => (
            <div className="focus-row" key={r.id}>
              <span className="focus-name">{r.name}</span>
              <span className="focus-bar"><span style={{ width: `${(r.upside / maxUpside) * 100}%` }} /></span>
              <span className="focus-val">+{r.upside}</span>
            </div>
          ))}
        </div>
        <div className="focus-note">
          Ranked by the points each course could still add to your <b>overall credit-weighted standing</b> —
          blending how much is ungraded, how you're currently doing, and the course's credit weight.
        </div>
      </div>

      <div className="grid two" style={{ marginTop: 18 }}>
        {/* floor vs ceiling range */}
        <div className="card">
          <div className="dash-cardhead">
            <h3>Where each grade could land</h3><span className="chip">floor → ceiling</span>
          </div>
          <p className="focus-subnote">The bar spans your <b>guaranteed floor</b> (if you score 0 on what's
            left) to your <b>best-case ceiling</b> (if you ace it). A longer bar = more still in your hands.</p>
          <ResponsiveContainer width="100%" height={Math.max(180, rangeData.length * 52)}>
            <BarChart data={rangeData} layout="vertical" margin={{ top: 4, right: 20, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(58,53,96,0.06)" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontFamily: 'DM Mono', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={92} tick={{ fontFamily: 'DM Mono', fontSize: 11 }} />
              <Tooltip contentStyle={TIP}
                formatter={(v, n) => n === 'gap' ? null : [`${v}%`, n === 'floor' ? 'guaranteed floor' : n]}
                cursor={{ fill: 'rgba(58,53,96,0.04)' }} />
              <Bar dataKey="floor" stackId="a" fill="#cdeedd" radius={[6, 0, 0, 6]} />
              <Bar dataKey="gap" stackId="a" fill="#f98d77" radius={[0, 6, 6, 0]}>
                <LabelList dataKey="ceil" position="right" formatter={(v) => `${v}%`}
                  style={{ fontFamily: 'DM Mono', fontSize: 11, fill: 'var(--ink-soft)' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="focus-legend">
            <span><span className="sw" style={{ background: '#cdeedd' }} /> locked-in floor</span>
            <span><span className="sw" style={{ background: '#f98d77' }} /> still up for grabs</span>
          </div>
        </div>

        {/* effort vs payoff */}
        <div className="card">
          <div className="dash-cardhead">
            <h3>Effort vs. payoff</h3><span className="chip">bubble = credits</span>
          </div>
          <p className="focus-subnote">Further right = more ungraded work remaining. Higher up = more it
            lifts your <b>overall</b> GPA. Chase the <b>top-right</b> bubbles first.</p>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 10, right: 18, bottom: 20, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(58,53,96,0.06)" />
              <XAxis type="number" dataKey="x" name="ungraded" unit="%" domain={[0, 100]}
                tick={{ fontFamily: 'DM Mono', fontSize: 11 }}
                label={{ value: 'work remaining (%)', position: 'insideBottom', offset: -10, fontFamily: 'DM Mono', fontSize: 11 }} />
              <YAxis type="number" dataKey="y" name="payoff"
                tick={{ fontFamily: 'DM Mono', fontSize: 11 }}
                label={{ value: 'GPA payoff', angle: -90, position: 'insideLeft', offset: 18, fontFamily: 'DM Mono', fontSize: 11 }} />
              <ZAxis type="number" dataKey="z" range={[120, 520]} name="credits" />
              <Tooltip contentStyle={TIP} cursor={{ strokeDasharray: '3 3' }}
                formatter={(v, n) => [n === 'ungraded' ? `${v}%` : n === 'credits' ? `${v} cr` : `+${v} pts`, n]}
                labelFormatter={() => ''} />
              <Scatter data={scatter}>
                {scatter.map((e, i) => <Cell key={i} fill={e.fill} fillOpacity={0.7} />)}
                <LabelList dataKey="name" position="top"
                  style={{ fontFamily: 'DM Mono', fontSize: 10, fill: 'var(--ink-soft)' }} />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* interactive what-if */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="dash-cardhead">
          <h3>What if you score…</h3><span className="chip">live projection</span>
        </div>
        <p className="focus-subnote">Drag to imagine scoring the same on <b>every</b> remaining component,
          and watch your projected overall standing update live.</p>
        <div className="whatif">
          <input type="range" min="0" max="100" step="1" value={whatIf}
            onChange={e => setWhatIf(Number(e.target.value))} className="whatif-slider" />
          <div className="whatif-readout">
            <div className="whatif-score">{whatIf}%</div>
            <div className="whatif-arrow">→</div>
            <div className="whatif-proj">
              <span className="whatif-num">{projected ? projected.overall : '—'}%</span>
              <span className="whatif-cap">projected overall standing</span>
            </div>
          </div>
        </div>
        <div className="whatif-marks">
          {[0, 25, 50, 75, 100].map(m => (
            <button key={m} className={`whatif-mark ${whatIf === m ? 'on' : ''}`} onClick={() => setWhatIf(m)}>{m}</button>
          ))}
        </div>
        <div className="focus-note">
          Applies your hypothetical score to every ungraded component across
          {projected ? ` ${projected.affected}` : ''} course{projected && projected.affected === 1 ? '' : 's'},
          then recomputes your credit-weighted standing.
        </div>
      </div>
    </>
  )
}

function Head() {
  return (
    <div className="pagehead" style={{ '--tape': 'var(--coral)' }}>
      <h2>Focus Advisor</h2>
      <p>Where should your next study hour go? StudyBase does the math across every course
        and tells you exactly where effort turns into the biggest GPA gain.</p>
    </div>
  )
}