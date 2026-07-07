'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, BookOpen, Award, Calculator,
  BarChart3, Receipt, FileText, GraduationCap,
  ChevronDown, CheckCircle, Quote,
  Code2, Layers, Zap, Users, ShieldCheck, RefreshCw, Landmark,
  Menu, X,
} from 'lucide-react';

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function useCounter(target: number, duration = 1800, active = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start: number;
    const raf = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, [target, duration, active]);
  return val;
}

// ─── Sistema unificado de iconos ────────────────────────────────────────────────
// Un solo lenguaje: icono lucide (strokeWidth 1.75) dentro de un tile redondeado
// con tinte/gradiente de marca. Reemplaza todos los emojis del landing.

function IconTile({ icon: Icon, tint = '#1B2E6E', size = 52, onDark = false }: {
  icon: React.ElementType; tint?: string; size?: number; onDark?: boolean;
}) {
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.3),
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      background: onDark
        ? 'rgba(255,255,255,0.08)'
        : `linear-gradient(145deg, ${tint}1F, ${tint}0A)`,
      border: onDark ? '1px solid rgba(255,255,255,0.16)' : `1px solid ${tint}26`,
      boxShadow: onDark ? 'inset 0 1px 0 rgba(255,255,255,0.08)' : 'inset 0 1px 0 rgba(255,255,255,0.7)',
    }}>
      <Icon size={Math.round(size * 0.44)} color={onDark ? '#93C5FD' : tint} strokeWidth={1.75} />
    </div>
  );
}

// ─── Spot-art: ilustraciones SVG planas y geométricas en la paleta de marca ─────
// Motivos contables abstractos, mismo lenguaje visual: balanza (partida doble),
// factura electrónica y curva de aprendizaje/crecimiento.

function ArtBalance({ size = 220 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 220 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="110" cy="104" r="92" fill="#2563EB" opacity="0.06" />
      {/* base */}
      <rect x="82" y="170" width="56" height="12" rx="6" fill="#1B2E6E" />
      <rect x="98" y="150" width="24" height="22" rx="4" fill="#0F2657" />
      {/* post + beam */}
      <rect x="106" y="54" width="8" height="98" rx="4" fill="#1B2E6E" />
      <rect x="30" y="50" width="160" height="8" rx="4" fill="#2563EB" />
      {/* fulcrum */}
      <path d="M110 34 L99 54 L121 54 Z" fill="#B8860B" />
      <circle cx="110" cy="50" r="5" fill="#FBBF24" />
      {/* left pan */}
      <path d="M38 56 L50 96 M62 56 L50 96" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
      <path d="M26 96 Q50 120 74 96 Z" fill="#93C5FD" />
      <circle cx="50" cy="92" r="7" fill="#2563EB" />
      {/* right pan */}
      <path d="M158 56 L170 96 M182 56 L170 96" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
      <path d="M146 96 Q170 120 194 96 Z" fill="#FDE68A" />
      <circle cx="170" cy="92" r="7" fill="#B8860B" />
    </svg>
  );
}

