'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, BookOpen, Award, Calculator,
  BarChart3, Receipt, FileText, GraduationCap,
  ChevronDown, CheckCircle, Star,
  Quote, Code2, Layers, Zap,
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function LogoBadge({ src, alt, initials, size = 96 }: {
  src: string; alt: string; initials: string; size?: number;
}) {
  const [err, setErr] = useState(false);
  return (
    <div style={{
      width: size, height: size, borderRadius: 20, overflow: 'hidden',
      background: '#F1F5F9', border: '2px solid #E2E8F0',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    }}>
      {err ? (
        <span style={{ fontWeight: 900, fontSize: size * 0.26, color: '#1B2E6E' }}>{initials}</span>
      ) : (
        <img src={src} alt={alt}
          style={{ width: size * 0.82, height: size * 0.82, objectFit: 'contain' }}
          onError={() => setErr(true)}
        />
      )}
    </div>
  );
}

function StatItem({ value, suffix, label, active }: {
  value: number; suffix: string; label: string; active: boolean;
}) {
  const count = useCounter(value, 1800, active);
  return (
    <div style={{ textAlign: 'center', padding: '28px 20px' }}>
      <div style={{ fontSize: 'clamp(1.9rem, 4vw, 2.8rem)', fontWeight: 900, lineHeight: 1, color: '#FFFFFF' }}>
        {count}{suffix}
      </div>
      <div style={{ fontSize: '0.78rem', marginTop: 6, fontWeight: 500, color: 'rgba(147,197,253,0.85)' }}>
        {label}
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc, color, delay, visible }: {
  icon: React.ElementType; title: string; desc: string;
  color: string; delay: number; visible: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#FFFFFF', border: '1px solid #E8EEF8', borderRadius: 20,
        padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 14,
        boxShadow: hovered ? '0 20px 40px rgba(27,46,110,0.12)' : '0 2px 12px rgba(27,46,110,0.05)',
        transform: visible
          ? hovered ? 'translateY(-6px)' : 'translateY(0)'
          : 'translateY(28px)',
        opacity: visible ? 1 : 0,
        transition: `opacity 0.6s cubic-bezier(.22,1,.36,1) ${delay}ms, transform 0.4s cubic-bezier(.22,1,.36,1)`,
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}14`,
      }}>
        <Icon size={22} color={color} strokeWidth={2} />
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0F172A', marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: '0.83rem', color: '#64748B', lineHeight: 1.6 }}>{desc}</div>
      </div>
    </div>
  );
}

function StepCard({ number, title, desc, visible, delay }: {
  number: string; title: string; desc: string; visible: boolean; delay: number;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center', gap: 14, padding: '0 16px', flex: 1, minWidth: 200,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(28px)',
      transition: `opacity 0.6s cubic-bezier(.22,1,.36,1) ${delay}ms, transform 0.6s cubic-bezier(.22,1,.36,1) ${delay}ms`,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%', background: '#1B2E6E',
        color: 'white', fontWeight: 900, fontSize: '1.3rem',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(27,46,110,0.3)',
      }}>
        {number}
      </div>
      <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A' }}>{title}</div>
      <div style={{ fontSize: '0.83rem', color: '#64748B', lineHeight: 1.6 }}>{desc}</div>
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: Calculator, color: '#1B2E6E', title: 'Motor Contable de Doble Entrada',   desc: 'Partidas de diario, libros mayor, balances de comprobación y estados financieros completos con validación NIIF.' },
  { icon: Receipt,    color: '#0891B2', title: 'Facturación Electrónica CR',         desc: 'Compatible con Hacienda v4.3. Crea, valida y envía comprobantes electrónicos con firma digital real.' },
  { icon: BookOpen,   color: '#7C3AED', title: 'Ejercicios Contables Interactivos',  desc: 'Casos prácticos con empresas costarricenses reales. Retroalimentación automática al instante.' },
  { icon: Award,      color: '#D97706', title: 'Calificación con Rúbricas',          desc: 'Evaluación automática ponderada por criterios. El docente configura los pesos, el sistema califica.' },
  { icon: BarChart3,  color: '#059669', title: 'Dashboards de Progreso',             desc: 'Métricas de desempeño en tiempo real. Estudiantes y profesores visualizan avances y brechas.' },
  { icon: FileText,   color: '#DC2626', title: 'Formularios Tributarios',            desc: 'D-101, D-103, D-104 y D-115. Declaraciones de renta, IVA y retenciones del Ministerio de Hacienda.' },
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
  const [exiting, setExiting]       = useState(false);
  const [mounted, setMounted]       = useState(false);
  const [quoteIdx, setQuoteIdx]     = useState(0);
  const [navScrolled, setNavScrolled] = useState(false);

  const statsSection    = useInView(0.3);
  const convenioSection = useInView(0.15);
  const featSection     = useInView(0.05);
  const quoteSection    = useInView(0.3);
  const stepsSection    = useInView(0.2);
  const creatorSection  = useInView(0.2);
  const ctaSection      = useInView(0.3);

  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => setQuoteIdx(i => (i + 1) % QUOTES.length), 5000);
    const onScroll = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { clearInterval(t); window.removeEventListener('scroll', onScroll); };
  }, []);

  const handleEnter = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    setTimeout(() => router.push('/login'), 380);
  }, [exiting, router]);

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
        height: 64,
        background: 'linear-gradient(90deg, #0F2657 0%, #1B2E6E 50%, #1E3A8A 100%)',
        boxShadow: '0 2px 20px rgba(15,38,87,0.45)',
        padding: '0 clamp(16px,4vw,48px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16,
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

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'center', flexWrap: 'nowrap', overflow: 'hidden' }}>
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
            style={{
              display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
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
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section id="hero" style={{
        minHeight: '100svh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        paddingTop: 90, paddingBottom: 80,
        paddingLeft: 'clamp(20px,5vw,80px)',
        paddingRight: 'clamp(20px,5vw,80px)',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg, #0A163C 0%, #0F2657 40%, #1B2E6E 100%)',
      }}>
        {/* Dark overlay for readability */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(10,22,60,0.82) 0%, rgba(15,38,87,0.78) 50%, rgba(10,22,60,0.88) 100%)', pointerEvents: 'none' }} />
        {/* Subtle blue vignette */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(37,99,235,0.08) 0%, rgba(10,22,60,0.3) 80%)', pointerEvents: 'none' }} />

        {/* Logos flotantes */}
        <div className="lp-in lp-in-d1" style={{ display: 'flex', alignItems: 'center', gap: 'clamp(24px,5vw,56px)', marginBottom: 48, flexWrap: 'wrap', justifyContent: 'center' }}>

          {/* UTN */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, animation: 'logo-float-a 5s ease-in-out infinite' }}>
            <div style={{
              width: 148, height: 148, borderRadius: 32, overflow: 'hidden',
              background: 'rgba(255,255,255,0.95)',
              border: '2px solid rgba(255,255,255,0.3)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 12,
            }}>
              <img src="/utn-logo.png" alt="UTN" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Univ. Técnica Nacional</span>
          </div>

          {/* Separador UTN → ContaSJ */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 1, height: 60, background: 'linear-gradient(to bottom,transparent,rgba(255,255,255,0.3),transparent)' }} />
            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)' }}>×</span>
            <div style={{ width: 1, height: 60, background: 'linear-gradient(to bottom,transparent,rgba(255,255,255,0.3),transparent)' }} />
          </div>

          {/* ContaSJ — logo central */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, animation: 'logo-float-c 4.5s ease-in-out infinite' }}>
            <div style={{
              width: 172, height: 172, borderRadius: '50%', overflow: 'hidden',
              background: '#000000',
              border: '3px solid rgba(96,165,250,0.55)',
              boxShadow: '0 0 0 6px rgba(96,165,250,0.12), 0 16px 56px rgba(0,0,0,0.5), 0 2px 10px rgba(0,0,0,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0,
            }}>
              <img src="/sjqa-logo.png" alt="ContaSJ" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>ContaSJ</span>
          </div>

          {/* Separador ContaSJ → C&F */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 1, height: 60, background: 'linear-gradient(to bottom,transparent,rgba(255,255,255,0.3),transparent)' }} />
            <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)' }}>×</span>
            <div style={{ width: 1, height: 60, background: 'linear-gradient(to bottom,transparent,rgba(255,255,255,0.3),transparent)' }} />
          </div>

          {/* C&F */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, animation: 'logo-float-b 6s ease-in-out infinite' }}>
            <div style={{
              width: 148, height: 148, borderRadius: 32, overflow: 'hidden',
              background: 'rgba(255,255,255,0.95)',
              border: '2px solid rgba(255,255,255,0.3)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 12,
            }}>
              <img src="/contabilidad-logo.png" alt="Contabilidad & Finanzas" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Contabilidad & Finanzas</span>
          </div>

        </div>

        {/* Badge */}
        <div className="lp-in lp-in-d2" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 18px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 999, marginBottom: 22, backdropFilter: 'blur(8px)' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#60A5FA', display: 'inline-block', boxShadow: '0 0 8px #60A5FA' }} />
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Plataforma Académica · Costa Rica 2026</span>
        </div>

        {/* Heading */}
        <h1 className="lp-in lp-in-d3" style={{ fontSize: 'clamp(2rem,5.5vw,3.8rem)', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.1, letterSpacing: '-0.03em', margin: '0 0 22px', maxWidth: 780 }}>
          El sistema donde la{' '}
          <span style={{ color: '#93C5FD' }}>contabilidad</span>{' '}
          se convierte en{' '}
          <span style={{ background: 'linear-gradient(135deg,#60A5FA,#38BDF8,#34D399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            aprendizaje real
          </span>
        </h1>

        {/* Subtitle */}
        <p className="lp-in lp-in-d4" style={{ fontSize: 'clamp(1rem,2vw,1.15rem)', color: 'rgba(255,255,255,0.75)', maxWidth: 580, lineHeight: 1.7, margin: '0 0 44px' }}>
          Ejercicios contables interactivos, facturación electrónica costarricense, evaluación automática y seguimiento de progreso — diseñado para colegios técnicos y universidades de Costa Rica.
        </p>

        {/* CTA */}
        <div className="lp-in lp-in-d5" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 52 }}>
          <button
            onClick={handleEnter}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '15px 36px', borderRadius: 14,
              background: '#1B2E6E', color: '#FFFFFF',
              border: 'none', fontSize: '1rem', fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.25s cubic-bezier(.22,1,.36,1)',
              boxShadow: '0 6px 28px rgba(27,46,110,0.32)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#2563EB'; e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(37,99,235,0.38)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#1B2E6E'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(27,46,110,0.32)'; }}
          >
            <GraduationCap size={20} />
            Ingresar al sistema
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Trust badges */}
        <div className="lp-in lp-in-d6" style={{ display: 'flex', gap: 'clamp(14px,3vw,28px)', flexWrap: 'wrap', justifyContent: 'center' }}>
          {['Hacienda v4.3','Doble entrada NIIF'].map(l => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
              <CheckCircle size={14} color="#34D399" strokeWidth={2.5} />
              {l}
            </div>
          ))}
        </div>

        {/* Scroll hint */}
        <div className="lp-bounce" style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Descubrir</span>
          <ChevronDown size={15} color="rgba(255,255,255,0.45)" />
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
        <div className={`lp-reveal-stagger ${statsSection.inView ? 'visible' : ''}`} style={{
          maxWidth: 900, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
          position: 'relative', zIndex: 1,
        }}>
          <StatItem value={200} suffix="+" label="Estudiantes activos"    active={statsSection.inView} />
          <StatItem value={50}  suffix="+" label="Ejercicios prácticos"   active={statsSection.inView} />
          <StatItem value={6}   suffix=""  label="Módulos académicos"     active={statsSection.inView} />
          <StatItem value={4}   suffix=""  label="Formularios tributarios" active={statsSection.inView} />
        </div>
      </section>

      {/* ── CONVENIO ContaSJ × UTN ─────────────────────────────────── */}
      <section ref={convenioSection.ref} style={{
        padding: 'clamp(70px,9vw,110px) clamp(20px,5vw,60px)',
        background: '#FFFFFF',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', position: 'relative', zIndex: 1 }}>

          {/* Pill */}
          <div className={`lp-reveal ${convenioSection.inView ? 'visible' : ''}`} style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <div className="lp-shine" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '7px 22px', borderRadius: 999,
              background: 'rgba(27,46,110,0.07)',
              border: '1.5px solid rgba(27,46,110,0.2)',
              position: 'relative', overflow: 'hidden',
            }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 900, color: '#1B2E6E', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                🇨🇷 Acuerdo Institucional
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
            animation: 'lp-gradient-flow 6s ease infinite',
          }}>
            ContaSJ y las instituciones de Costa Rica,<br />
            juntos por la educación contable
          </h2>

          <p className={`lp-reveal ${convenioSection.inView ? 'visible' : ''}`} style={{
            textAlign: 'center', fontSize: '1.05rem', color: '#475569',
            maxWidth: 700, margin: '0 auto 52px', lineHeight: 1.8,
            fontWeight: 500,
          }}>
            <strong>ContaSJ</strong> está diseñado para colegios técnicos y universidades de Costa Rica
            que quieran incorporar tecnología real en la enseñanza de contabilidad —
            sin costo para el estudiante y con soporte directo del equipo de desarrollo.
          </p>

          {/* Cards */}
          <div className={`lp-reveal-stagger ${convenioSection.inView ? 'visible' : ''}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 20 }}>

            {/* Card 1 */}
            <div className="lp-card-pro" style={{
              borderRadius: 20, padding: '30px 26px',
              background: '#F8FAFC',
              border: '1.5px solid #E2E8F0',
              boxShadow: '0 4px 16px rgba(27,46,110,0.07)',
            }}>
              <div className="lp-bounce" style={{ fontSize: 34, marginBottom: 14, display: 'inline-block' }}>🎓</div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1B2E6E', margin: '0 0 10px' }}>
                Acceso para todos los estudiantes
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#64748B', lineHeight: 1.65, margin: 0 }}>
                Cualquier estudiante activo de un colegio técnico o universidad puede ingresar con su cuenta institucional. La licencia es cubierta por la institución, sin costo directo para el estudiante.
              </p>
            </div>

            {/* Card 2 */}
            <div className="lp-card-pro" style={{
              borderRadius: 20, padding: '30px 26px',
              background: '#F8FAFC',
              border: '1.5px solid #E2E8F0',
              boxShadow: '0 4px 16px rgba(27,46,110,0.07)',
            }}>
              <div className="lp-bounce" style={{ fontSize: 34, marginBottom: 14, display: 'inline-block', animationDelay: '0.4s' }}>🤝</div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1B2E6E', margin: '0 0 10px' }}>
                Alineado al currículo nacional
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#64748B', lineHeight: 1.65, margin: 0 }}>
                El sistema está alineado con el plan de estudios de contabilidad de colegios técnicos del MEP y carreras universitarias, con formularios y normativa fiscal costarricense vigente.
              </p>
            </div>

            {/* Card 3 */}
            <div className="lp-card-pro" style={{
              borderRadius: 20, padding: '30px 26px',
              background: '#F8FAFC',
              border: '1.5px solid #E2E8F0',
              boxShadow: '0 4px 16px rgba(27,46,110,0.07)',
            }}>
              <div className="lp-bounce" style={{ fontSize: 34, marginBottom: 14, display: 'inline-block', animationDelay: '0.8s' }}>⚡</div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1B2E6E', margin: '0 0 10px' }}>
                Evolución continua
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#64748B', lineHeight: 1.65, margin: 0 }}>
                ContaSJ se compromete a mantener y actualizar la plataforma conforme cambie la legislación fiscal costarricense y las necesidades académicas de la Carrera.
              </p>
            </div>

          </div>

          {/* Logos firma */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 'clamp(20px,5vw,56px)', flexWrap: 'wrap', marginTop: 52,
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
      <section id="funcionalidades" ref={featSection.ref} style={{ padding: 'clamp(60px,8vw,100px) clamp(20px,5vw,60px)', background: '#F8FAFC' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56, opacity: featSection.inView ? 1 : 0, transform: featSection.inView ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity 0.6s ease, transform 0.6s ease' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 16px', background: 'rgba(27,46,110,0.07)', border: '1px solid rgba(27,46,110,0.12)', borderRadius: 999, marginBottom: 16 }}>
              <Zap size={12} color="#1B2E6E" />
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#1B2E6E', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Funcionalidades</span>
            </div>
            <h2 style={{ fontSize: 'clamp(1.7rem,3.5vw,2.6rem)', fontWeight: 900, color: '#0F172A', margin: '0 0 14px', letterSpacing: '-0.025em' }}>
              Todo lo que necesitas para aprender contabilidad
            </h2>
            <p style={{ fontSize: '1rem', color: '#64748B', maxWidth: 500, margin: '0 auto', lineHeight: 1.65 }}>
              Herramientas profesionales para colegios técnicos y universidades de Costa Rica.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 20 }}>
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.title} {...f} delay={i * 80} visible={featSection.inView} />
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

        <div style={{ maxWidth: 680, margin: '0 auto', position: 'relative', opacity: quoteSection.inView ? 1 : 0, transform: quoteSection.inView ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity 0.7s ease, transform 0.7s ease' }}>
          <Quote size={36} color="rgba(147,197,253,0.4)" style={{ margin: '0 auto 24px' }} />
          <blockquote style={{ fontSize: 'clamp(1.1rem,2.5vw,1.5rem)', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.5, margin: '0 0 24px', fontStyle: 'italic', letterSpacing: '-0.01em', transition: 'opacity 0.4s ease' }}>
            &ldquo;{q.text}&rdquo;
          </blockquote>
          <div style={{ fontSize: '0.88rem', color: 'rgba(147,197,253,0.85)', fontWeight: 600 }}>{q.author}</div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(147,197,253,0.5)', marginTop: 4 }}>{q.role}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 32 }}>
            {QUOTES.map((_, i) => (
              <button key={i} onClick={() => setQuoteIdx(i)} style={{ width: i === quoteIdx ? 24 : 8, height: 8, borderRadius: 4, background: i === quoteIdx ? '#60A5FA' : 'rgba(255,255,255,0.25)', border: 'none', cursor: 'pointer', transition: 'all 0.3s', padding: 0 }} />
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────── */}
      <section id="como-funciona" ref={stepsSection.ref} style={{ padding: 'clamp(60px,8vw,100px) clamp(20px,5vw,60px)', background: '#FFFFFF' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60, opacity: stepsSection.inView ? 1 : 0, transform: stepsSection.inView ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity 0.6s ease, transform 0.6s ease' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 16px', background: 'rgba(27,46,110,0.07)', border: '1px solid rgba(27,46,110,0.12)', borderRadius: 999, marginBottom: 16 }}>
              <Layers size={12} color="#1B2E6E" />
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#1B2E6E', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Cómo funciona</span>
            </div>
            <h2 style={{ fontSize: 'clamp(1.7rem,3.5vw,2.4rem)', fontWeight: 900, color: '#0F172A', margin: '0 0 14px', letterSpacing: '-0.025em' }}>
              Tres pasos para dominar la contabilidad
            </h2>
            <p style={{ fontSize: '1rem', color: '#64748B', maxWidth: 460, margin: '0 auto', lineHeight: 1.6 }}>
              Desde tu primera sesión hasta estados financieros completos.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'clamp(24px,4vw,48px)', flexWrap: 'wrap', justifyContent: 'center', position: 'relative' }}>
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
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 16px', background: 'rgba(27,46,110,0.07)', border: '1px solid rgba(27,46,110,0.12)', borderRadius: 999, marginBottom: 20 }}>
              <Code2 size={12} color="#1B2E6E" />
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#1B2E6E', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Creadores</span>
            </div>
            <h2 style={{ fontSize: 'clamp(1.7rem,3.5vw,2.4rem)', fontWeight: 900, color: '#0F172A', margin: '0 0 12px', letterSpacing: '-0.025em' }}>
              Construido por estudiantes,<br />para estudiantes
            </h2>
            <p style={{ fontSize: '1rem', color: '#64748B', maxWidth: 480, margin: '0 auto 48px', lineHeight: 1.65 }}>
              ContaSJ fue fundada como proyecto de graduación en la Universidad Técnica Nacional de Costa Rica.
            </p>
            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '40px 56px', background: '#FFFFFF', borderRadius: 28, border: '1px solid #E8EEF8', boxShadow: '0 12px 48px rgba(27,46,110,0.1)' }}>

              {/* Layout horizontal: foto + texto */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 40, flexWrap: 'wrap', justifyContent: 'center' }}>

                {/* Foto — más cuerpo visible */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <div style={{
                    width: 150, height: 198, borderRadius: 20, overflow: 'hidden',
                    border: '3px solid #FFFFFF',
                    boxShadow: '0 0 0 3px #1B2E6E, 0 16px 40px rgba(27,46,110,0.25)',
                  }}>
                    <img src="/founder.jpg" alt="Sebastian Quiros Arroyo"
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
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1B2E6E' }}>CEO & AI-Powered Project Architect</span>
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
      <footer style={{ background: '#0F172A', padding: '28px clamp(20px,5vw,60px)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
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
