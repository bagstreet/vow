import { useState, useEffect, useRef } from 'react'
import { Dumbbell, Pill, Apple, Heart, BookOpen, Shield, Link2, Key, FileCheck, RotateCcw, Settings, ChevronDown, Send, Mic, Bell, MessageCircle, Smartphone, Monitor, Copy, Check, ArrowUp, X, ChevronRight, Globe, Hash } from 'lucide-react'
import { api } from './lib/api'
/* TODO #14-16: Record 10+ mainnet blobs, add "Verify on Walruscan" button with real blob ID, before/after evidence */
/* TODO #19: Add tool-calling visualization (how bot decides remember vs recall) when LLM backend is connected */

/* ── Vow Logo SVG (approved wordmark, light version for dark bg) ── */
function VowLogo({ height = 24 }: { height?: number }) {
  const w = height * (464.84 / 220)
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 464.84 220" width={w} height={height}>
      <path d="M108.52 148.22L134.56 84.62C136.72 79.22 138.64 76.70 141.28 75.50L146.20 73.10L146.20 68.90L117.04 68.90L117.04 73.10L121.48 74.90C124.48 76.10 125.44 77.06 125.44 79.10C125.44 80.42 124.96 82.10 124 84.50L108.52 125.90L91 83.66C90.16 81.74 89.80 80.54 89.80 79.34C89.80 77.42 91 76.46 93.76 75.02L97.60 73.10L97.60 68.90L58.24 68.90L58.24 73.10L62.08 75.26C65.08 76.94 65.80 77.54 68.44 83.66L98.68 152.30M188.44 152.30C212.56 152.30 230.56 134.30 230.56 109.94C230.56 83.42 214.96 67.82 188.44 67.82C164.68 67.82 146.32 86.18 146.32 109.94C146.32 136.70 161.80 152.30 188.44 152.30M188.44 143.54C176.32 143.54 167.80 129.38 167.80 110.06C167.80 90.74 176.32 76.58 188.44 76.58C200.56 76.58 209.08 90.74 209.08 110.06C209.08 129.38 200.56 143.54 188.44 143.54M274.96 148.58L293.32 97.46L314.68 152.30L322.48 148.58L345.28 84.62C346.84 80.06 349.24 76.70 351.76 75.50L356.80 73.10L356.80 68.90L328.36 68.90L328.36 73.10L332.80 74.90C335.80 76.10 336.76 77.06 336.76 79.10C336.76 80.42 336.16 82.10 335.32 84.50L322.96 120.98L303.64 68.90L294.52 71.18L276.16 121.34L263.68 83.66C263.08 81.74 262.72 80.42 262.72 79.22C262.72 77.30 263.80 76.34 266.44 75.02L270.28 73.10L270.28 68.90L231.88 68.90L231.88 73.10L235.72 75.26C238.96 76.94 240.28 78.62 242.08 83.66L266.32 152.30" fill={T.text}/>
      <circle cx="388.24" cy="144.5" r="18.6" fill="none" stroke={T.accentHex} strokeWidth="6"/>
      <circle cx="388.24" cy="144.5" r="7.8" fill={T.accentHex}/>
    </svg>
  )
}

/* ── Animated favicon ── */
/* Badge mode: bouncing red "1". Idle mode: pulsing morph (inner dot expands to fill ring, shrinks back) */
function useAnimatedFavicon(showBadge: boolean) {
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 64; canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement || document.createElement('link')
    link.rel = 'icon'; link.type = 'image/png'
    if (!link.parentNode) document.head.appendChild(link)
    let frame = 0
    const cx = 32, cy = 32, outerR = 24, innerR = 8
    const draw = () => {
      ctx.clearRect(0,0,64,64)
      if (showBadge) {
        ctx.beginPath(); ctx.arc(26,34,20,0,Math.PI*2); ctx.strokeStyle='#0E9C86'; ctx.lineWidth=4; ctx.stroke()
        ctx.beginPath(); ctx.arc(26,34,7,0,Math.PI*2); ctx.fillStyle='#0E9C86'; ctx.fill()
        const bounce = Math.abs(Math.sin(frame*0.12))*3
        const bx=50, by=14-bounce
        ctx.beginPath(); ctx.arc(bx,by,12,0,Math.PI*2); ctx.fillStyle='#ef4444'; ctx.fill()
        ctx.strokeStyle='#020303'; ctx.lineWidth=2; ctx.stroke()
        ctx.fillStyle='#fff'; ctx.font='bold 15px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'
        ctx.fillText('1',bx,by+1)
      } else {
        const cycle=120, t=(frame%cycle)/cycle
        let fillR:number, ringOp:number
        if(t<0.4){const p=t/0.4,e=p*p*(3-2*p); fillR=innerR+(outerR-innerR)*e; ringOp=1-e}
        else if(t<0.6){fillR=outerR; ringOp=0}
        else{const p=(t-0.6)/0.4,e=p*p*(3-2*p); fillR=outerR-(outerR-innerR)*e; ringOp=e}
        if(ringOp>0.01){ctx.globalAlpha=ringOp; ctx.beginPath(); ctx.arc(cx,cy,outerR,0,Math.PI*2); ctx.strokeStyle='#0E9C86'; ctx.lineWidth=4; ctx.stroke(); ctx.globalAlpha=1}
        ctx.beginPath(); ctx.arc(cx,cy,fillR,0,Math.PI*2); ctx.fillStyle='#0E9C86'; ctx.fill()
      }
      link.href = canvas.toDataURL('image/png')
      frame++
    }
    draw()
    const interval = setInterval(draw, showBadge ? 80 : 33)
    return () => clearInterval(interval)
  }, [showBadge])
}

/* ── Chat widget popup ── */
function ChatWidget({ onDismiss }: { onDismiss: () => void }) {
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    if (dismissed) return
    const t = setTimeout(() => setShow(true), 4000)
    return () => clearTimeout(t)
  }, [dismissed])
  const close = () => { setShow(false); setDismissed(true); onDismiss() }
  if (!show) return null
  return (
    <div className="fixed bottom-6 right-6 z-[60] animate-[slideUp_0.4s_ease]" style={{maxWidth:320}}>
      <div className="rounded-2xl overflow-hidden shadow-2xl" style={{background:T.surface, border:`1px solid ${T.borderVis}`}}>
        <div className="flex items-center gap-2 px-4 py-2.5" style={{background:T.raised, borderBottom:`1px solid ${T.border}`}}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{background:T.accent}}>
            <MessageCircle size={12} color="#000" />
          </div>
          <span className="text-xs font-semibold flex-1" style={{color:T.text}}>Vow Bot</span>
          <button onClick={close} className="p-2 rounded cursor-pointer hover:bg-white/10"><X size={16} style={{color:T.textMuted}}/></button>
        </div>
        <div className="p-4">
          <div className="px-3 py-2 rounded-xl rounded-bl-sm mb-3 text-sm" style={{background:T.recessed, border:`1px solid ${T.border}`, color:T.textSec}}>
            Ready to start tracking? Pick a preset and I will remind you, seal your check-ins, and keep your streak honest.
          </div>
          <div className="flex gap-2">
            <a href="#signin" onClick={close} className="flex-1 text-center py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:brightness-110" style={{background:T.accent, color:'#000'}}>
              Let&#39;s go
            </a>
            <button onClick={close} className="flex-1 py-2 rounded-lg text-xs font-semibold border cursor-pointer hover:bg-white/5" style={{borderColor:T.border, color:T.textMuted}}>
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── FadeIn on scroll ── */
function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode, delay?: number, className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.15 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

/* ── Design tokens (single source of truth, mirrors CSS vars) ── */
const T = {
  accent: 'var(--accent, #0E9C86)', accentHex: '#0E9C86', accentLight: '#14b89e',
  bg: 'var(--bg, #020303)', shell: 'var(--shell, #060707)',
  recessed: 'var(--recessed, #08090a)', surface: 'var(--surface, #101214)',
  raised: 'var(--raised, rgba(25,29,31,0.82))', active: 'var(--active, rgba(34,38,41,0.82))',
  text: 'var(--text, #f3f5f6)', textSec: 'var(--text-sec, #b7bdc1)', textMuted: 'var(--text-muted, #a1a9ae)',
  border: 'var(--border, rgba(231,239,244,0.09))', borderVis: 'var(--border-vis, rgba(231,239,244,0.18))',
} as const

/* ── #3: Particles background (lightweight canvas, no deps) ── */
function ParticlesBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) return
    let raf: number
    const dpr = window.devicePixelRatio || 1
    const resize = () => { canvas.width = canvas.offsetWidth * dpr; canvas.height = canvas.offsetHeight * dpr; ctx.scale(dpr, dpr) }
    resize()
    window.addEventListener('resize', resize)
    const N = 35
    const dots = Array.from({ length: N }, () => ({
      x: Math.random() * canvas.offsetWidth,
      y: Math.random() * canvas.offsetHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: 1 + Math.random() * 1.5,
    }))
    const draw = () => {
      const w = canvas.offsetWidth, h = canvas.offsetHeight
      ctx.clearRect(0, 0, w, h)
      for (const d of dots) {
        d.x += d.vx; d.y += d.vy
        if (d.x < 0 || d.x > w) d.vx *= -1
        if (d.y < 0 || d.y > h) d.vy *= -1
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(14,156,134,0.15)'; ctx.fill()
      }
      // Draw links
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const dx = dots[i].x - dots[j].x, dy = dots[i].y - dots[j].y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 150) {
          ctx.beginPath(); ctx.moveTo(dots[i].x, dots[i].y); ctx.lineTo(dots[j].x, dots[j].y)
          ctx.strokeStyle = `rgba(14,156,134,${0.06 * (1 - dist / 150)})`; ctx.lineWidth = 1; ctx.stroke()
        }
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ opacity: 0.8 }} />
}