function ArtInvoice({ size = 120 }: { size?: number }) {
  const w = size, h = Math.round(size * 1.25);
  return (
    <svg width={w} height={h} viewBox="0 0 160 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="22" y="14" width="116" height="172" rx="12" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2" />
      {/* header */}
      <path d="M22 26 Q22 14 34 14 H126 Q138 14 138 26 V44 H22 Z" fill="#1B2E6E" />
      <circle cx="42" cy="29" r="6" fill="#FBBF24" />
      <rect x="54" y="26" width="56" height="6" rx="3" fill="rgba(255,255,255,0.55)" />
      {/* líneas de detalle */}
      <rect x="38" y="60" width="84" height="5" rx="2.5" fill="#CBD5E1" />
      <rect x="38" y="74" width="62" height="5" rx="2.5" fill="#CBD5E1" />
      <rect x="38" y="88" width="76" height="5" rx="2.5" fill="#CBD5E1" />
      {/* total */}
      <rect x="38" y="104" width="84" height="22" rx="6" fill="#DBEAFE" />
      <rect x="46" y="112" width="40" height="6" rx="3" fill="#2563EB" />
      <rect x="98" y="112" width="16" height="6" rx="3" fill="#B8860B" />
      {/* QR */}
      <rect x="38" y="140" width="34" height="34" rx="5" fill="#0F2657" />
      <rect x="44" y="146" width="8" height="8" fill="#FBBF24" />
      <rect x="58" y="146" width="8" height="8" fill="#60A5FA" />
      <rect x="44" y="160" width="8" height="8" fill="#60A5FA" />
      <rect x="58" y="160" width="8" height="8" fill="#FBBF24" />
      {/* validado */}
      <circle cx="104" cy="157" r="15" fill="#EFF6FF" />
      <path d="M97 157 l5 5 l9 -10" stroke="#2563EB" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArtGrowth({ w = 130 }: { w?: number }) {
  const h = Math.round(w * 0.62);
  return (
    <svg width={w} height={h} viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="10" y="8" width="140" height="84" rx="12" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2" />
      <line x1="26" y1="78" x2="140" y2="78" stroke="#E2E8F0" strokeWidth="2" />
      <path d="M28 70 L60 52 L86 60 L132 26" stroke="#2563EB" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="28" cy="70" r="4" fill="#1B2E6E" />
      <circle cx="60" cy="52" r="4" fill="#2563EB" />
      <circle cx="86" cy="60" r="4" fill="#60A5FA" />
      <circle cx="132" cy="26" r="5" fill="#B8860B" />
      <path d="M123 26 L132 26 L132 35" stroke="#B8860B" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Glifos de línea (line-art) para textura del hero sobre fondo oscuro.
function GlyphBalance() {
  return (
    <svg width="150" height="150" viewBox="0 0 120 120" fill="none" stroke="rgba(147,197,253,0.16)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="60" y1="26" x2="60" y2="86" />
      <rect x="46" y="86" width="28" height="8" rx="3" />
      <line x1="30" y1="36" x2="90" y2="36" />
      <line x1="60" y1="26" x2="60" y2="36" />
      <path d="M18 40 A16 12 0 0 0 42 40" />
      <line x1="30" y1="36" x2="18" y2="40" /><line x1="30" y1="36" x2="42" y2="40" />
      <path d="M78 40 A16 12 0 0 0 102 40" />
      <line x1="90" y1="36" x2="78" y2="40" /><line x1="90" y1="36" x2="102" y2="40" />
      <circle cx="60" cy="20" r="4" stroke="rgba(251,191,36,0.35)" />
    </svg>
  );
}

function GlyphBars() {
  return (
    <svg width="140" height="140" viewBox="0 0 120 120" fill="none" stroke="rgba(147,197,253,0.16)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="20" y1="96" x2="102" y2="96" />
      <rect x="30" y="62" width="14" height="34" />
      <rect x="53" y="44" width="14" height="52" />
      <rect x="76" y="30" width="14" height="66" />
      <path d="M30 74 L60 56 L83 42" strokeDasharray="3 5" stroke="rgba(251,191,36,0.3)" />
      <circle cx="83" cy="42" r="3" stroke="rgba(251,191,36,0.4)" />
    </svg>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatItem({ icon: Icon, value, suffix, label, active }: {
  icon: React.ElementType; value: number; suffix: string; label: string; active: boolean;
}) {
  const count = useCounter(value, 1800, active);
  return (
    <div style={{
      textAlign: 'center', padding: '30px 16px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 13,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)',
      }}>
        <Icon size={20} color="#93C5FD" strokeWidth={1.75} />
      </div>
      <div style={{ fontSize: 'clamp(1.9rem, 4vw, 2.7rem)', fontWeight: 900, lineHeight: 1, color: '#FFFFFF' }}>
        {count}{suffix}
      </div>
      <div style={{ fontSize: '0.76rem', fontWeight: 500, color: 'rgba(147,197,253,0.82)' }}>
        {label}
      </div>
    </div>
  );
}

const BENTO_CLASS = ['lp-b-a', 'lp-b-b', 'lp-b-c', 'lp-b-d', 'lp-b-e', 'lp-b-f'];

function BentoCard({ feature, index, visible, delay }: {
  feature: typeof FEATURES[number]; index: number; visible: boolean; delay: number;
}) {
  const { icon: Icon, title, desc, color } = feature;
  const [hover, setHover] = useState(false);
  const cls = BENTO_CLASS[index] ?? '';
  const on = { onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false) };
  const lift = hover ? 'translateY(-6px)' : (visible ? 'translateY(0)' : 'translateY(26px)');
  const base = {
    opacity: visible ? 1 : 0,
    transform: lift,
    transition: `opacity .6s cubic-bezier(.22,1,.36,1) ${delay}ms, transform .45s cubic-bezier(.22,1,.36,1), box-shadow .3s ease, border-color .3s ease`,
  } as const;

  // Celda destacada (grande, oscura) con ilustración de balanza — partida doble.
  if (index === 0) {
    return (
      <article className={cls} {...on} style={{
        ...base, position: 'relative', overflow: 'hidden', borderRadius: 24,
        padding: 'clamp(24px,3vw,34px)', minHeight: 300,
        background: 'linear-gradient(150deg,#0F2657 0%,#1B2E6E 55%,#1E3A8A 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: hover ? '0 30px 60px rgba(15,38,87,0.42)' : '0 10px 30px rgba(15,38,87,0.25)',
        display: 'flex', flexDirection: 'column', color: '#FFFFFF',
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '22px 22px', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: '64%' }}>
          <IconTile icon={Icon} onDark size={54} />
          <div style={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#FBBF24' }}>Núcleo del sistema</div>
          <h3 style={{ fontSize: 'clamp(1.1rem,1.8vw,1.4rem)', fontWeight: 800, margin: 0, lineHeight: 1.2 }}>{title}</h3>
          <p style={{ fontSize: '0.9rem', lineHeight: 1.65, color: 'rgba(255,255,255,0.72)', margin: 0 }}>{desc}</p>
        </div>
        <div className="lp-drift" style={{ position: 'absolute', right: -8, bottom: -12, zIndex: 0 }}>
          <ArtBalance size={195} />
        </div>
      </article>
    );
  }

  // Celda acento (dorada) con ilustración de factura electrónica.
  if (index === 1) {
    return (
      <article className={cls} {...on} style={{
        ...base, position: 'relative', overflow: 'hidden', borderRadius: 24,
        padding: 'clamp(22px,2.6vw,30px)',
        background: 'linear-gradient(135deg,#FFFDF4 0%,#FFFFFF 62%)',
        border: '1px solid #F1E4C3',
        boxShadow: hover ? '0 24px 48px rgba(184,134,11,0.16)' : '0 6px 20px rgba(184,134,11,0.08)',
        display: 'flex', alignItems: 'center', gap: 20,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <IconTile icon={Icon} tint="#B8860B" size={50} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '14px 0 8px', lineHeight: 1.25 }}>{title}</h3>
          <p style={{ fontSize: '0.86rem', color: '#64748B', lineHeight: 1.6, margin: 0 }}>{desc}</p>
        </div>
        <div className="lp-drift-2" style={{ flexShrink: 0 }}><ArtInvoice size={92} /></div>
      </article>
    );
  }

  // Celda ancha (horizontal).
  if (index === 2) {
    return (
      <article className={cls} {...on} style={{
        ...base, borderRadius: 24, padding: 'clamp(22px,2.6vw,30px)',
        background: '#FFFFFF', border: '1px solid #E8EEF8',
        boxShadow: hover ? '0 24px 48px rgba(27,46,110,0.12)' : '0 4px 16px rgba(27,46,110,0.05)',
        display: 'flex', alignItems: 'center', gap: 18,
      }}>
        <IconTile icon={Icon} tint={color} size={54} />
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: '0 0 6px' }}>{title}</h3>
          <p style={{ fontSize: '0.86rem', color: '#64748B', lineHeight: 1.6, margin: 0 }}>{desc}</p>
        </div>
      </article>
    );
  }

  // Celdas compactas.
  return (
    <article className={cls} {...on} style={{
      ...base, borderRadius: 24, padding: 'clamp(22px,2.4vw,28px)',
      background: '#FFFFFF', border: '1px solid #E8EEF8',
      boxShadow: hover ? '0 24px 48px rgba(27,46,110,0.12)' : '0 4px 16px rgba(27,46,110,0.05)',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <IconTile icon={Icon} tint={color} size={50} />
      <div>
        <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#0F172A', margin: '0 0 6px' }}>{title}</h3>
        <p style={{ fontSize: '0.84rem', color: '#64748B', lineHeight: 1.6, margin: 0 }}>{desc}</p>
      </div>
    </article>
  );
}

function StepCard({ number, title, desc, visible, delay }: {
  number: string; title: string; desc: string; visible: boolean; delay: number;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center', gap: 14, padding: '0 16px', flex: 1, minWidth: 200,
      position: 'relative', zIndex: 1,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(28px)',
      transition: `opacity 0.6s cubic-bezier(.22,1,.36,1) ${delay}ms, transform 0.6s cubic-bezier(.22,1,.36,1) ${delay}ms`,
    }}>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.18), transparent 70%)', pointerEvents: 'none' }} />
        <div style={{
          position: 'relative',
          width: 60, height: 60, borderRadius: '50%',
          background: 'linear-gradient(145deg,#2563EB,#1B2E6E)',
          color: 'white', fontWeight: 900, fontSize: '1.35rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 10px 26px rgba(27,46,110,0.35)',
          border: '3px solid #FFFFFF',
        }}>
          {number}
        </div>
      </div>
      <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A' }}>{title}</div>
      <div style={{ fontSize: '0.83rem', color: '#64748B', lineHeight: 1.6, maxWidth: 240 }}>{desc}</div>
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: Calculator, color: '#1B2E6E', title: 'Motor Contable de Doble Entrada',   desc: 'Partidas de diario, libros mayor, balances de comprobación y estados financieros completos con validación NIIF.' },
  { icon: Receipt,    color: '#B8860B', title: 'Facturación Electrónica CR',         desc: 'Compatible con Hacienda v4.4. Crea, valida y envía comprobantes electrónicos con firma digital real.' },
  { icon: BookOpen,   color: '#2563EB', title: 'Ejercicios Contables Interactivos',  desc: 'Casos prácticos con empresas costarricenses reales. Retroalimentación automática al instante.' },
  { icon: Award,      color: '#B8860B', title: 'Calificación con Rúbricas',          desc: 'Evaluación automática ponderada por criterios. El docente configura los pesos, el sistema califica.' },
  { icon: BarChart3,  color: '#2563EB', title: 'Dashboards de Progreso',             desc: 'Métricas de desempeño en tiempo real. Estudiantes y profesores visualizan avances y brechas.' },
  { icon: FileText,   color: '#1B2E6E', title: 'Formularios Tributarios',            desc: 'D-101, D-103, D-104 y D-115. Declaraciones de renta, IVA y retenciones del Ministerio de Hacienda.' },
];

const CONVENIO_POINTS = [
  { icon: Users,       tint: '#1B2E6E', title: 'Acceso para todos los estudiantes', desc: 'Cualquier estudiante activo de un colegio técnico o universidad puede ingresar con su cuenta institucional. La licencia es cubierta por la institución, sin costo directo para el estudiante.' },
  { icon: ShieldCheck, tint: '#2563EB', title: 'Alineado al currículo nacional',    desc: 'El sistema está alineado con el plan de estudios de contabilidad de colegios técnicos del MEP y carreras universitarias, con formularios y normativa fiscal costarricense vigente.' },
  { icon: RefreshCw,   tint: '#B8860B', title: 'Evolución continua',                desc: 'ContaSJ se compromete a mantener y actualizar la plataforma conforme cambie la legislación fiscal costarricense y las necesidades académicas de la Carrera.' },
];

const QUOTES = [
  { text: 'La contabilidad es el lenguaje de los negocios.',                          author: 'Warren Buffett',    role: 'CEO de Berkshire Hathaway' },
  { text: 'Lo que no se puede medir, no se puede mejorar.',                           author: 'Peter Drucker',     role: 'Padre de la Administración Moderna' },
  { text: 'Un buen sistema contable es la base de cualquier empresa exitosa.',        author: 'Robert Kiyosaki',  role: 'Autor de Padre Rico, Padre Pobre' },
  { text: 'La educación financiera es la habilidad más poderosa del siglo XXI.',      author: 'Alan Greenspan',   role: 'Ex Presidente de la Reserva Federal' },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const [exiting, setExiting]         = useState(false);
  const [mounted, setMounted]         = useState(false);
  const [quoteIdx, setQuoteIdx]       = useState(0);
  const [navScrolled, setNavScrolled] = useState(false);
  const [scrollY, setScrollY]         = useState(0);
  const [reduced, setReduced]         = useState(false);
  const [menuOpen, setMenuOpen]       = useState(false);

  const statsSection    = useInView(0.3);
  const convenioSection = useInView(0.15);
  const featSection     = useInView(0.05);
  const quoteSection    = useInView(0.3);
  const stepsSection    = useInView(0.2);
  const creatorSection  = useInView(0.2);
  const ctaSection      = useInView(0.3);

  useEffect(() => {
    setMounted(true);
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    setReduced(prefersReduced);
    const t = setInterval(() => setQuoteIdx(i => (i + 1) % QUOTES.length), 5000);
    let ticking = false;
    const onScroll = () => {
      const y = window.scrollY;
      setNavScrolled(y > 40); // React descarta el re-render si el booleano no cambia
      // Parallax: un update por frame (rAF) y omitido si se prefiere menos movimiento.
      if (prefersReduced) return;
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          const sy = window.scrollY;
          setScrollY(sy < 1000 ? sy : 1000); // parallax solo en la zona del hero
          ticking = false;
        });
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { clearInterval(t); window.removeEventListener('scroll', onScroll); };
  }, []);

  // Drawer móvil: bloquea el scroll del body y cierra con Escape mientras está abierto.
  useEffect(() => {
    if (!menuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const handleEnter = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    setTimeout(() => router.push('/login'), 380);
  }, [exiting, router]);

  const par = (factor: number) => (reduced ? 0 : scrollY * factor);
  const q = QUOTES[quoteIdx];

  return (
    <div style={{
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
      background: '#FFFFFF',
      opacity: mounted ? 1 : 0,
      transition: 'opacity 0.4s ease',
      overflowX: 'hidden',
    }}>

      {/* ── NAVBAR ─────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        height: navScrolled ? 58 : 64,
        background: navScrolled
          ? 'linear-gradient(90deg, #0B1E4A 0%, #16265E 50%, #1A3277 100%)'
          : 'linear-gradient(90deg, #0F2657 0%, #1B2E6E 50%, #1E3A8A 100%)',
        boxShadow: navScrolled ? '0 6px 26px rgba(15,38,87,0.55)' : '0 2px 20px rgba(15,38,87,0.45)',
        borderBottom: navScrolled ? '1px solid rgba(184,140,40,0.28)' : '1px solid transparent',
        padding: '0 clamp(16px,4vw,48px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, transition: 'height 0.3s ease, background 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
      }}>
        {/* Logo + brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 9, overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/sjqa-logo.png" alt="ContaSJ" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#FFFFFF', lineHeight: 1 }}>ContaSJ</div>
            <div style={{ fontSize: '0.58rem', color: 'rgba(147,197,253,0.75)', lineHeight: 1.3 }}>Contabilidad · Costa Rica</div>
          </div>
        </div>

        {/* Nav links (escritorio) */}
        <div className="lp-nav-links" style={{ alignItems: 'center', gap: 4, flex: 1, justifyContent: 'center', flexWrap: 'nowrap', overflow: 'hidden' }}>
          {[
            { label: 'Inicio',           href: '#hero' },
            { label: 'Funcionalidades',  href: '#funcionalidades' },
            { label: 'Cómo funciona',    href: '#como-funciona' },
            { label: 'Creadores',        href: '#creadores' },
          ].map(({ label, href }) => (
            <a
              key={href}
              href={href}
              style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '6px 14px', borderRadius: 8,
                fontSize: '0.82rem', fontWeight: 600,
                color: 'rgba(255,255,255,0.82)',
                textDecoration: 'none',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#FFFFFF'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.82)'; }}
            >
              {label}
            </a>
          ))}
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={handleEnter}
            className="lp-nav-cta"
            style={{
              alignItems: 'center', gap: 8, flexShrink: 0,
              padding: '9px 20px', borderRadius: 10,
              background: 'rgba(255,255,255,0.15)',
              color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.25)',
              fontSize: '0.84rem', fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.2s',
              backdropFilter: 'blur(8px)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            Ingresar <ArrowRight size={14} />
          </button>

          {/* Hamburguesa (móvil/tablet) */}
          <button
            className="lp-nav-hamburger"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={menuOpen}
            aria-controls="lp-mobile-drawer"
          >
            <Menu size={22} />
          </button>
        </div>
      </nav>

      {/* ── DRAWER MÓVIL ───────────────────────────────────────── */}
      <div
        className={`lp-drawer-overlay ${menuOpen ? 'open' : ''}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />
      <aside
        id="lp-mobile-drawer"
        className={`lp-drawer ${menuOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menú de navegación"
      >
        {/* Encabezado del drawer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/sjqa-logo.png" alt="ContaSJ" style={{ width: 34, height: 34, objectFit: 'contain' }} />
            </div>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#FFFFFF' }}>ContaSJ</span>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            aria-label="Cerrar menú"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#FFFFFF', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Enlaces + CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { label: 'Inicio',           href: '#hero' },
            { label: 'Funcionalidades',  href: '#funcionalidades' },
            { label: 'Cómo funciona',    href: '#como-funciona' },
            { label: 'Creadores',        href: '#creadores' },
          ].map(({ label, href }) => (
            <a
              key={href}
              href={href}
              className="lp-drawer-link lp-drawer-item"
              onClick={() => setMenuOpen(false)}
            >
              {label}
              <ArrowRight size={15} />
            </a>
          ))}
          <button
            onClick={() => { setMenuOpen(false); handleEnter(); }}
            className="lp-drawer-item"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginTop: 16, padding: '14px 20px', borderRadius: 12,
              background: '#B8860B', color: '#FFFFFF', border: 'none',
              fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
            }}
          >
            <GraduationCap size={18} /> Ingresar
          </button>
        </div>
      </aside>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section id="hero" className="lp-hero" style={{
        minHeight: '100svh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        paddingLeft: 'clamp(20px,5vw,80px)',
        paddingRight: 'clamp(20px,5vw,80px)',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
        background: '#0A1535',
      }}>
        {/* ── Fondo: blanco en bordes, azul marino profundo al centro ── */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(255,255,255,0.92) 0%, rgba(220,230,255,0.45) 22%, transparent 48%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to left, rgba(255,255,255,0.92) 0%, rgba(220,230,255,0.45) 22%, transparent 48%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '55%', height: '130%', borderRadius: '50%', background: 'radial-gradient(ellipse, #071030 0%, #0B1A42 45%, transparent 75%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-55%)', width: 520, height: 320, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(251,191,36,0.13) 0%, rgba(184,134,11,0.06) 50%, transparent 75%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.055) 1px, transparent 1px)', backgroundSize: '36px 36px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 0, left: '38%', width: 1, height: '100%', background: 'linear-gradient(to bottom, transparent, rgba(251,191,36,0.18) 45%, rgba(99,149,255,0.14) 70%, transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 0, right: '38%', width: 1, height: '100%', background: 'linear-gradient(to bottom, transparent, rgba(99,149,255,0.14) 50%, transparent)', pointerEvents: 'none' }} />

        {/* Spot-art de línea (parallax sutil, detrás del contenido) */}
        <div style={{ position: 'absolute', top: '17%', left: '7%', zIndex: 0, pointerEvents: 'none', transform: `translateY(${par(-0.06)}px)` }}>
          <div className="lp-drift"><GlyphBalance /></div>
        </div>
        <div style={{ position: 'absolute', bottom: '15%', right: '8%', zIndex: 0, pointerEvents: 'none', transform: `translateY(${par(0.08)}px)` }}>
          <div className="lp-drift-2"><GlyphBars /></div>
        </div>

        {/* Logos flotantes */}
        <div className="lp-in lp-in-d1 lp-hero-logos" style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>

          {/* UTN */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, animation: 'logo-float-a 5s ease-in-out infinite' }}>
            <div className="lp-logo-side" style={{
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.92)',
              border: '2px solid rgba(180,150,80,0.35)',
              boxShadow: '0 12px 40px rgba(120,90,30,0.18), 0 2px 8px rgba(0,0,0,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 12,
            }}>
              <img src="/utn-logo.png" alt="UTN" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Univ. Técnica Nacional</span>
          </div>

          {/* Separador UTN → ContaSJ */}
          <div className="lp-logo-sep" style={{ flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 1, height: 60, background: 'linear-gradient(to bottom,transparent,rgba(255,255,255,0.25),transparent)' }} />
            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'rgba(255,255,255,0.25)' }}>×</span>
            <div style={{ width: 1, height: 60, background: 'linear-gradient(to bottom,transparent,rgba(255,255,255,0.25),transparent)' }} />
          </div>

          {/* ContaSJ — logo central */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, animation: 'logo-float-c 4.5s ease-in-out infinite' }}>
            <div className="lp-logo-main" style={{
              borderRadius: '50%', overflow: 'hidden',
              background: '#000000',
              border: '3px solid rgba(180,140,40,0.7)',
              boxShadow: '0 0 0 6px rgba(180,140,40,0.12), 0 16px 48px rgba(100,70,10,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0,
            }}>
              <img src="/sjqa-logo.png" alt="ContaSJ" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>ContaSJ</span>
          </div>

          {/* Separador ContaSJ → C&F */}
          <div className="lp-logo-sep" style={{ flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 1, height: 60, background: 'linear-gradient(to bottom,transparent,rgba(255,255,255,0.25),transparent)' }} />
            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'rgba(255,255,255,0.25)' }}>×</span>
            <div style={{ width: 1, height: 60, background: 'linear-gradient(to bottom,transparent,rgba(255,255,255,0.25),transparent)' }} />
          </div>

          {/* C&F */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, animation: 'logo-float-b 6s ease-in-out infinite' }}>
            <div className="lp-logo-side" style={{
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.92)',
              border: '2px solid rgba(180,150,80,0.35)',
              boxShadow: '0 12px 40px rgba(120,90,30,0.18), 0 2px 8px rgba(0,0,0,0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 12,
            }}>
              <img src="/contabilidad-logo.png" alt="Contabilidad & Finanzas" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Contabilidad & Finanzas</span>
          </div>

        </div>

        {/* Badge */}
        <div className="lp-in lp-in-d2" style={{ position: 'relative', zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 18px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 999, marginBottom: 22, backdropFilter: 'blur(8px)' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FBBF24', display: 'inline-block', boxShadow: '0 0 8px rgba(251,191,36,0.7)' }} />
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Plataforma Académica · Costa Rica 2026</span>
        </div>

        {/* Heading */}
        <h1 className="lp-in lp-in-d3" style={{ position: 'relative', zIndex: 2, fontSize: 'clamp(2rem,5.5vw,3.8rem)', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.1, letterSpacing: '-0.03em', margin: '0 0 22px', maxWidth: 780 }}>
          El sistema donde la{' '}
          <span style={{ color: '#93C5FD' }}>contabilidad</span>{' '}
          se convierte en{' '}
          <span style={{ background: 'linear-gradient(135deg,#FBBF24,#F59E0B,#FDE68A)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            aprendizaje real
          </span>
        </h1>

        {/* Subtitle */}
        <p className="lp-in lp-in-d4" style={{ position: 'relative', zIndex: 2, fontSize: 'clamp(1rem,2vw,1.15rem)', color: 'rgba(255,255,255,0.72)', maxWidth: 580, lineHeight: 1.7, margin: '0 0 44px' }}>
          Ejercicios contables interactivos, facturación electrónica costarricense, evaluación automática y seguimiento de progreso — diseñado para colegios técnicos y universidades de Costa Rica.
        </p>

        {/* CTA */}
        <div className="lp-in lp-in-d5" style={{ position: 'relative', zIndex: 2, display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 52 }}>
          <button
            onClick={handleEnter}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '15px 36px', borderRadius: 14,
              background: '#1B2E6E', color: '#FFFFFF',
              border: 'none', fontSize: '1rem', fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.25s cubic-bezier(.22,1,.36,1)',
              boxShadow: '0 6px 28px rgba(27,46,110,0.35)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#B8860B'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(184,134,11,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#1B2E6E'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(27,46,110,0.35)'; }}
          >
            <GraduationCap size={20} />
            Ingresar al sistema
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Trust badges */}
        <div className="lp-in lp-in-d6" style={{ position: 'relative', zIndex: 2, display: 'flex', gap: 'clamp(14px,3vw,28px)', flexWrap: 'wrap', justifyContent: 'center' }}>
          {['Hacienda v4.4','Doble entrada NIIF'].map(l => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>
              <CheckCircle size={14} color="#34D399" strokeWidth={2.5} />
              {l}
            </div>
          ))}
        </div>

        {/* Scroll hint */}
        <div className="lp-bounce" style={{ position: 'absolute', zIndex: 3, bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Descubrir</span>
          <ChevronDown size={15} color="rgba(255,255,255,0.4)" />
        </div>
      </section>

      {/* ── STATS BAR ──────────────────────────────────────────── */}
      <section ref={statsSection.ref} style={{
        background: 'linear-gradient(135deg, #1B2E6E 0%, #1E3A8A 50%, #0F2657 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Blobs animados de fondo */}
        <div className="lp-blob-bg" style={{ opacity: 0.25 }} />
        <div className={`lp-reveal-stagger lp-stats-grid ${statsSection.inView ? 'visible' : ''}`} style={{
          maxWidth: 900, margin: '0 auto',
          position: 'relative', zIndex: 1,
        }}>
          <StatItem icon={Users}    value={200} suffix="+" label="Estudiantes activos"    active={statsSection.inView} />
          <StatItem icon={BookOpen} value={50}  suffix="+" label="Ejercicios prácticos"   active={statsSection.inView} />
          <StatItem icon={Layers}   value={6}   suffix=""  label="Módulos académicos"     active={statsSection.inView} />
          <StatItem icon={FileText} value={4}   suffix=""  label="Formularios tributarios" active={statsSection.inView} />
        </div>
      </section>

      {/* ── CONVENIO ContaSJ × UTN ─────────────────────────────────── */}
      <section ref={convenioSection.ref} style={{
        padding: 'clamp(70px,9vw,110px) clamp(20px,5vw,60px)',
        background: '#FFFFFF',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* orbe decorativo tenue */}
        <div style={{ position: 'absolute', top: -80, right: -60, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.06), transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1080, margin: '0 auto', position: 'relative', zIndex: 1 }}>

          {/* Eyebrow — pill institucional (sin emoji) */}
          <div className={`lp-reveal ${convenioSection.inView ? 'visible' : ''}`} style={{ display: 'flex', justifyContent: 'center', marginBottom: 26 }}>
            <div className="lp-shine" style={{
              display: 'inline-flex', alignItems: 'center', gap: 9,
              padding: '8px 20px', borderRadius: 999,
              background: 'rgba(27,46,110,0.06)',
              border: '1.5px solid rgba(27,46,110,0.18)',
              position: 'relative', overflow: 'hidden',
            }}>
              <Landmark size={14} color="#1B2E6E" strokeWidth={2} />
              <span style={{ fontSize: '0.68rem', fontWeight: 900, color: '#1B2E6E', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Alianza institucional
              </span>
            </div>
          </div>

          {/* Heading */}
          <h2 className={`lp-reveal ${convenioSection.inView ? 'visible' : ''}`} style={{
            textAlign: 'center', margin: '0 0 18px',
            fontSize: 'clamp(1.7rem,3.2vw,2.6rem)', fontWeight: 900,
            letterSpacing: '-0.02em', lineHeight: 1.15,
            background: 'linear-gradient(90deg,#1B2E6E,#1E3A8A,#2563EB,#1B2E6E)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: reduced ? 'none' : 'lp-gradient-flow 6s ease infinite',
          }}>
            ContaSJ y las instituciones de Costa Rica,<br />
            juntos por la educación contable
          </h2>

          <p className={`lp-reveal ${convenioSection.inView ? 'visible' : ''}`} style={{
            textAlign: 'center', fontSize: '1.05rem', color: '#475569',
            maxWidth: 700, margin: '0 auto 56px', lineHeight: 1.8,
            fontWeight: 500,
          }}>
            <strong>ContaSJ</strong> está diseñado para colegios técnicos y universidades de Costa Rica
            que quieran incorporar tecnología real en la enseñanza de contabilidad —
            sin costo para el estudiante y con soporte directo del equipo de desarrollo.
          </p>

          {/* Layout editorial: ilustración + lista refinada */}
          <div className="lp-two-col">

            {/* Panel ilustrado (spot-art de marca) */}
            <div style={{
              position: 'relative', borderRadius: 28, overflow: 'hidden',
              background: 'linear-gradient(150deg,#F8FAFC 0%,#EEF3FC 100%)',
              border: '1px solid #E2E8F0', minHeight: 340,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 12px 40px rgba(27,46,110,0.08)',
            }}>
              <div style={{ position: 'absolute', top: -44, right: -44, width: 168, height: 168, borderRadius: '50%', border: '2px dashed rgba(184,134,11,0.3)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(27,46,110,0.05) 1px, transparent 1px)', backgroundSize: '20px 20px', pointerEvents: 'none' }} />
              <div className="lp-drift" style={{ position: 'relative', zIndex: 1 }}>
                <ArtBalance size={230} />
              </div>
              <div className="lp-drift-2" style={{ position: 'absolute', top: 24, left: 20, zIndex: 2, transform: 'rotate(-6deg)', filter: 'drop-shadow(0 10px 20px rgba(27,46,110,0.15))' }}>
                <ArtInvoice size={78} />
              </div>
              <div className="lp-drift" style={{ position: 'absolute', bottom: 22, right: 24, zIndex: 2, filter: 'drop-shadow(0 10px 20px rgba(27,46,110,0.12))' }}>
                <ArtGrowth w={128} />
              </div>
            </div>

            {/* Lista refinada — 3 puntos con jerarquía y conector vertical */}
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 26, top: 34, bottom: 34, width: 2, background: 'linear-gradient(to bottom, rgba(27,46,110,0.18), rgba(27,46,110,0.06))', zIndex: 0 }} />
              {CONVENIO_POINTS.map((p, i) => (
                <div key={p.title} style={{
                  position: 'relative', zIndex: 1,
                  display: 'flex', gap: 18, alignItems: 'flex-start',
                  padding: '16px 0',
                  opacity: convenioSection.inView ? 1 : 0,
                  transform: convenioSection.inView ? 'translateX(0)' : 'translateX(18px)',
                  transition: `opacity 0.6s cubic-bezier(.22,1,.36,1) ${i * 130}ms, transform 0.6s cubic-bezier(.22,1,.36,1) ${i * 130}ms`,
                }}>
                  <div style={{ background: '#FFFFFF', borderRadius: 16 }}>
                    <IconTile icon={p.icon} tint={p.tint} size={54} />
                  </div>
                  <div style={{ paddingTop: 2 }}>
                    <h3 style={{ fontSize: '1.02rem', fontWeight: 800, color: '#1B2E6E', margin: '0 0 6px' }}>{p.title}</h3>
                    <p style={{ fontSize: '0.9rem', color: '#64748B', lineHeight: 1.65, margin: 0 }}>{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>

          {/* Logos firma */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 'clamp(20px,5vw,56px)', flexWrap: 'wrap', marginTop: 56,
            paddingTop: 36,
            borderTop: '1.5px solid #E2E8F0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 58, height: 58, borderRadius: '50%', overflow: 'hidden',
                background: '#000000',
                border: '2.5px solid #E2E8F0',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <img src="/sjqa-logo.png" alt="ContaSJ" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1B2E6E' }}>ContaSJ</span>
            </div>

            <div style={{ color: '#94A3B8', fontSize: '1.5rem', fontWeight: 300 }}>×</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 58, height: 58, borderRadius: 14, overflow: 'hidden',
                background: '#FFFFFF',
                border: '2.5px solid #E2E8F0',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6,
              }}>
                <img src="/utn-logo.png" alt="UTN" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1B2E6E', lineHeight: 1 }}>Universidad Técnica Nacional</div>
                <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 3 }}>Carrera de Contabilidad y Finanzas</div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────── */}
      <section id="funcionalidades" ref={featSection.ref} style={{ padding: 'clamp(60px,8vw,100px) clamp(20px,5vw,60px)', background: '#F8FAFC', position: 'relative' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto' }}>
          <div style={{ marginBottom: 52, opacity: featSection.inView ? 1 : 0, transform: featSection.inView ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity 0.6s ease, transform 0.6s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            {/* Eyebrow — etiqueta flanqueada por líneas doradas */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <span style={{ width: 34, height: 2, borderRadius: 2, background: 'linear-gradient(90deg, transparent, #B8860B)' }} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: '0.7rem', fontWeight: 800, color: '#B8860B', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                <Zap size={13} color="#B8860B" strokeWidth={2.2} /> Funcionalidades
              </span>
              <span style={{ width: 34, height: 2, borderRadius: 2, background: 'linear-gradient(90deg, #B8860B, transparent)' }} />
            </div>
            <h2 style={{ fontSize: 'clamp(1.7rem,3.5vw,2.6rem)', fontWeight: 900, color: '#0F172A', margin: '0 0 14px', letterSpacing: '-0.025em', maxWidth: 620 }}>
              Todo lo que necesitas para aprender contabilidad
            </h2>
            <p style={{ fontSize: '1rem', color: '#64748B', maxWidth: 520, margin: 0, lineHeight: 1.65 }}>
              Herramientas profesionales para colegios técnicos y universidades de Costa Rica.
            </p>
          </div>

          {/* Bento grid asimétrico */}
          <div className="lp-bento">
            {FEATURES.map((f, i) => (
              <BentoCard key={f.title} feature={f} index={i} delay={i * 70} visible={featSection.inView} />
            ))}
          </div>
        </div>
      </section>

      {/* ── QUOTE ──────────────────────────────────────────────── */}
      <section ref={quoteSection.ref} style={{
        padding: 'clamp(60px,8vw,90px) clamp(20px,5vw,60px)',
        background: 'linear-gradient(135deg,#1B2E6E 0%,#1E3A8A 50%,#0F2657 100%)',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 600, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 380, height: 380, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.07)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 700, margin: '0 auto', position: 'relative', opacity: quoteSection.inView ? 1 : 0, transform: quoteSection.inView ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity 0.7s ease, transform 0.7s ease' }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, margin: '0 auto 26px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(147,197,253,0.2)' }}>
            <Quote size={26} color="rgba(147,197,253,0.55)" />
          </div>
          <blockquote style={{ fontSize: 'clamp(1.1rem,2.5vw,1.5rem)', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.5, margin: '0 0 26px', fontStyle: 'italic', letterSpacing: '-0.01em', transition: 'opacity 0.4s ease' }}>
            &ldquo;{q.text}&rdquo;
          </blockquote>
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ fontSize: '0.9rem', color: '#93C5FD', fontWeight: 700, letterSpacing: '0.01em' }}>{q.author}</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(147,197,253,0.55)' }}>{q.role}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 32 }}>
            {QUOTES.map((_, i) => (
              <button key={i} onClick={() => setQuoteIdx(i)} aria-label={`Ver cita ${i + 1}`} style={{ width: i === quoteIdx ? 24 : 8, height: 8, borderRadius: 4, background: i === quoteIdx ? '#60A5FA' : 'rgba(255,255,255,0.25)', border: 'none', cursor: 'pointer', transition: 'all 0.3s', padding: 0 }} />
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────── */}
      <section id="como-funciona" ref={stepsSection.ref} style={{ padding: 'clamp(60px,8vw,100px) clamp(20px,5vw,60px)', background: '#FFFFFF' }}>
        <div style={{ maxWidth: 940, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60, opacity: stepsSection.inView ? 1 : 0, transform: stepsSection.inView ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity 0.6s ease, transform 0.6s ease' }}>
            {/* Eyebrow — kicker con icono en círculo y subrayado */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <span style={{ width: 30, height: 30, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(145deg,#2563EB,#1B2E6E)', boxShadow: '0 4px 12px rgba(27,46,110,0.3)' }}>
                <Layers size={14} color="#FFFFFF" strokeWidth={2.2} />
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1B2E6E', letterSpacing: '0.12em', textTransform: 'uppercase', borderBottom: '2px solid rgba(184,134,11,0.4)', paddingBottom: 3 }}>
                Cómo funciona
              </span>
            </div>
            <h2 style={{ fontSize: 'clamp(1.7rem,3.5vw,2.4rem)', fontWeight: 900, color: '#0F172A', margin: '0 0 14px', letterSpacing: '-0.025em' }}>
              Tres pasos para dominar la contabilidad
            </h2>
            <p style={{ fontSize: '1rem', color: '#64748B', maxWidth: 460, margin: '0 auto', lineHeight: 1.6 }}>
              Desde tu primera sesión hasta estados financieros completos.
            </p>
          </div>
          <div className="lp-steps" style={{ display: 'flex', gap: 'clamp(24px,4vw,48px)', flexWrap: 'wrap', justifyContent: 'center' }}>
            <StepCard number="1" title="Inicia sesión"      desc="Accede con las credenciales que te proporcionó tu institución o docente."                                  visible={stepsSection.inView} delay={0} />
            <StepCard number="2" title="Elige un ejercicio" desc="Selecciona entre ejercicios de diario, facturación, declaraciones o casos empresariales integrales."       visible={stepsSection.inView} delay={150} />
            <StepCard number="3" title="Aprende y evalúa"   desc="El sistema valida tu trabajo, califica automáticamente y muestra tu progreso en tiempo real."             visible={stepsSection.inView} delay={300} />
          </div>
        </div>
      </section>

      {/* ── CREATOR ────────────────────────────────────────────── */}
      <section id="creadores" ref={creatorSection.ref} style={{ padding: 'clamp(60px,8vw,100px) clamp(20px,5vw,60px)', background: '#F8FAFC' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ opacity: creatorSection.inView ? 1 : 0, transform: creatorSection.inView ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity 0.7s ease, transform 0.7s ease' }}>
            {/* Eyebrow — pill dorado con icono */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', background: 'linear-gradient(135deg,rgba(184,134,11,0.1),rgba(251,191,36,0.08))', border: '1px solid rgba(184,134,11,0.24)', borderRadius: 999, marginBottom: 20 }}>
              <Code2 size={13} color="#B8860B" strokeWidth={2} />
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#8A6608', letterSpacing: '0.11em', textTransform: 'uppercase' }}>Creadores</span>
            </div>
            <h2 style={{ fontSize: 'clamp(1.7rem,3.5vw,2.4rem)', fontWeight: 900, color: '#0F172A', margin: '0 0 12px', letterSpacing: '-0.025em' }}>
              Construido por estudiantes,<br />para estudiantes
            </h2>
            <p style={{ fontSize: '1rem', color: '#64748B', maxWidth: 480, margin: '0 auto 48px', lineHeight: 1.65 }}>
              ContaSJ fue fundada como proyecto de graduación en la Universidad Técnica Nacional de Costa Rica.
            </p>
            <div className="lp-creator-card" style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 24, background: '#FFFFFF', borderRadius: 28, border: '1px solid #E8EEF8', boxShadow: '0 12px 48px rgba(27,46,110,0.1)', position: 'relative', overflow: 'hidden' }}>
              {/* acento decorativo superior */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg,#1B2E6E,#2563EB,#B8860B)' }} />

              {/* Layout horizontal: foto + texto */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 40, flexWrap: 'wrap', justifyContent: 'center' }}>

                {/* Foto — más cuerpo visible */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <div style={{
                    width: 150, height: 198, borderRadius: 20, overflow: 'hidden',
                    border: '3px solid #FFFFFF',
                    boxShadow: '0 0 0 3px #1B2E6E, 0 16px 40px rgba(27,46,110,0.25)',
                  }}>
                    <img src="/founder.jpg" alt="Sebastián Quirós Arroyo"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }}
                    />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0F172A' }}>Sebastián Quirós Arroyo</div>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 2 }}>Fundador</div>
                  </div>
                </div>

                {/* Texto */}
                <div style={{ maxWidth: 320, textAlign: 'left' }}>
                  <div style={{ fontWeight: 900, fontSize: '1.3rem', color: '#0F172A', letterSpacing: '-0.02em', marginBottom: 6 }}>
                    ContaSJ
                  </div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16,
                    padding: '4px 14px', borderRadius: 999,
                    background: 'linear-gradient(135deg,rgba(27,46,110,0.07),rgba(37,99,235,0.07))',
                    border: '1px solid rgba(27,46,110,0.14)',
                  }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1B2E6E' }}>CEO &amp; AI-Powered Project Architect</span>
                  </div>
                  <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.7, margin: 0 }}>
                    ContaSJ fue fundada a los 19 años con la visión de crear sistemas inteligentes que conecten la educación con entornos reales de negocio.
                  </p>
                  <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.7, margin: '12px 0 0' }}>
                    Esta plataforma representa un nuevo estándar en tecnología académica: práctica, escalable y orientada al futuro.
                  </p>
                </div>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ──────────────────────────────────────────── */}
      <section ref={ctaSection.ref} style={{ padding: 'clamp(60px,8vw,100px) clamp(20px,5vw,60px)', background: 'linear-gradient(160deg,#0F172A 0%,#1B2E6E 100%)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div className="lp-blob-bg" style={{ opacity: 0.18 }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 700, height: 400, borderRadius: '50%', background: 'radial-gradient(ellipse,rgba(37,99,235,0.25) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div className={`lp-reveal-stagger ${ctaSection.inView ? 'visible' : ''}`} style={{ maxWidth: 580, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 15px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(147,197,253,0.2)', marginBottom: 20 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FBBF24', boxShadow: '0 0 8px rgba(251,191,36,0.7)' }} />
            <span style={{ fontSize: '0.66rem', fontWeight: 700, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Comienza hoy</span>
          </div>
          <h2 style={{ fontSize: 'clamp(1.7rem,3.5vw,2.6rem)', fontWeight: 900, color: '#FFFFFF', margin: '0 0 16px', letterSpacing: '-0.025em', lineHeight: 1.15 }}>
            Listo para comenzar tu camino en la contabilidad
          </h2>
          <p style={{ fontSize: '1rem', color: 'rgba(147,197,253,0.8)', margin: '0 0 40px', lineHeight: 1.65 }}>
            Únete a los estudiantes de colegios técnicos y universidades de Costa Rica que ya usan esta plataforma para aprender con casos reales.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={handleEnter}
              className="lp-pulse"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 12,
                padding: '17px 42px', borderRadius: 16,
                background: '#FFFFFF', color: '#1B2E6E',
                border: 'none', fontSize: '1.05rem', fontWeight: 800,
                cursor: 'pointer', transition: 'all 0.25s cubic-bezier(.22,1,.36,1)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.03)'; e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,0,0,0.45)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)'; }}
            >
              <GraduationCap size={22} />
              Ingresar al sistema
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer style={{ background: '#0F172A', padding: '28px clamp(20px,5vw,60px)', borderTop: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(96,165,250,0.4), rgba(184,134,11,0.4), transparent)' }} />
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)' }}>
            Conta<span style={{ color: '#60A5FA' }}>SJ</span>
            <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginLeft: 12 }}>Costa Rica</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)' }}>
            Desarrollado por <span style={{ color: 'rgba(96,165,250,0.6)', fontWeight: 600 }}>ContaSJ</span> · {new Date().getFullYear()}
          </div>
        </div>
      </footer>

    </div>
  );
}
