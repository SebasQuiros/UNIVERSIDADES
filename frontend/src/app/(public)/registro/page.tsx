'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle, ArrowRight, ArrowLeft, Building2,
  User, ClipboardList, GraduationCap,
  Globe, Phone, Mail, Loader2, AlertCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  // Step 1 — Universidad
  universityName: string;
  universityShortName: string;
  country: string;
  website: string;
  // Step 2 — Admin
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  // Step 3 — Confirmación
  acceptedTerms: boolean;
}

type StepErrors = Partial<Record<keyof FormData, string>>;

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const COUNTRIES = [
  'Costa Rica', 'Guatemala', 'El Salvador', 'Honduras', 'Nicaragua',
  'Panamá', 'México', 'Colombia', 'Venezuela', 'Ecuador', 'Perú',
  'Bolivia', 'Chile', 'Argentina', 'Uruguay', 'Paraguay', 'Brasil',
  'España', 'Estados Unidos', 'Otro',
];

const STEPS = [
  { label: 'Universidad',   icon: Building2     },
  { label: 'Administrador', icon: User          },
  { label: 'Confirmación',  icon: ClipboardList },
];

// ─── Colors & helpers ─────────────────────────────────────────────────────────

const C = {
  primary:   '#1B2E6E',
  accent:    '#2563EB',
  light:     '#EFF6FF',
  border:    '#E2E8F0',
  text:      '#0F172A',
  muted:     '#64748B',
  error:     '#DC2626',
  errorBg:   '#FEF2F2',
  success:   '#059669',
  successBg: '#ECFDF5',
  white:     '#FFFFFF',
  bg:        '#F8FAFC',
};

function Field({
  label, required, error, children,
}: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: '0.83rem', fontWeight: 600, color: C.text }}>
        {label}{required && <span style={{ color: C.error }}> *</span>}
      </label>
      {children}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: C.error }}>
          <AlertCircle size={12} />
          {error}
        </div>
      )}
    </div>
  );
}