/* ── #5: SVG Workflow Diagram ── */
function WorkflowDiagram() {
  return (
    <div className="mx-auto max-w-3xl mb-8" role="img" aria-label="Vow workflow: User sends message, Bot processes it, Chain hashes and seals, Walrus stores blob, Receipt returned">
      <svg viewBox="0 0 800 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
        {/* Connecting lines */}
        <line x1="140" y1="50" x2="220" y2="50" stroke="#0E9C86" strokeWidth="2" strokeDasharray="6 3" opacity="0.4" />
        <line x1="340" y1="50" x2="420" y2="50" stroke="#0E9C86" strokeWidth="2" strokeDasharray="6 3" opacity="0.4" />
        <line x1="540" y1="50" x2="620" y2="50" stroke="#0E9C86" strokeWidth="2" strokeDasharray="6 3" opacity="0.4" />
        {/* Arrow heads */}
        <polygon points="220,45 220,55 230,50" fill="#0E9C86" opacity="0.5" />
        <polygon points="420,45 420,55 430,50" fill="#0E9C86" opacity="0.5" />
        <polygon points="620,45 620,55 630,50" fill="#0E9C86" opacity="0.5" />
        {/* Node 1: User */}
        <rect x="20" y="20" width="120" height="60" rx="12" fill="#101214" stroke="rgba(231,239,244,0.09)" strokeWidth="1.5" />
        <text x="80" y="42" textAnchor="middle" fill="#f3f5f6" fontSize="11" fontWeight="600" fontFamily="Instrument Sans, system-ui">User</text>
        <text x="80" y="58" textAnchor="middle" fill="#a1a9ae" fontSize="9" fontFamily="Instrument Sans, system-ui">check-in / voice</text>
        {/* Node 2: Bot */}
        <rect x="230" y="20" width="120" height="60" rx="12" fill="#101214" stroke="#0E9C86" strokeWidth="1.5" opacity="0.8" />
        <text x="290" y="42" textAnchor="middle" fill="#0E9C86" fontSize="11" fontWeight="600" fontFamily="Instrument Sans, system-ui">Vow Bot</text>
        <text x="290" y="58" textAnchor="middle" fill="#a1a9ae" fontSize="9" fontFamily="Instrument Sans, system-ui">parse + validate</text>
        {/* Node 3: Chain */}
        <rect x="430" y="20" width="120" height="60" rx="12" fill="#101214" stroke="rgba(231,239,244,0.09)" strokeWidth="1.5" />
        <text x="490" y="42" textAnchor="middle" fill="#f3f5f6" fontSize="11" fontWeight="600" fontFamily="Instrument Sans, system-ui">Hash Chain</text>
        <text x="490" y="58" textAnchor="middle" fill="#a1a9ae" fontSize="9" fontFamily="Instrument Sans, system-ui">SHA-256 append</text>
        {/* Node 4: Walrus */}
        <rect x="630" y="20" width="150" height="60" rx="12" fill="#101214" stroke="#0E9C86" strokeWidth="1.5" opacity="0.8" />
        <text x="705" y="42" textAnchor="middle" fill="#0E9C86" fontSize="11" fontWeight="600" fontFamily="Instrument Sans, system-ui">Walrus Memory</text>
        <text x="705" y="58" textAnchor="middle" fill="#a1a9ae" fontSize="9" fontFamily="Instrument Sans, system-ui">blob sealed + receipt</text>
      </svg>
    </div>
  )
}

/* ── Presets (order matches "Five presets" section) ── */
const PRESETS = [
  { id: 'habits', Icon: Dumbbell, label: 'Health & Fitness', color: '#22c55e', img: '/mascots/fitness.png',
    pitch: 'Track workouts and nutrition with on-chain accountability. Your gym buddy that never skips leg day.',
    botMsg: 'Morning run time! Did you go today?', buttons: ['Done, 5km', 'Skipped', 'Modified'],
    features: ['Configurable reminders (7am, 7pm)', 'Rest day rules', 'Voice check-in', 'Streak heatmap'],
    commands: ['/checkin', '/streak', '/correct', '/rest'],
    platform: 'web' as const },
  { id: 'medication', Icon: Pill, label: 'Medication Tracker', color: '#f59e0b', img: '/mascots/medication.png',
    pitch: 'Never miss a dose. Cryptographic proof that you took your meds, visible to your care team.',
    botMsg: 'Time for evening meds! Vitamin D + Omega-3', buttons: ['Taken', 'Skip', 'Snooze 1h'],
    features: ['Cross-channel delivery (TG > Slack > Push)', 'Drug interaction checks', 'Doctor visit log', 'Refill reminders'],
    commands: ['/take', '/skip', '/interactions', '/refill'],
    platform: 'telegram' as const },
  { id: 'nutrition', Icon: Apple, label: 'Nutritionist', color: '#ef4444', img: '/mascots/nutrition.png',
    pitch: 'Every sober day recorded and verifiable. Build streaks that no one, not even you, can fake.',
    botMsg: 'Daily check-in time. How are you feeling?', buttons: ['Sober today', 'Need support', 'Log journal'],
    features: ['Daily accountability check-in', 'Streak verification on-chain', 'Support contact alerts', 'Journal with receipts'],
    commands: ['/sober', '/journal', '/support', '/streak'],
    platform: 'slack' as const },
  { id: 'health', Icon: Heart, label: 'Health Companion', color: '#ec4899', img: '/mascots/health.png',
    pitch: 'Daily check-ins, symptom logs, and wellness scores, all tamper-proof and shareable with care providers.',
    botMsg: 'Day 30 (usually 28). Everything OK?', buttons: ['Yes, fine', 'Log symptom', 'Call doctor'],
    features: ['Cycle prediction from history', 'Late period alerts', 'Symptom pattern analysis', 'Encrypted doctor-ready export'],
    commands: ['/log-symptom', '/predict-next', '/alert-if-late', '/remind-before'],
    platform: 'telegram' as const },
  { id: 'learning', Icon: BookOpen, label: 'Study & Exam', color: '#8b5cf6', img: '/mascots/study.png',
    pitch: 'Commit to study blocks, track progress, and prove consistency to mentors or scholarship boards.',
    botMsg: 'Study session? You have 2h left on "React hooks" this week.', buttons: ['Start now', 'Later', 'Done for today'],
    features: ['Deadline-aware goals', 'Nudge if missed', 'Progress visualization', 'Study group sync'],
    commands: ['/study-start', '/study-done', '/progress', '/nudge-if-missed'],
    platform: 'discord' as const },
]

