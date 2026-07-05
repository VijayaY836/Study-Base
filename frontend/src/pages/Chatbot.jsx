import { useEffect, useRef, useState } from 'react'
import { post } from '../lib/api'

const GREETING = {
  role: 'assistant',
  content: "Hey! I'm Base, your study companion. I can see your tasks, grades, and mood — ask me what to focus on, or just say hi. 🌱",
}
const SUGGESTIONS = ['How am I doing?', 'What should I focus on today?', 'Motivate me']

export default function Chatbot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([GREETING])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy, open])

  const send = async (text) => {
    const content = (text ?? input).trim()
    if (!content || busy) return
    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setBusy(true)
    try {
      // send only the user/assistant turns (skip the local greeting)
      const history = next.filter((m, i) => !(i === 0 && m === GREETING))
        .map(({ role, content }) => ({ role, content }))
      const { reply } = await post('/api/chat', { messages: history })
      setMessages([...next, { role: 'assistant', content: reply }])
    } catch (err) {
      setMessages([...next, { role: 'assistant', content: "Sorry — I couldn't reach the server just then. Try again in a sec." }])
    }
    setBusy(false)
  }

  return (
    <>
      <button className={`chat-fab ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}>
        {open ? '✕' : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 20l1.1-5.4A8.5 8.5 0 1 1 21 11.5z"
              stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <circle cx="8.5" cy="11.5" r="1.1" fill="currentColor" />
            <circle cx="12" cy="11.5" r="1.1" fill="currentColor" />
            <circle cx="15.5" cy="11.5" r="1.1" fill="currentColor" />
          </svg>
        )}
      </button>

      {open && (
        <div className="chat-panel fade-in">
          <div className="chat-header">
            <span className="chat-avatar">🌱</span>
            <div>
              <div className="chat-name">Base</div>
              <div className="chat-status">your study companion</div>
            </div>
          </div>

          <div className="chat-body" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>{m.content}</div>
            ))}
            {busy && <div className="bubble assistant typing"><span></span><span></span><span></span></div>}
            {messages.length === 1 && (
              <div className="chat-suggest">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            )}
          </div>

          <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send() }}>
            <input value={input} onChange={e => setInput(e.target.value)}
              placeholder="Ask Base anything…" disabled={busy} />
            <button className="primary" disabled={busy || !input.trim()} aria-label="Send">➤</button>
          </form>
        </div>
      )}
    </>
  )
}