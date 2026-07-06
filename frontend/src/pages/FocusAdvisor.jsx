// Focus Advisor — a cross-course optimizer. For every course it computes how
// many points your OVERALL credit-weighted standing could still gain by acing
// the remaining (ungraded) work versus coasting at your current pace — then
// ranks them, so you know exactly where your next study hour pays off most.
// Pure, deterministic, no backend needed.

const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d

export default function FocusAdvisor({ courses = [], mood = null }) {
  const totalCred = courses.reduce((s, c) => s + (Number(c.credit_hours) || 1), 0) || 1

  const rows = courses.map(c => {
    const comps = c.components || []
    const graded = comps.filter(x => x.score_pct != null)
    const gradedWeight = graded.reduce((s, x) => s + Number(x.weight_pct), 0)
    const banked = graded.reduce((s, x) => s + (Number(x.weight_pct) * Number(x.score_pct)) / 100, 0)
    const ungradedWeight = comps.filter(x => x.score_pct == null).reduce((s, x) => s + Number(x.weight_pct), 0)
    const currentAvg = gradedWeight > 0 ? (banked / gradedWeight) * 100 : 0
    // overall-standing points still winnable here by acing the rest
    const upside = (ungradedWeight * (100 - currentAvg) / 100) * ((Number(c.credit_hours) || 1) / totalCred)
    return { name: c.name, currentAvg: round(currentAvg), ungradedWeight, upside: round(upside, 1) }
  })
    .filter(r => r.ungradedWeight > 0 && r.upside > 0)
    .sort((a, b) => b.upside - a.upside)

  if (rows.length === 0) return null

  const top = rows[0]
  const max = rows[0].upside || 1
  const lowMood = mood != null && mood < -0.1

  return (
    <div className="card focus-card">
      <div className="focus-head">
        <span className="focus-badge">🎯 Focus Advisor</span>
        <span className="chip">where your next study hour pays off most</span>
      </div>

      <p className="focus-lead">
        Put your energy into <b>{top.name}</b> next. You're tracking around <b>{top.currentAvg}%</b> there,
        and acing its remaining <b>{top.ungradedWeight}%</b> would add the most to your overall
        standing <b>(≈ +{top.upside} pts)</b>.
        {lowMood && (
          <span className="focus-soft"> Your mood's been a little low lately — start with one small
            session, not the whole thing. 💛</span>
        )}
      </p>

      <div className="focus-list">
        {rows.map(r => (
          <div className="focus-row" key={r.name}>
            <span className="focus-name">{r.name}</span>
            <span className="focus-bar"><span style={{ width: `${(r.upside / max) * 100}%` }} /></span>
            <span className="focus-val">+{r.upside}</span>
          </div>
        ))}
      </div>

      <div className="focus-note">
        Ranked by the points each course could still add to your <b>overall credit-weighted standing</b> —
        blending how much is ungraded, how you're currently doing, and the course's credit weight.
      </div>
    </div>
  )
}