/* ═══ Block 1: Nav ═══ */
/* #7 fix: no border flicker on scroll start — use box-shadow instead of borderBottom */
function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('')
  useEffect(() => {
    const h = () => {
      setScrolled(window.scrollY > 60)
      // Detect active section
      const sections = ['roles','demo','architecture','deploy','faq','signin']
      let current = ''
      for (const id of sections) {
        const el = document.getElementById(id)
        if (el) {
          const rect = el.getBoundingClientRect()
          if (rect.top <= 150) current = id
        }
      }
      setActiveSection(current)
    }
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])
  const links = ['Roles','Demo','Architecture','Deploy','FAQ']
  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'py-1' : 'py-3'}`}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl transition-all duration-300"
          style={{
            background: scrolled ? 'rgba(6,7,7,0.95)' : 'transparent',
            backdropFilter: scrolled ? 'blur(16px)' : 'none',
            boxShadow: scrolled ? `0 1px 0 0 ${T.border}` : 'none',
          }}>
          <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => window.scrollTo({top:0,behavior:'smooth'})}>
            <VowLogo height={22} />
            <span className="hidden sm:inline text-[9px] font-mono px-1.5 py-0.5 rounded-full ml-1" style={{ border: `1px solid ${T.border}`, color: T.textMuted }}>mainnet</span>
          </div>
          <div className="hidden md:flex items-center gap-5">
            {links.map(l => {
              const isActive = activeSection === l.toLowerCase()
              return <a key={l} href={`#${l.toLowerCase()}`} className="text-sm cursor-pointer transition-colors relative pb-0.5"
                style={{ color: isActive ? T.accent : T.textMuted }}>
                {l}
                {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{background:T.accent}} />}
              </a>
            })}
          </div>
          <div className="flex items-center gap-3">
            <a href="https://github.com/bagstreet/vow" target="_blank" rel="noopener" className="hidden sm:inline-block text-sm px-3 py-1.5 rounded-lg border cursor-pointer transition-colors hover:bg-white/5" style={{ color: T.textSec, borderColor: T.border }}>GitHub</a>
            <a href="#signin" className="hidden sm:inline-block text-sm px-4 py-1.5 rounded-lg cursor-pointer transition-all hover:brightness-110 font-semibold" style={{ background: T.accent, color: '#000' }}>Sign in</a>
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden w-11 h-11 rounded-lg flex items-center justify-center cursor-pointer transition-colors hover:bg-white/5" style={{ color: T.textSec }}>
              {menuOpen ? <X size={18} /> : <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden fixed inset-0 z-[100] flex flex-col" style={{background:'rgba(2,3,3,0.98)'}}>
            <div className="flex justify-end p-5">
              <button onClick={() => setMenuOpen(false)} className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer" style={{background:T.surface, color:T.textSec}}>
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center gap-6">
              {links.map(l => (
                <a key={l} href={`#${l.toLowerCase()}`} onClick={() => setMenuOpen(false)}
                  className="text-2xl font-semibold cursor-pointer transition-colors hover:text-white" style={{color: activeSection === l.toLowerCase() ? T.accent : T.textMuted}}>{l}</a>
              ))}
              <a href="https://github.com/bagstreet/vow" target="_blank" rel="noopener"
                className="mt-4 text-sm px-6 py-2 rounded-xl border cursor-pointer" style={{color:T.accent, borderColor:T.accent}}>GitHub</a>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

/* ── Typing effect for hero headline ── */
function TypingHeadline() {
  const full = "The commitment journal that "
  const accent = "can't lie"
  const [charIdx, setCharIdx] = useState(0)
  const totalLen = full.length + accent.length
  useEffect(() => {
    if (charIdx >= totalLen) return
    const t = setTimeout(() => setCharIdx(c => c + 1), 45)
    return () => clearTimeout(t)
  }, [charIdx, totalLen])
  const showFull = full.slice(0, Math.min(charIdx, full.length))
  const showAccent = charIdx > full.length ? accent.slice(0, charIdx - full.length) : ''
  /* #103: Hero headline must be <h1> for SEO/accessibility */
  return (
    <h1 className="text-[clamp(2.2rem,5.5vw,4rem)] font-bold leading-[1.1] tracking-tight mb-5" style={{ color: T.text }}>
      {showFull}
      {showAccent && <span style={{ color: T.accentHex }}>{showAccent}</span>}
      {charIdx < totalLen && <span className="animate-pulse" style={{color: charIdx >= full.length ? T.accentHex : T.text}}>|</span>}
    </h1>
  )
}

/* ═══ Block 2: Hero ═══ */
/* Mascots opaque at bottom, chat bubble decorations floating around */
function Hero() {
  return (
    <section className="relative flex flex-col items-center justify-center px-6 pt-20 pb-0 overflow-hidden" style={{minHeight:'90vh',maxHeight:'100vh'}}>
      {/* Particles background */}
      <ParticlesBg />
      {/* Glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full opacity-[0.06]" style={{ background: `radial-gradient(circle,${T.accentHex},transparent 70%)`, filter: 'blur(80px)' }} />
      </div>

      {/* Floating chat bubble decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Top-left bubble */}
        <div className="absolute top-[18%] left-[8%] px-3 py-2 rounded-2xl rounded-bl-sm text-[11px] font-mono opacity-40 animate-[float_6s_ease-in-out_infinite]"
          style={{background:T.surface, border:`1px solid ${T.border}`, color:T.textMuted}}>
          Took my vitamins
        </div>
        {/* Top-right bubble */}
        <div className="absolute top-[22%] right-[6%] px-3 py-2 rounded-2xl rounded-br-sm text-[11px] font-mono opacity-35 animate-[float_7s_ease-in-out_infinite_1s]"
          style={{background:`${T.accentHex}10`, border:`1px solid ${T.accentHex}22`, color:T.accent}}>
          Streak: 14 days
        </div>
        {/* Mid-left */}
        <div className="absolute top-[40%] left-[4%] px-3 py-1.5 rounded-xl text-[10px] opacity-25 animate-[float_8s_ease-in-out_infinite_2s]"
          style={{background:T.surface, border:`1px solid ${T.border}`, color:T.textMuted}}>
          Receipt: vow_0xa7...
        </div>
        {/* Mid-right */}
        <div className="absolute top-[35%] right-[10%] px-3 py-1.5 rounded-xl text-[10px] opacity-20 animate-[float_5s_ease-in-out_infinite_0.5s]"
          style={{background:'#f59e0b10', border:'1px solid #f59e0b22', color:'#f59e0b'}}>
          Time for evening meds!
        </div>
        {/* Bottom-left */}
        <div className="absolute bottom-[35%] left-[12%] flex gap-1.5 opacity-25 animate-[float_6s_ease-in-out_infinite_3s]">
          <span className="px-2 py-1 rounded-lg text-[10px]" style={{background:'#22c55e15',color:'#22c55e',border:'1px solid #22c55e33'}}>Done, 5km</span>
          <span className="px-2 py-1 rounded-lg text-[10px]" style={{background:T.surface,color:T.textMuted,border:`1px solid ${T.border}`}}>Skip</span>
        </div>
      </div>

      {/* Text content */}
      <FadeIn className="relative z-10 text-center max-w-3xl w-full">
        {/* Urgency badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono mb-5" style={{ border: `1px solid ${T.border}`, color: T.textMuted }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#22c55e' }} />
          Walrus Session 8 Hackathon Entry
        </div>
        <TypingHeadline />
        <p className="text-base leading-relaxed max-w-lg mx-auto mb-8" style={{ color: T.textSec }}>
          Hash-chained. Tamper-proof. Yours. Every check-in sealed on Walrus, verifiable from anywhere.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <a href="#roles" className="px-6 py-3 rounded-xl font-semibold text-sm cursor-pointer transition-all hover:brightness-110" style={{ background: T.accent, color: '#000' }}>
            Download a preset
          </a>
          <a href="#demo" className="px-6 py-3 rounded-xl font-semibold text-sm border cursor-pointer transition-colors hover:bg-white/5" style={{ borderColor: T.borderVis, color: T.text }}>
            See the demo
          </a>
        </div>
      </FadeIn>

      {/* Mascots at bottom - OPAQUE, in preset order */}
      <div className="relative w-full max-w-3xl mx-auto mt-8" style={{height:'clamp(160px,26vw,260px)'}}>
        {PRESETS.map((p, i) => {
          const isCenter = i === 2
          const isInner = i === 1 || i === 3
          const scale = isCenter ? 1 : isInner ? 0.88 : 0.76
          const zIdx = isCenter ? 3 : isInner ? 2 : 1
          const offsets = ['-28%', '-12%', '0%', '12%', '28%']
          return (
            <img key={p.id} src={p.img} alt={p.label}
              width={200} height={260}
              loading={isCenter ? undefined : 'lazy'}
              className="absolute bottom-0"
              style={{
                left: `calc(50% + ${offsets[i]})`,
                transform: `translateX(-50%) scale(${scale})`,
                transformOrigin: 'bottom center',
                height: '100%', width: 'auto', objectFit: 'contain',
                zIndex: zIdx,
                aspectRatio: '200/260',
                filter: isCenter ? 'none' : `brightness(${isInner ? 0.85 : 0.7})`,
              }} />
          )
        })}
        {/* Gradient fade at bottom for smooth transition */}
        <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" style={{background:`linear-gradient(to bottom, transparent, ${T.bg})`}} />
      </div>

      {/* Trust strip */}
      <FadeIn className="w-full py-6 text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-mono" style={{color:T.textMuted}}>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{background:'#22c55e'}} />Built on Walrus</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{background:'#4da2ff'}} />Sui Mainnet</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{background:'#f97316'}} />Groq LLM</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{background:T.accent}} />Open Source</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{background:'#a855f7'}} />MIT License</span>
        </div>
      </FadeIn>
    </section>
  )
}