const inputStyle = (hasError?: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '10px 14px',
  borderRadius: 10,
  border: `1.5px solid ${hasError ? C.error : C.border}`,
  fontSize: '0.9rem',
  color: C.text,
  background: C.white,
  outline: 'none',
  transition: 'border-color 0.2s',
  boxSizing: 'border-box',
});

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ width: '100%', marginBottom: 36 }}>
      {/* Step labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        {STEPS.map((s, i) => {
          const done    = i < current;
          const active  = i === current;
          const Icon    = s.icon;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: done ? C.success : active ? C.primary : C.bg,
                border: `2px solid ${done ? C.success : active ? C.primary : C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.3s',
              }}>
                {done
                  ? <CheckCircle size={18} color={C.white} />
                  : <Icon size={15} color={active ? C.white : C.muted} />
                }
              </div>
              <span style={{
                fontSize: '0.68rem', fontWeight: active || done ? 700 : 500,
                color: active ? C.primary : done ? C.success : C.muted,
                display: 'none',
              }}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
      {/* Progress line */}
      <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${(current / (total - 1)) * 100}%`,
          background: `linear-gradient(90deg, ${C.primary}, ${C.accent})`,
          borderRadius: 2, transition: 'width 0.4s cubic-bezier(.22,1,.36,1)',
        }} />
      </div>
      <div style={{ textAlign: 'right', fontSize: '0.72rem', color: C.muted, marginTop: 6 }}>
        Paso {current + 1} de {total}
      </div>
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export default function RegistroPage() {
  const router = useRouter();
  const [step, setStep]                 = useState(0);
  const [submitting, setSubmitting]     = useState(false);
  const [submitError, setSubmitError]   = useState('');
  const [success, setSuccess]           = useState(false);
  const [successData, setSuccessData]   = useState({ universityName: '', adminEmail: '' });
  const [errors, setErrors]             = useState<StepErrors>({});

  const [form, setForm] = useState<FormData>({
    universityName:      '',
    universityShortName: '',
    country:             'Costa Rica',
    website:             '',
    adminName:           '',
    adminEmail:          '',
    adminPhone:          '',
    acceptedTerms:       false,
  });

  const set = useCallback((field: keyof FormData, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  }, []);

  // ── Validation per step ─────────────────────────────────────────────────────

  function validateStep(s: number): boolean {
    const errs: StepErrors = {};

    if (s === 0) {
      if (!form.universityName.trim())      errs.universityName      = 'El nombre de la universidad es requerido.';
      if (!form.universityShortName.trim()) errs.universityShortName = 'Las siglas son requeridas.';
      if (form.universityShortName.trim().length > 20)
        errs.universityShortName = 'Máximo 20 caracteres.';
      if (!form.country.trim())             errs.country             = 'El país es requerido.';
      if (form.website && !/^https?:\/\/.+/.test(form.website))
        errs.website = 'Ingresa una URL válida (ej: https://universidad.edu)';
    }
    if (s === 1) {
      if (!form.adminName.trim())  errs.adminName  = 'El nombre del administrador es requerido.';
      if (!form.adminEmail.trim()) errs.adminEmail = 'El correo electrónico es requerido.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail))
        errs.adminEmail = 'Ingresa un correo válido.';
    }
    if (s === 2) {
      if (!form.acceptedTerms) errs.acceptedTerms = 'Debe aceptar los términos para continuar.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() {
    if (validateStep(step)) setStep(s => Math.min(s + 1, STEPS.length - 1));
  }
  function back() { setStep(s => Math.max(s - 1, 0)); }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!validateStep(2)) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`${API_BASE}/onboarding/university`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          universityName:      form.universityName.trim(),
          universityShortName: form.universityShortName.trim(),
          country:             form.country,
          website:             form.website.trim() || undefined,
          adminName:           form.adminName.trim(),
          adminEmail:          form.adminEmail.trim(),
          adminPhone:          form.adminPhone.trim() || undefined,
          acceptedTerms:       form.acceptedTerms,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.message || 'Error al procesar la solicitud.';
        throw new Error(Array.isArray(msg) ? msg[0] : msg);
      }
      setSuccessData({ universityName: form.universityName.trim(), adminEmail: form.adminEmail.trim() });
      setSuccess(true);
    } catch (err: any) {
      setSubmitError(err.message || 'Ocurrió un error inesperado. Por favor intente de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success screen ──────────────────────────────────────────────────────────

  if (success) {
    return (
      <div style={{
        minHeight: '100svh', background: C.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px',
      }}>
        <div style={{
          background: C.white, borderRadius: 24, padding: 'clamp(32px,6vw,56px)',
          maxWidth: 560, width: '100%',
          boxShadow: '0 20px 60px rgba(27,46,110,0.12)',
          border: `1px solid ${C.border}`,
          textAlign: 'center',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: C.successBg, border: `2px solid ${C.success}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <CheckCircle size={36} color={C.success} />
          </div>

          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: C.text, margin: '0 0 8px' }}>
            ¡Solicitud recibida!
          </h1>
          <p style={{ color: C.muted, fontSize: '0.95rem', margin: '0 0 32px', lineHeight: 1.6 }}>
            Tu universidad <strong style={{ color: C.text }}>{successData.universityName}</strong> ha sido registrada exitosamente.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 36 }}>
            {/* Email */}
            <div style={{ background: C.light, borderRadius: 12, padding: '16px 20px', textAlign: 'left', display: 'flex', gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Mail size={16} color={C.white} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: C.text, marginBottom: 3 }}>Revisa tu correo</div>
                <div style={{ fontSize: '0.8rem', color: C.muted, lineHeight: 1.5 }}>
                  Hemos enviado las credenciales de acceso a <strong>{successData.adminEmail}</strong>.
                  Si no ves el correo, revisa tu carpeta de spam.
                </div>
              </div>
            </div>

            {/* Password change notice */}
            <div style={{ background: '#FFFBEB', borderRadius: 12, padding: '16px 20px', textAlign: 'left', display: 'flex', gap: 14, border: '1px solid #FDE68A' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <GraduationCap size={16} color={C.white} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#92400E', marginBottom: 3 }}>Primer ingreso</div>
                <div style={{ fontSize: '0.8rem', color: '#78350F', lineHeight: 1.5 }}>
                  Al ingresar por primera vez, el sistema te pedirá cambiar tu contraseña temporal.
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => router.push('/login')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '13px 32px', borderRadius: 12,
              background: C.primary, color: C.white,
              border: 'none', fontSize: '0.95rem', fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.2s',
              boxShadow: `0 6px 20px rgba(27,46,110,0.28)`,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.primary; e.currentTarget.style.transform = 'none'; }}
          >
            Ir al login
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ── Wizard layout ───────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100svh', background: C.bg,
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
    }}>
      {/* Header bar */}
      <nav style={{
        background: `linear-gradient(90deg, #0F2657, #1B2E6E)`,
        padding: '0 clamp(16px,4vw,48px)', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, overflow: 'hidden', background: '#000' }}>
            <img src="/sjqa-logo.png" alt="SJQA GROUP" style={{ width: 34, height: 34, objectFit: 'contain' }} />
          </div>
          <span style={{ fontSize: '0.88rem', fontWeight: 800, color: C.white }}>SJQA GROUP</span>
        </div>
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'rgba(255,255,255,0.12)', color: C.white,
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 8, padding: '6px 14px', fontSize: '0.78rem',
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          ← Inicio
        </button>
      </nav>

      {/* Main content */}
      <div style={{
        maxWidth: 820, margin: '0 auto',
        padding: 'clamp(24px,4vw,48px) clamp(16px,4vw,24px)',
      }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 16px', background: 'rgba(27,46,110,0.07)',
            border: '1px solid rgba(27,46,110,0.12)', borderRadius: 999, marginBottom: 12,
          }}>
            <Building2 size={12} color={C.primary} />
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: C.primary, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              Registro de Universidad
            </span>
          </div>
          <h1 style={{ fontSize: 'clamp(1.4rem,3vw,2rem)', fontWeight: 900, color: C.text, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            Registra tu universidad en SJQA GROUP
          </h1>
          <p style={{ color: C.muted, fontSize: '0.9rem', margin: 0, lineHeight: 1.6 }}>
            Completa los siguientes pasos para solicitar acceso a la plataforma.
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: C.white, borderRadius: 20,
          padding: 'clamp(24px,4vw,40px)',
          boxShadow: '0 4px 24px rgba(27,46,110,0.08)',
          border: `1px solid ${C.border}`,
        }}>
          <ProgressBar current={step} total={STEPS.length} />

          {/* ── STEP 0: Universidad ───────────────────────────────── */}
          {step === 0 && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: C.text, margin: '0 0 4px' }}>
                  Información de la universidad
                </h2>
                <p style={{ color: C.muted, fontSize: '0.85rem', margin: 0 }}>
                  Ingresa los datos de tu institución educativa.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <Field label="Nombre completo de la universidad" required error={errors.universityName}>
                  <input
                    style={inputStyle(!!errors.universityName)}
                    value={form.universityName}
                    onChange={e => set('universityName', e.target.value)}
                    placeholder="Ej: Universidad Técnica Nacional"
                    onFocus={e => { e.target.style.borderColor = C.primary; }}
                    onBlur={e => { e.target.style.borderColor = errors.universityName ? C.error : C.border; }}
                  />
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Field label="Nombre corto / siglas" required error={errors.universityShortName}>
                    <input
                      style={inputStyle(!!errors.universityShortName)}
                      value={form.universityShortName}
                      onChange={e => set('universityShortName', e.target.value.toUpperCase())}
                      placeholder="Ej: UTN"
                      maxLength={20}
                      onFocus={e => { e.target.style.borderColor = C.primary; }}
                      onBlur={e => { e.target.style.borderColor = errors.universityShortName ? C.error : C.border; }}
                    />
                  </Field>
                  <Field label="País" required error={errors.country}>
                    <select
                      style={{ ...inputStyle(!!errors.country), appearance: 'auto' }}
                      value={form.country}
                      onChange={e => set('country', e.target.value)}
                    >
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                </div>

                <Field label="Sitio web institucional" error={errors.website}>
                  <div style={{ position: 'relative' }}>
                    <Globe size={16} color={C.muted} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      style={{ ...inputStyle(!!errors.website), paddingLeft: 36 }}
                      value={form.website}
                      onChange={e => set('website', e.target.value)}
                      placeholder="https://universidad.edu.cr"
                      type="url"
                      onFocus={e => { e.target.style.borderColor = C.primary; }}
                      onBlur={e => { e.target.style.borderColor = errors.website ? C.error : C.border; }}
                    />
                  </div>
                </Field>
              </div>
            </div>
          )}

          {/* ── STEP 1: Admin ─────────────────────────────────────── */}
          {step === 1 && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: C.text, margin: '0 0 4px' }}>
                  Datos del administrador
                </h2>
                <p style={{ color: C.muted, fontSize: '0.85rem', margin: 0 }}>
                  Esta persona recibirá las credenciales de acceso y será el administrador de la plataforma.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <Field label="Nombre completo del administrador" required error={errors.adminName}>
                  <div style={{ position: 'relative' }}>
                    <User size={16} color={C.muted} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      style={{ ...inputStyle(!!errors.adminName), paddingLeft: 36 }}
                      value={form.adminName}
                      onChange={e => set('adminName', e.target.value)}
                      placeholder="Ej: María González Pérez"
                      onFocus={e => { e.target.style.borderColor = C.primary; }}
                      onBlur={e => { e.target.style.borderColor = errors.adminName ? C.error : C.border; }}
                    />
                  </div>
                </Field>

                <Field label="Correo electrónico institucional" required error={errors.adminEmail}>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} color={C.muted} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      style={{ ...inputStyle(!!errors.adminEmail), paddingLeft: 36 }}
                      value={form.adminEmail}
                      onChange={e => set('adminEmail', e.target.value)}
                      placeholder="admin@universidad.edu.cr"
                      type="email"
                      onFocus={e => { e.target.style.borderColor = C.primary; }}
                      onBlur={e => { e.target.style.borderColor = errors.adminEmail ? C.error : C.border; }}
                    />
                  </div>
                </Field>

                <Field label="Teléfono de contacto" error={errors.adminPhone}>
                  <div style={{ position: 'relative' }}>
                    <Phone size={16} color={C.muted} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      style={{ ...inputStyle(false), paddingLeft: 36 }}
                      value={form.adminPhone}
                      onChange={e => set('adminPhone', e.target.value)}
                      placeholder="+506 8888-8888"
                      type="tel"
                      onFocus={e => { e.target.style.borderColor = C.primary; }}
                      onBlur={e => { e.target.style.borderColor = C.border; }}
                    />
                  </div>
                </Field>
              </div>
            </div>
          )}

          {/* ── STEP 2: Summary + confirm ─────────────────────────── */}
          {step === 2 && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: C.text, margin: '0 0 4px' }}>
                  Resumen y confirmación
                </h2>
                <p style={{ color: C.muted, fontSize: '0.85rem', margin: 0 }}>
                  Verifica que los datos sean correctos antes de enviar.
                </p>
              </div>

              {/* Summary card */}
              <div style={{ background: C.bg, borderRadius: 14, padding: 20, marginBottom: 20, border: `1px solid ${C.border}` }}>
                {/* Universidad */}
                <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Universidad</div>
                  <div style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
                    <div><span style={{ color: C.muted }}>Nombre: </span><strong>{form.universityName}</strong></div>
                    <div><span style={{ color: C.muted }}>Siglas: </span><strong>{form.universityShortName}</strong></div>
                    <div><span style={{ color: C.muted }}>País: </span><strong>{form.country}</strong></div>
                    {form.website && <div><span style={{ color: C.muted }}>Web: </span><strong>{form.website}</strong></div>}
                  </div>
                </div>

                {/* Admin */}
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Administrador</div>
                  <div style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
                    <div><span style={{ color: C.muted }}>Nombre: </span><strong>{form.adminName}</strong></div>
                    <div><span style={{ color: C.muted }}>Correo: </span><strong>{form.adminEmail}</strong></div>
                    {form.adminPhone && <div><span style={{ color: C.muted }}>Teléfono: </span><strong>{form.adminPhone}</strong></div>}
                  </div>
                </div>
              </div>

              {/* Terms checkbox */}
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
                padding: 16, borderRadius: 12, marginBottom: 16,
                background: form.acceptedTerms ? C.light : C.white,
                border: `1.5px solid ${errors.acceptedTerms ? C.error : form.acceptedTerms ? C.primary : C.border}`,
                transition: 'all 0.2s',
              }}>
                <input
                  type="checkbox"
                  checked={form.acceptedTerms}
                  onChange={e => set('acceptedTerms', e.target.checked)}
                  style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1, accentColor: C.primary }}
                />
                <span style={{ fontSize: '0.85rem', color: C.text, lineHeight: 1.5 }}>
                  Acepto los <a href="/terminos" target="_blank" style={{ color: C.accent, fontWeight: 600 }}>términos y condiciones de uso</a> de SJQA GROUP y confirmo que la información proporcionada es correcta.
                </span>
              </label>
              {errors.acceptedTerms && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.error, fontSize: '0.8rem', marginBottom: 12 }}>
                  <AlertCircle size={13} />
                  {errors.acceptedTerms}
                </div>
              )}

              {/* Submit error */}
              {submitError && (
                <div style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  background: C.errorBg, border: `1px solid #FECACA`,
                  borderRadius: 10, padding: '12px 16px',
                }}>
                  <AlertCircle size={18} color={C.error} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: '0.85rem', color: C.error, lineHeight: 1.5 }}>{submitError}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Navigation ────────────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, gap: 12 }}>
            <button
              onClick={back}
              disabled={step === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '11px 24px', borderRadius: 10,
                background: 'transparent', color: step === 0 ? '#CBD5E1' : C.muted,
                border: `1.5px solid ${step === 0 ? '#E2E8F0' : C.border}`,
                fontSize: '0.88rem', fontWeight: 600,
                cursor: step === 0 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <ArrowLeft size={15} />
              Atrás
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={next}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '11px 28px', borderRadius: 10,
                  background: C.primary, color: C.white,
                  border: 'none', fontSize: '0.88rem', fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: `0 4px 16px rgba(27,46,110,0.25)`,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.primary; e.currentTarget.style.transform = 'none'; }}
              >
                Siguiente
                <ArrowRight size={15} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '11px 28px', borderRadius: 10,
                  background: submitting ? '#94A3B8' : C.primary, color: C.white,
                  border: 'none', fontSize: '0.88rem', fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: submitting ? 'none' : `0 4px 16px rgba(27,46,110,0.25)`,
                }}
                onMouseEnter={e => { if (!submitting) { e.currentTarget.style.background = C.accent; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                onMouseLeave={e => { e.currentTarget.style.background = submitting ? '#94A3B8' : C.primary; e.currentTarget.style.transform = 'none'; }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                    Procesando...
                  </>
                ) : (
                  <>
                    Solicitar acceso
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Spin keyframes */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