/* ═══ Block 3: Receipt ticker ═══ */
function ReceiptTicker() {
  const items = [
    'vow_0x3c91...b2 sealed [Habits] streak:14d',
    'vow_0xa7f2...e1 verified [Medication] dose:vitaminD',
    'vow_0x91dc...44 corrected [Fitness] 5km > 2km (honest)',
    'vow_0xbe03...f7 sealed [Health] cycle:day-12',
    'vow_0x55a1...c9 sealed [Study] 3h "React hooks"',
    'vow_0xd2e8...3a cold-restore 47 entries rebuilt',
  ]
  return (
    <div className="overflow-hidden" style={{ borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}` }}>
      <div className="flex whitespace-nowrap animate-[marquee_45s_linear_infinite]">
        {[...items, ...items].map((r, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-[11px] font-mono" style={{ color: T.textMuted }}>
            <span className="px-3 text-white/30">|</span>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: T.accent }} />
            <span className="py-2.5">{r}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/* ═══ Block 4: Problem ═══ */
function Problem() {
  return (
    <section className="py-20 px-6 pattern-grid">
      <div className="max-w-4xl mx-auto">
        <p className="text-center text-sm mb-10 max-w-md mx-auto italic" style={{ color: T.textMuted }}>
          &quot;Day 14. You open the app. Your streak is 0. No explanation. No receipt. Just gone.&quot;
        </p>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { stat: '74%', text: 'of habit app users quit within 2 weeks. The app said they were "on track."' },
            { stat: '0', text: 'streak apps prove their data is unmodified. They store numbers in a database they control.' },
            { stat: '\u221E', text: 'silent resets. Server migration, database update, streak gone. No receipt. No proof.' },
          ].map((item, i) => (
            <FadeIn key={i} delay={i * 100}>
              <div className="p-5 rounded-2xl" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                <div className="text-2xl font-bold mb-2" style={{ color: T.accent }}>{item.stat}</div>
                <p className="text-sm leading-relaxed" style={{ color: T.textSec }}>{item.text}</p>
              </div>
            </FadeIn>
          ))}
        </div>
        {/* Mini CTA */}
        <FadeIn delay={300}>
          <div className="mt-8 text-center">
            <a href="#signin" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all hover:brightness-110" style={{background:T.accent, color:'#000'}}>
              Start tracking honestly <ChevronRight size={14} />
            </a>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

/* ═══ Block 5: Solution ═══ */
function Solution() {
  const steps = [
    { icon: Shield, title: 'Commit', desc: 'State your goal. Bot seals it with a SHA-256 hash on Walrus. You get a receipt.' },
    { icon: Link2, title: 'Chain', desc: 'Each check-in links to the previous by hash. Edit one and every subsequent hash breaks.' },
    { icon: FileCheck, title: 'Prove', desc: 'Your streak is a chain of receipts, not a number. Verify any entry on Walruscan.' },
  ]
  return (
    <section className="py-14 sm:py-20 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: T.text }}>How Vow fixes this</h2>
        <p className="mb-6 sm:mb-8" style={{ color: T.textMuted }}>Three steps. Zero trust required.</p>
        <WorkflowDiagram />
        {/* Desktop: 3-col grid. Mobile: compact horizontal rows */}
        <div className="hidden sm:grid sm:grid-cols-3 gap-6">
          {steps.map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className="p-6 rounded-2xl text-center" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
              <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ background: `${T.accentHex}15` }}>
                <Icon size={22} style={{ color: T.accent }} />
              </div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-xs font-mono" style={{ color: T.textMuted }}>0{i+1}</span>
                <h3 className="font-semibold" style={{ color: T.text }}>{title}</h3>
              </div>
              <p className="text-sm" style={{ color: T.textSec }}>{desc}</p>
            </div>
          ))}
        </div>
        {/* Mobile: horizontal compact layout */}
        <div className="sm:hidden space-y-3">
          {steps.map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-xl text-left" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
              <div className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: `${T.accentHex}15` }}>
                <Icon size={16} style={{ color: T.accent }} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-mono" style={{ color: T.textMuted }}>0{i+1}</span>
                  <h3 className="font-semibold text-sm" style={{ color: T.text }}>{title}</h3>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: T.textSec }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══ Block 6: Live Demo (kept for merged block reference) ═══ */
const SCENARIOS: Record<string, {from:string, text?:string, buttons?:string[], voice?:boolean}[]> = {
  telegram: [
    { from: 'bot', text: 'Evening meds time! Vitamin D + Omega-3' },
    { from: 'bot', buttons: ['Taken', 'Skip', 'Snooze 1h'] },
    { from: 'user', text: 'I took both but forgot the magnesium earlier' },
    { from: 'bot', text: 'Got it. Vitamin D + Omega-3 logged as taken.\nMagnesium marked as missed for 2pm slot. Want to take it now?\n\nReceipt: vow_0xa7f2...e1' },
    { from: 'bot', buttons: ['Take magnesium now', 'Skip it', 'View full schedule'] },
  ],
  discord: [
    { from: 'bot', text: 'Study session reminder! 2h left on "React hooks" this week.' },
    { from: 'bot', buttons: ['Start now', 'Later', 'Done for today'] },
    { from: 'user', text: 'actually I switched to studying TypeScript generics instead, did about 45 min this morning' },
    { from: 'bot', text: 'Updated your plan. Logged: 45 min TypeScript generics.\n"React hooks" deadline is Friday; you still need 2h.\n\nStreak: 4/7 days. Chain position: #5.' },
  ],
  slack: [
    { from: 'bot', text: 'Day 30 (usually 28). Your period may be late. Everything OK?' },
    { from: 'bot', buttons: ['Yes, fine', 'Log symptom', 'Call doctor'] },
    { from: 'user', text: 'yeah I have cramps and a headache, also feeling pretty tired since yesterday' },
    { from: 'bot', text: 'Logged (encrypted): cramps, headache, fatigue (onset: yesterday).\n\nPattern detected: cramps + headache on day 28-30 in 3 of last 4 cycles. This is consistent with your history.\n\nReceipt: vow_0xbe03...f7' },
    { from: 'bot', buttons: ['View pattern history', 'Set doctor reminder', 'Export for doctor'] },
  ],
  web: [
    { from: 'bot', text: 'Good morning! Did you get your run in today?' },
    { from: 'bot', buttons: ['Done, 5km', 'Skipped', 'Modified'] },
    { from: 'user', text: 'I ran but only 3k, my knee was bothering me so I walked the last bit', voice: true },
    { from: 'bot', text: 'Logged: 3km run + walk (knee issue noted). Honest correction recorded; your chain stays intact.\n\nStreak: 14 days. Receipt: vow_0x3c91...b2\n\nNote: you mentioned knee pain 3 times this month. Consider a rest day?' },
    { from: 'bot', buttons: ['Schedule rest day', 'View injury log', 'Share with trainer'] },
  ],
}

const PLAT_META: Record<string, {label:string, color:string, bg:string, msgBg:string, userBg:string, botBg:string, icon:typeof Globe}> = {
  web:      { label:'Web',      color:T.accentHex,  bg:T.surface,  msgBg:T.recessed, userBg:T.accentHex, botBg:T.surface, icon:Globe },
  telegram: { label:'Telegram', color:'#229ED9',  bg:'#17212b',  msgBg:'#0e1621',  userBg:'#2b5278',botBg:'#182533', icon:MessageCircle },
  slack:    { label:'Slack',    color:'#611f69',  bg:'#1a1d21',  msgBg:'#1a1d21',  userBg:'transparent',botBg:'transparent', icon:Hash },
  discord:  { label:'Discord',  color:'#5865F2',  bg:'#2f3136',  msgBg:'#36393f',  userBg:'transparent',botBg:'transparent', icon:MessageCircle },
}

/* ── Streaming text (char by char for bot messages) ── */
/* #17: Streaming text with thinking indicator */
function StreamText({ text, speed = 15 }: { text: string, speed?: number }) {
  const [thinking, setThinking] = useState(true)
  const [charIdx, setCharIdx] = useState(0)
  useEffect(() => { setCharIdx(0); setThinking(true) }, [text])
  useEffect(() => {
    if (thinking) { const t = setTimeout(() => setThinking(false), 600); return () => clearTimeout(t) }
    if (charIdx >= text.length) return
    const t = setTimeout(() => setCharIdx(c => c + 1), speed)
    return () => clearTimeout(t)
  }, [charIdx, text, speed, thinking])
  if (thinking) return <span className="text-xs italic" style={{color:T.textMuted}}>thinking...</span>
  return <>{text.slice(0, charIdx)}{charIdx < text.length && <span className="animate-pulse">|</span>}</>
}

function DemoChat({ platformId }: { platformId: string }) {
  const [msgs, setMsgs] = useState(0)
  const p = PLAT_META[platformId] || PLAT_META.web
  const sc = SCENARIOS[platformId] || SCENARIOS.web
  const isFlat = platformId === 'discord' || platformId === 'slack'

  useEffect(() => {
    setMsgs(0); let i = 0
    const t = setInterval(() => { i++; setMsgs(i); if (i >= sc.length) clearInterval(t) }, 2000)
    return () => clearInterval(t)
  }, [platformId])

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.borderVis}` }}>
      <div className="flex items-center gap-2 px-4 py-2" style={{ background: p.bg, borderBottom: `1px solid ${T.border}` }}>
        <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{background:'#ff5f57'}}/><div className="w-2.5 h-2.5 rounded-full" style={{background:'#febc2e'}}/><div className="w-2.5 h-2.5 rounded-full" style={{background:'#28c840'}}/></div>
        <span className="flex-1 text-center text-[11px] font-medium" style={{color:T.textSec}}>Vow &middot; {p.label}</span>
      </div>
      <div className="px-4 py-3 space-y-2.5" style={{ background: p.msgBg, height: 340, overflowY: 'auto' }}>
        {sc.slice(0, msgs).map((m, i) => {
          const isLastMsg = i === msgs - 1
          if (m.buttons) return (
            <div key={i} className={`flex ${isFlat ? 'ml-10' : 'justify-start'} gap-1.5 flex-wrap`}>
              {m.buttons.map((b, j) => (
                <span key={j} className="px-3 py-1 rounded-lg text-xs font-medium" style={{ background:`${p.color}22`, color:p.color, border:`1px solid ${p.color}44` }}>{b}</span>
              ))}
            </div>
          )
          if (isFlat) {
            const isBot = m.from === 'bot'
            return (
              <div key={i} className="flex gap-2 items-start">
                <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5" style={{background: isBot ? p.color : '#5c6370'}}>
                  <span className="text-[9px] font-bold text-white">{isBot ? 'V' : 'U'}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold" style={{color: isBot ? p.color : '#fff'}}>{isBot ? 'Vow' : 'you'}</span>
                  <span className="text-[9px] ml-2" style={{color:T.textMuted}}>now</span>
                  <p className="text-sm whitespace-pre-line mt-0.5" style={{color:T.textSec}}>
                    {isBot && isLastMsg && m.text ? <StreamText text={m.text} /> : m.text}
                  </p>
                </div>
              </div>
            )
          }
          return (
            <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-line"
                style={{ background: m.from === 'user' ? p.userBg : p.botBg, color: m.from === 'user' ? '#fff' : T.textSec,
                  border: m.from === 'bot' ? `1px solid ${T.border}` : 'none',
                  borderRadius: m.from === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px' }}>
                {(m as any).voice && <span className="flex items-center gap-1 text-[10px] mb-1 opacity-60"><Mic size={10}/> voice</span>}
                {m.from === 'bot' && isLastMsg && m.text ? <StreamText text={m.text} /> : m.text}
              </div>
            </div>
          )
        })}
        {msgs < sc.length && (
          <div className="flex justify-start">
            <span className="inline-flex gap-1 px-3 py-2">
              {[0,150,300].map(d => <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{background:T.textMuted,animationDelay:`${d}ms`}}/>)}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: p.bg, borderTop: `1px solid ${T.border}` }}>
        <Mic size={16} style={{color:T.textMuted}} className="cursor-pointer" />
        <div className="flex-1 px-3 py-1.5 rounded-lg text-sm" style={{background:T.recessed,color:T.textMuted,border:`1px solid ${T.border}`}}>Type, speak, or tap a button...</div>
        <button onClick={() => {setMsgs(0);let i=0;const t=setInterval(()=>{i++;setMsgs(i);if(i>=sc.length)clearInterval(t)},2000)}}
          className="p-2 rounded-lg cursor-pointer hover:opacity-80" style={{background:p.color}}>
          <Send size={13} color="#fff" />
        </button>
      </div>
    </div>
  )
}

/* ═══ Block 7: MERGED Presets+Demo ═══ */
function PresetsDemoMerged() {
  const [active, setActive] = useState(0)
  const [enabled, setEnabled] = useState<string[]>(PRESETS.map(r => r.id))
  const p = PRESETS[active]
  const toggle = (id: string) => setEnabled(cur => cur.includes(id) ? (cur.length > 1 ? cur.filter(x => x !== id) : cur) : [...cur, id])
  const others = PRESETS.filter(r => r.id !== p.id && enabled.includes(r.id))

  return (
    <section id="roles" className="py-20 px-6" aria-label="Roles and live demo">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{color:T.text}}>Roles in action</h2>
          <p style={{color:T.textMuted}}>Turn on any roles you need, all at once. The assistant picks the right one for each message and tells you which.</p>
          <div className="flex gap-2 flex-wrap justify-center mt-4" role="group" aria-label="Enabled roles">
            {PRESETS.map(r => {
              const on = enabled.includes(r.id)
              return (
                <button key={r.id} type="button" aria-pressed={on} onClick={() => toggle(r.id)}
                  className="text-xs px-3 py-1.5 rounded-full cursor-pointer transition-all"
                  style={{ background: on ? `${r.color}22` : 'transparent', color: on ? r.color : T.textMuted, border: `1px solid ${on ? r.color + '66' : T.border}` }}>
                  {on ? '✓ ' : ''}{r.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          {/* Left: vertical preset tabs */}
          <div className="lg:w-[320px] flex-shrink-0 flex flex-col gap-2">
            {PRESETS.map((pr, i) => {
              const isActive = i === active
              return (
                <button key={pr.id} onClick={() => setActive(i)}
                  className="w-full text-left rounded-xl cursor-pointer transition-all duration-300 overflow-hidden"
                  style={{
                    background: isActive ? T.raised : T.surface,
                    border: `1px solid ${isActive ? pr.color + '55' : T.border}`,
                    boxShadow: isActive ? `0 0 20px ${pr.color}11` : 'none',
                  }}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: `${pr.color}15` }}>
                      <pr.Icon size={16} style={{ color: pr.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate" style={{color: isActive ? T.text : T.textMuted}}>{pr.label}</div>
                      {isActive && <p className="text-[11px] mt-1 leading-relaxed" style={{color:T.textSec}}>{pr.pitch}</p>}
                    </div>
                    <ChevronRight size={14} className="flex-shrink-0 transition-transform" style={{color: isActive ? pr.color : T.textMuted, transform: isActive ? 'rotate(0)' : 'rotate(0)'}} />
                  </div>
                  {/* Expanded: commands + features */}
                  {isActive && (
                    <div className="px-4 pb-3 space-y-2">
                      <div className="flex gap-1.5 flex-wrap">
                        {pr.commands.map((cmd, j) => (
                          <code key={j} className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{background:`${pr.color}10`, color: pr.color, border:`1px solid ${pr.color}22`}}>{cmd}</code>
                        ))}
                      </div>
                      <div className="space-y-0.5">
                        {pr.features.map((f,j) => <div key={j} className="text-[11px] flex items-center gap-1.5" style={{color:T.textSec}}><Check size={9} style={{color:pr.color}}/>{f}</div>)}
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Right: demo chat for the selected preset's platform */}
          <div className="flex-1 min-w-0">
            <div className="mb-2 flex items-center gap-2 flex-wrap text-[11px]" style={{color:T.textSec}} aria-live="polite">
              <span className="px-2 py-0.5 rounded-full" style={{background:`${p.color}22`, color:p.color, border:`1px solid ${p.color}44`}}>Role: {p.label}</span>
              <span>Why: this message matches {p.label.toLowerCase()} topics.{others.length > 0 && ` Also enabled: ${others.map(o => o.label).join(', ')}.`}</span>
            </div>
            <DemoChat platformId={p.platform} key={p.id} />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══ Block 8: Notification Flow ═══ */
/* #5: fixed height, no Check icon causing layout jump */
function NotificationFlow() {
  const [step, setStep] = useState(0)
  useEffect(() => { const t = setInterval(() => setStep(s => (s+1) % 6), 1500); return () => clearInterval(t) }, [])
  const channels = [
    { icon: MessageCircle, name: 'Telegram', color: '#229ED9' },
    { icon: Monitor, name: 'Slack', color: '#611f69' },
    { icon: Smartphone, name: 'Discord', color: '#5865F2' },
    { icon: Bell, name: 'Push', color: '#f59e0b' },
  ]
  return (
    <section className="py-20 px-6 pattern-dots">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2" style={{color:T.text}}>Bot finds you where you are</h2>
          <p className="max-w-md mx-auto" style={{color:T.textMuted}}>
            Medication reminder at 8pm. Bot checks where you were online last. Delivers to that channel first. No response? Tries the next one.
          </p>
        </div>
        <div className="p-6 rounded-2xl" style={{background:T.surface, border:`1px solid ${T.border}`}}>
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl" style={{background:`${T.accentHex}10`, border:`1px solid ${T.accentHex}33`}}>
              <Bell size={16} style={{color:T.accent}} />
              <span className="text-sm font-medium" style={{color:T.accent}}>8:00 PM - Evening meds reminder</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {channels.map((ch, i) => {
              const state = step <= i ? 'waiting' : step === i+1 ? 'trying' : i === 2 ? 'delivered' : 'offline'
              return (
                <div key={i} className="p-4 rounded-xl text-center transition-all duration-500" style={{
                  background: state === 'delivered' ? `${T.accentHex}10` : state === 'trying' ? `${ch.color}10` : T.recessed,
                  border: `1px solid ${state === 'delivered' ? T.accent : state === 'trying' ? ch.color : T.border}`,
                  transform: state === 'trying' ? 'scale(1.05)' : 'scale(1)',
                  /* #5 fixed height so no jump */
                  minHeight: '110px',
                }}>
                  <ch.icon size={24} className="mx-auto mb-2" style={{color: state === 'delivered' ? T.accent : state === 'trying' ? ch.color : T.textMuted}} />
                  <div className="text-xs font-semibold mb-1" style={{color: state === 'delivered' ? T.accent : state === 'trying' ? '#fff' : T.textMuted}}>{ch.name}</div>
                  <div className="text-[10px] font-mono" style={{color: state === 'delivered' ? T.accent : state === 'trying' ? ch.color : T.textMuted}}>
                    {state === 'waiting' && 'standby'}
                    {state === 'trying' && 'checking...'}
                    {state === 'offline' && 'offline'}
                    {state === 'delivered' && 'delivered!'}
                  </div>
                  {state === 'trying' && <div className="mt-1 h-0.5 rounded-full overflow-hidden" style={{background:T.border}}><div className="h-full rounded-full animate-pulse" style={{background:ch.color,width:'60%'}}/></div>}
                </div>
              )
            })}
          </div>
          <div className="mt-4 text-center" style={{minHeight:'20px'}}>
            <span className="text-xs font-mono" style={{color:T.textMuted}}>
              {step === 0 && 'Reminder triggered. Checking channels...'}
              {step === 1 && 'Telegram: last seen 2h ago. Trying...'}
              {step === 2 && 'Telegram offline. Trying Slack...'}
              {step === 3 && 'Slack offline. Trying Discord...'}
              {step >= 4 && 'Delivered via Discord. User was online 5m ago.'}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ═══ Block 9: Architecture ═══ */
function Architecture() {
  const items = [
    { icon: Shield, title: 'Hash Chain', desc: 'Each entry includes SHA-256 of the previous. Change one and every subsequent hash breaks.' },
    { icon: Link2, title: 'Walrus Blobs', desc: 'Entries sealed on Sui mainnet. No server, no database, no single point of failure.' },
    { icon: Key, title: 'Delegate Keys', desc: 'Owner key stays offline. Delegate key handles daily ops. Compromise it? Revoke. History untouched.' },
    { icon: FileCheck, title: 'Honest Receipts', desc: 'Every check-in returns blob ID + hash + timestamp. Verify on Walruscan. Zero trust.' },
    { icon: RotateCcw, title: 'Cold Restore', desc: 'Lost your device? New install rebuilds full chain from Walrus. Zero data loss.' },
    { icon: Settings, title: 'Role Engine', desc: 'System prompts, slash commands, reminder schedules, check-in types. Community roles via PR.' },
  ]
  return (
    <section id="architecture" className="py-20 px-6 pattern-diagonal" aria-label="Architecture">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2" style={{color:T.text}}>How your data stays yours</h2>
          <p style={{color:T.textMuted}}>Six layers between your commitment and anyone who would change it.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {items.map(({icon:Icon,title,desc}, i) => (
            <div key={i} className="p-5 rounded-2xl transition-transform hover:translate-y-[-4px]" style={{background:T.surface,border:`1px solid ${T.border}`}}>
              <div className="flex items-center gap-2.5 mb-2">
                <Icon size={18} style={{color:T.accent}} />
                <h3 className="font-semibold text-sm" style={{color:T.text}}>{title}</h3>
              </div>
              <p className="text-xs leading-relaxed" style={{color:T.textSec}}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══ Block 10: Comparison ═══ */
function Comparison() {
  const rows = [
    { feature: 'Streak storage', trad: 'Database row', vow: 'Hash-chained Walrus blobs' },
    { feature: 'Data ownership', trad: 'Company owns it', vow: 'Your keys, your data' },
    { feature: 'Proof of completion', trad: 'None', vow: 'Cryptographic receipt' },
    { feature: 'Server goes down', trad: 'Data lost', vow: 'Cold restore from chain' },
    { feature: 'Admin edits your data', trad: 'Possible, silent', vow: 'Impossible, hash breaks' },
    { feature: 'Cross-platform sync', trad: 'Account login', vow: 'Same chain, any client' },
  ]
  return (
    <section className="py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center" style={{color:T.text}}>Why Vow wins</h2>
        <div className="rounded-2xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
          <div className="grid grid-cols-3 text-xs font-semibold py-2 px-4" style={{background:T.surface,borderBottom:`1px solid ${T.border}`}}>
            <span style={{color:T.textMuted}}>Feature</span>
            <span style={{color:'#ef4444'}}>Traditional</span>
            <span style={{color:T.accent}}>Vow</span>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-3 text-xs py-2 px-4" style={{borderBottom: i < rows.length-1 ? `1px solid ${T.border}` : 'none'}}>
              <span style={{color:T.text}}>{r.feature}</span>
              <span style={{color:T.textMuted}}>{r.trad}</span>
              <span style={{color:T.accent}}>{r.vow}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══ Deploy: terminal console style ═══ */
function Deploy() {
  const [copied, setCopied] = useState(-1)
  const lines = [
    { prompt: true, cmd: 'git clone https://github.com/bagstreet/vow && cd vow' },
    { output: 'Cloning into \'vow\'... done.' },
    { prompt: true, cmd: 'cp .env.example .env' },
    { output: '# Edit .env: add GROQ_API_KEY, MEMWAL_PRIVATE_KEY, MEMWAL_ACCOUNT_ID' },
    { prompt: true, cmd: 'make setup' },
    { output: 'Installing dependencies... done.\nConfiguring Walrus Memory... connected.\nRoles loaded: 5' },
    { prompt: true, cmd: 'make demo' },
    { output: 'Starting Vow bot on http://localhost:3000\nTelegram webhook: ready\nWalrus Memory: mainnet\n\n  Ready. Try: /checkin or just say "I ran 5km today"' },
  ]
  const copy = (i: number, text: string) => { navigator.clipboard?.writeText(text); setCopied(i); setTimeout(() => setCopied(-1), 2000) }
  return (
    <section id="deploy" className="py-20 px-6" aria-label="Deploy instructions">
      <div className="max-w-3xl mx-auto">
        <FadeIn>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 text-center" style={{color:T.text}}>Ship in 3 minutes</h2>
          <p className="text-center mb-8" style={{color:T.textMuted}}>Clone. Configure. Launch.</p>
        </FadeIn>
        <FadeIn delay={100}>
          <div className="rounded-2xl overflow-hidden" style={{border:`1px solid ${T.borderVis}`}}>
            {/* Terminal chrome */}
            <div className="flex items-center gap-2 px-4 py-2.5" style={{background:'#1e1e1e', borderBottom:`1px solid ${T.border}`}}>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{background:'#ff5f57'}}/>
                <div className="w-2.5 h-2.5 rounded-full" style={{background:'#febc2e'}}/>
                <div className="w-2.5 h-2.5 rounded-full" style={{background:'#28c840'}}/>
              </div>
              <span className="flex-1 text-center text-[11px] font-mono" style={{color:T.textMuted}}>vow - bash</span>
            </div>
            {/* Terminal body */}
            <div className="p-4 font-mono text-[12px] leading-relaxed space-y-1" style={{background:'#0d0d0d'}}>
              {lines.map((line, i) => {
                if ('prompt' in line && line.prompt) {
                  return (
                    <div key={i} className="flex items-start gap-0 group">
                      <span style={{color:T.accent}}>$ </span>
                      <span className="flex-1" style={{color:'#e0e0e0'}}>{line.cmd}</span>
                      <button onClick={() => copy(i, line.cmd!)} className="opacity-0 group-hover:opacity-100 p-2 rounded cursor-pointer transition-opacity hover:bg-white/10 flex-shrink-0 ml-2">
                        {copied === i ? <Check size={12} style={{color:T.accent}}/> : <Copy size={12} style={{color:T.textMuted}}/>}
                      </button>
                    </div>
                  )
                }
                return (
                  <div key={i} className="whitespace-pre-line" style={{color:T.textMuted}}>{(line as any).output}</div>
                )
              })}
              <div className="flex items-center gap-0">
                <span style={{color:T.accent}}>$ </span>
                <span className="w-2 h-4 animate-pulse" style={{background:T.accent, opacity:0.7}}/>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

/* ═══ Block 12: FAQ ═══ */
function FAQ() {
  const [open, setOpen] = useState<number|null>(null)
  const items = [
    { q: 'What happens if Vow shuts down?', a: 'Nothing. Your data lives on Walrus. Any client that speaks the Vow protocol can read and verify your chain. We publish the spec.' },
    { q: 'Can the bot see my health data?', a: 'The LLM processes your messages for responses. Sealed entries are encrypted with your delegate key. The bot sees chat; the chain stores commitments.' },
    { q: 'How do I verify my streak?', a: 'Every receipt has a blob ID. Paste it into Walruscan. The hash chain is public and independently verifiable.' },
    { q: 'Why not just use a regular database?', a: 'A database admin can edit your streak. A migration can reset it. A server outage loses it. Walrus blobs are immutable, replicated, and owned by your keys.' },
    { q: 'What LLM powers the bot?', a: 'Groq (Llama 3.3 70B) primary, Cerebras (Qwen 3 32B) fallback. No OpenAI, no Anthropic. The model is the companion voice; it never decides what the ledger says.' },
  ]
  return (
    <section id="faq" className="py-20 px-6" aria-label="Frequently asked questions">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center" style={{color:T.text}}>Still not convinced?</h2>
        <div className="space-y-2">
          {items.map((item, i) => (
            <button key={i} onClick={() => setOpen(open === i ? null : i)} className="w-full text-left p-4 rounded-xl transition-all cursor-pointer"
              style={{background: open === i ? T.raised : T.surface, border: `1px solid ${open === i ? T.borderVis : T.border}`}}>
              <div className="flex justify-between items-center">
                <span className="font-medium text-sm" style={{color:T.text}}>{item.q}</span>
                <ChevronDown size={14} className="ml-3 flex-shrink-0 transition-transform" style={{color:T.textMuted, transform: open === i ? 'rotate(180deg)' : 'none'}} />
              </div>
              {open === i && <p className="text-sm mt-3 leading-relaxed" style={{color:T.textSec}}>{item.a}</p>}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══ Tamper Challenge (wow) ═══ */
function TamperChallenge() {
  const [state, setState] = useState<'idle'|'editing'|'rejected'>('idle')
  const [editVal, setEditVal] = useState('5km run completed')
  const tryTamper = () => {
    setState('editing')
    setTimeout(() => setState('rejected'), 1500)
  }
  const reset = () => { setState('idle'); setEditVal('5km run completed') }
  return (
    <section className="py-20 px-6">
      <div className="max-w-2xl mx-auto">
        <FadeIn>
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2" style={{color:T.text}}>Try to tamper</h2>
            <p style={{color:T.textMuted}}>Edit a sealed entry. See what happens.</p>
          </div>
        </FadeIn>
        <FadeIn delay={100}>
          <div className="rounded-2xl p-6" style={{background:T.surface, border:`1px solid ${T.border}`}}>
            <div className="flex items-center gap-2 mb-4">
              <FileCheck size={16} style={{color:T.accent}} />
              <span className="text-xs font-mono" style={{color:T.textMuted}}>Entry #14 - sealed 2h ago</span>
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full" style={{background:`${T.accentHex}15`, color:T.accent}}>verified</span>
            </div>
            <div className="p-3 rounded-lg mb-4" style={{background:T.recessed, border:`1px solid ${state === 'rejected' ? '#ef4444' : T.border}`}}>
              {state === 'idle' && <div className="text-sm" style={{color:T.textSec}}>5km run completed</div>}
              {state === 'editing' && (
                <input value={editVal} onChange={e => setEditVal(e.target.value)} className="w-full bg-transparent text-sm outline-none" style={{color:T.text}} />
              )}
              {state === 'rejected' && (
                <div>
                  <div className="text-sm line-through" style={{color:'#ef4444'}}>{editVal}</div>
                  <div className="text-xs mt-2 font-mono" style={{color:'#ef4444'}}>
                    REJECTED: SHA-256 mismatch. Expected a4f2...c9e1, got 7b3d...f8a2.
                    <br/>Chain integrity: BROKEN at position #14.
                    <br/>Original entry preserved. Tamper logged.
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {state === 'idle' && (
                <button onClick={tryTamper} className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors hover:bg-red-500/20" style={{background:'#ef444415', color:'#ef4444', border:'1px solid #ef444433'}}>
                  Edit this entry
                </button>
              )}
              {state === 'editing' && (
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{borderColor:`${T.accent} transparent`}} />
                  <span className="text-xs" style={{color:T.textMuted}}>Verifying hash chain...</span>
                </div>
              )}
              {state === 'rejected' && (
                <button onClick={reset} className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer hover:bg-white/5" style={{border:`1px solid ${T.border}`, color:T.textMuted}}>
                  Reset demo
                </button>
              )}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

/* ═══ Who Uses This (testimonial-style quote cards) ═══ */
function WhoUsesThis() {
  const personas = [
    { icon: Dumbbell, title: 'Athletes', quote: 'My coach can verify every training session. No more "trust me, I ran."', who: 'Marathon runner, 14-day streak', color: '#22c55e' },
    { icon: Heart, title: 'Patients', quote: 'My doctor sees my medication log with receipts. Not a spreadsheet I could have edited.', who: 'Chronic condition management', color: '#ec4899' },
    { icon: BookOpen, title: 'Students', quote: 'My scholarship board asked for proof of study hours. I gave them a hash chain.', who: 'Grad student, Study & Exam preset', color: '#8b5cf6' },
    { icon: Shield, title: 'Recovery Groups', quote: 'My sobriety streak is real. Not because I say so; because the chain says so.', who: 'Recovery community member', color: '#ef4444' },
  ]
  return (
    <section className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <FadeIn>
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2" style={{color:T.text}}>Who uses Vow</h2>
            <p style={{color:T.textMuted}}>Proof, not promises.</p>
          </div>
        </FadeIn>
        <div className="grid md:grid-cols-2 gap-4">
          {personas.map((p, i) => (
            <FadeIn key={i} delay={i * 80}>
              <div className="p-6 rounded-2xl relative hover:translate-y-[-2px] transition-transform" style={{background:T.surface, border:`1px solid ${T.border}`}}>
                <div className="text-3xl mb-3" style={{color:`${p.color}30`}}>&ldquo;</div>
                <p className="text-sm leading-relaxed mb-4 italic" style={{color:T.textSec}}>{p.quote}</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{background:`${p.color}15`}}>
                    <p.icon size={14} style={{color:p.color}} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold" style={{color:T.text}}>{p.title}</div>
                    <div className="text-[10px]" style={{color:T.textMuted}}>{p.who}</div>
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══ Block 13: CTA ═══ */
function CTA() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-xl mx-auto text-center p-8 rounded-2xl pattern-dots" style={{background:T.surface,border:`1px solid ${T.border}`}}>
        <h2 className="text-2xl font-bold mb-3" style={{color:T.text}}>Make your first vow</h2>
        <p className="text-sm mb-6" style={{color:T.textSec}}>Pick a preset. Connect a channel. Your first check-in is a receipt you own forever.</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <a href="#signin" className="px-6 py-3 rounded-xl font-semibold text-sm cursor-pointer hover:brightness-110" style={{background:T.accent,color:'#000'}}>Seal your first commitment</a>
          <a href="https://github.com/bagstreet/vow" target="_blank" rel="noopener" className="px-6 py-3 rounded-xl font-semibold text-sm border cursor-pointer hover:bg-white/5" style={{borderColor:T.borderVis,color:T.text}}>View source</a>
        </div>
      </div>
    </section>
  )
}

/* ═══ Sign In: bot-first (account is created by the first message to any bot), or an emailed one-time link ═══ */
const BOT_LINKS = {
  telegram: 'https://t.me/VoW_rebot',
  discord: 'https://discord.com/oauth2/authorize?client_id=1557286978905571428&integration_type=1&scope=applications.commands',
  slack: 'https://slack.com/app_redirect?app=A0C6WKX1SNB',
}
function SignIn() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [msg, setMsg] = useState('')
  const providers: { name: string; href: string; color: string; icon: typeof Globe; hint: string; oauth?: boolean }[] = [
    { name: 'Telegram', href: BOT_LINKS.telegram, color: '#229ED9', icon: MessageCircle, hint: 'Press Start' },
    { name: 'Discord', href: '/api/dash/oauth-start?provider=discord', color: '#5865F2', icon: Hash, hint: 'Authorize, you land in the dashboard', oauth: true },
    { name: 'Slack', href: '/api/dash/oauth-start?provider=slack', color: '#611f69', icon: Monitor, hint: 'Demo workspace only', oauth: true },
  ]
  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault(); setState('sending')
    const r = await api('magic-request', 'POST', { email })
    if (r.ok) setState('sent')
    else { setState('error'); setMsg(r.error === 'too_many_requests' ? 'Too many requests, try again in a while.' : r.error === 'bad_email' ? 'That email does not look right.' : 'Could not send the link. Try again.') }
  }
  return (
    <section id="signin" className="py-20 px-6">
      <div className="max-w-md mx-auto">
        <FadeIn>
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2" style={{color:T.text}}>Start in the messenger you already use</h2>
            <p style={{color:T.textMuted}}>Sign in with Discord or Slack, or press Start in Telegram and send <code>/login</code>. Same account and memory everywhere.</p>
          </div>
        </FadeIn>
        <FadeIn delay={100}>
          <div className="space-y-3">
            {providers.map((p, i) => (
              <a key={i} href={p.href} {...(p.oauth ? {} : { target: '_blank', rel: 'noreferrer' })}
                className="w-full flex items-center gap-3 px-5 py-3.5 rounded-xl cursor-pointer transition-all hover:scale-[1.02] hover:brightness-110"
                style={{background:T.surface, border:`1px solid ${T.border}`}}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:`${p.color}15`}}>
                  <p.icon size={20} style={{color:p.color}} />
                </div>
                <span className="font-semibold text-sm" style={{color:T.text}}>{p.oauth ? `Sign in with ${p.name}` : `Open in ${p.name}`}</span>
                <span className="text-[11px] ml-2" style={{color:T.textMuted}}>{p.hint}</span>
                <ChevronRight size={16} className="ml-auto" style={{color:T.textMuted}} />
              </a>
            ))}
          </div>
          <form onSubmit={sendLink} className="mt-5 p-4 rounded-xl" style={{background:T.surface, border:`1px solid ${T.border}`}}>
            <p className="text-xs font-semibold mb-2" style={{color:T.text}}>Or sign in with email, no password</p>
            <div className="flex gap-2">
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email"
                className="flex-1 min-w-0 px-3 py-2 rounded-lg text-sm outline-none" style={{background:'transparent', color:T.text, border:`1px solid ${T.border}`}} />
              <button type="submit" disabled={state==='sending'} className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer" style={{background:T.accentHex, color:'#000'}}>
                {state==='sending' ? 'Sending…' : 'Email me a link'}
              </button>
            </div>
            {state==='sent' && <p className="text-[11px] mt-2" style={{color:T.accentHex}}>If that address can receive mail, a one-time link is on its way (valid 10 minutes).</p>}
            {state==='error' && <p className="text-[11px] mt-2" style={{color:'#ef4444'}}>{msg}</p>}
          </form>
          <p className="text-center text-[11px] mt-4" style={{color:T.textMuted}}>
            One memory and one assistant across all channels. Your notes are stored as encrypted blobs on Walrus.
          </p>
        </FadeIn>
      </div>
    </section>
  )
}

/* ═══ Video Section ═══ */
function VideoSection() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)
  const toggleMute = () => {
    if (videoRef.current) { videoRef.current.muted = !muted; setMuted(!muted) }
  }
  return (
    <section className="py-16 px-6" id="demo">
      <div className="max-w-4xl mx-auto">
        <FadeIn>
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold mb-1" style={{color:T.text}}>See Vow in action</h2>
            <p className="text-xs" style={{color:T.textMuted}}>Problem. Solution. Proof. Three use cases, 18 seconds.</p>
          </div>
          <div className="rounded-2xl overflow-hidden relative group mx-auto" style={{border:`1px solid ${T.borderVis}`, aspectRatio:'16/9', contentVisibility:'auto'}}>
            <video
              ref={videoRef}
              src="/vow-promo.mp4"
              autoPlay muted loop playsInline
              className="w-full h-full block object-cover"
              width={1280} height={720}
            />
            {/* Unmute / Fullscreen controls */}
            <div className="absolute bottom-3 right-3 flex gap-2 transition-opacity">
              <button onClick={toggleMute} className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer backdrop-blur-sm" style={{background:'rgba(0,0,0,0.7)',color:T.text}}>
                {muted ? 'Unmute' : 'Mute'}
              </button>
              <button onClick={() => videoRef.current?.requestFullscreen()} className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer backdrop-blur-sm" style={{background:'rgba(0,0,0,0.7)',color:T.text}}>
                Fullscreen
              </button>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

/* ═══ Animated Counter ═══ */
function AnimatedCounter() {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.3 })
    obs.observe(el); return () => obs.disconnect()
  }, [])
  const counters = [
    /* Only show provable numbers; fake social proof hurts credibility */
    { target: 5, label: 'Roles available', suffix: '' },
    { target: 4, label: 'Platforms supported', suffix: '' },
    { target: 6, label: 'Integrations', suffix: '' },
    { target: 256, label: 'Bit hash chain', suffix: '' },
  ]
  return (
    <section ref={ref} className="py-16 px-6">
      <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
        {counters.map((c, i) => (
          <FadeIn key={i} delay={i * 100}>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold mb-1" style={{color:T.accent}}>
                <CountUp target={c.target} active={visible} />{c.suffix}
              </div>
              <div className="text-xs" style={{color:T.textMuted}}>{c.label}</div>
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  )
}
function CountUp({ target, active }: { target: number, active: boolean }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!active) return
    const dur = 1500; const startTime = Date.now()
    const tick = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / dur, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setVal(Math.round(ease * target))
      if (progress < 1) requestAnimationFrame(tick)
    }
    tick()
  }, [active, target])
  return <>{val}</>
}

/* ═══ Developer Resources ═══ */
function DevResources() {
  const resources = [
    { title: 'Agent API & MCP', desc: 'Role-scoped tokens: remember verified facts, recall by role; stdio MCP bridge included', link: 'https://github.com/bagstreet/vow/blob/main/docs/API.md', icon: Globe },
    { title: 'JavaScript SDK', desc: 'Zero-dependency client. npm install vow-agent-sdk', link: 'https://github.com/bagstreet/vow/tree/main/packages/sdk', icon: Settings },
    { title: 'Self-host', desc: 'Free-tier stack or Docker; step-by-step guide', link: 'https://github.com/bagstreet/vow/blob/main/docs/SELF_HOST.md', icon: Monitor },
    { title: 'Services & setup', desc: 'Every service the project uses and the settings each needs', link: 'https://github.com/bagstreet/vow/blob/main/docs/SERVICES.md', icon: Bell },
  ]
  return (
    <section className="py-16 px-6">
      <div className="max-w-4xl mx-auto">
        <FadeIn>
          <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-center" style={{color:T.text}}>Extend it. Deploy it. Own it.</h2>
          <p className="text-center mb-8" style={{color:T.textMuted}}>Everything you need to integrate, extend, or self-host.</p>
        </FadeIn>
        <div className="grid md:grid-cols-2 gap-3">
          {resources.map((r, i) => (
            <FadeIn key={i} delay={i * 60}>
              <a href={r.link} className="flex items-center gap-3 p-4 rounded-xl transition-all hover:scale-[1.02] cursor-pointer group"
                style={{background:T.surface, border:`1px solid ${T.border}`}}>
                <r.icon size={18} style={{color:T.accent}} />
                <div>
                  <div className="font-semibold text-sm group-hover:text-white transition-colors" style={{color:T.text}}>{r.title}</div>
                  <div className="text-[11px]" style={{color:T.textMuted}}>{r.desc}</div>
                </div>
                <ChevronRight size={14} className="ml-auto flex-shrink-0" style={{color:T.textMuted}} />
              </a>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="py-8 px-6" style={{borderTop:`1px solid ${T.border}`}} role="contentinfo">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <VowLogo height={16} />
        </div>
        <nav className="flex gap-5 text-xs" style={{color:T.textMuted}} aria-label="Footer navigation">
          <a href="https://github.com/bagstreet/vow" target="_blank" rel="noopener" className="hover:text-white transition-colors cursor-pointer">GitHub</a>
          <a href="https://github.com/bagstreet/vow/issues/new" target="_blank" rel="noopener" className="hover:text-white transition-colors cursor-pointer">Report Issue</a>
          <a href="https://github.com/bagstreet/vow/issues" target="_blank" rel="noopener" className="hover:text-white transition-colors cursor-pointer">Open Issues</a>
          <a href="https://github.com/bagstreet/vow/blob/main/SECURITY.md" target="_blank" rel="noopener" className="hover:text-white transition-colors cursor-pointer">Security</a>
          <a href="https://github.com/bagstreet/vow/tree/main/docs" target="_blank" rel="noopener" className="hover:text-white transition-colors cursor-pointer">Docs</a>
        </nav>
        <span className="text-xs" style={{color:T.textMuted}}>MIT License &middot; 2026</span>
      </div>
    </footer>
  )
}

/* ═══ #6 Scroll to Top ═══ */
function ScrollToTop() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const fn = () => setShow(window.scrollY > 600)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])
  if (!show) return null
  return (
    <button onClick={() => window.scrollTo({top:0,behavior:'smooth'})}
      className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all hover:brightness-110 shadow-lg"
      style={{background:T.accent, color:'#000'}} aria-label="Scroll to top">
      <ArrowUp size={18} />
    </button>
  )
}

/* #5: Dot navigation sidebar */
function DotNav() {
  const [active, setActive] = useState('')
  const [show, setShow] = useState(false)
  const sections = [
    {id:'roles',label:'Roles'},
    {id:'demo',label:'Demo'},
    {id:'architecture',label:'Architecture'},
    {id:'deploy',label:'Deploy'},
    {id:'faq',label:'FAQ'},
    {id:'signin',label:'Sign In'},
  ]
  useEffect(() => {
    const fn = () => {
      setShow(window.scrollY > 400)
      let cur = ''
      for (const s of sections) {
        const el = document.getElementById(s.id)
        if (el && el.getBoundingClientRect().top <= 200) cur = s.id
      }
      setActive(cur)
    }
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])
  if (!show) return null
  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col gap-3">
      {sections.map(s => (
        <a key={s.id} href={`#${s.id}`} title={s.label}
          className="w-4 h-4 rounded-full transition-all cursor-pointer p-0.5"
          style={{background: active === s.id ? T.accent : T.border, transform: active === s.id ? 'scale(1.4)' : 'scale(1)'}} />
      ))}
    </div>
  )
}

/* ═══ App ═══ */
export default function App() {
  const [widgetDismissed, setWidgetDismissed] = useState(false)
  useAnimatedFavicon(!widgetDismissed)
  return (
    <div style={{ background: T.bg, color: T.text, minHeight: '100vh' }}>
      {/* #23: Skip navigation link */}
      <a href="#main-content" className="sr-only">Skip to main content</a>
      <Nav />
      <main id="main-content">
        <Hero />
        <ReceiptTicker />
        <Problem />
        <Solution />
        <PresetsDemoMerged />
        <VideoSection />
        <TamperChallenge />
        <AnimatedCounter />
        <NotificationFlow />
        <WhoUsesThis />
        <Architecture />
        <Comparison />
        <DevResources />
        <Deploy />
        <FAQ />
        <SignIn />
        <CTA />
      </main>
      <Footer />
      <ScrollToTop />
      <DotNav />
      <ChatWidget onDismiss={() => setWidgetDismissed(true)} />
    </div>
  )
}
