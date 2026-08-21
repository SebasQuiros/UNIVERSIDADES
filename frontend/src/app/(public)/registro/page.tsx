'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { IconTile } from '@/components/ui/IconTile';
import { SceneWelcome } from '@/components/illustrations';
import {
  CheckCircle2, ArrowRight, ArrowLeft, Building2,
  User, ClipboardList, GraduationCap, ShieldCheck, Sparkles,
  Globe, Phone, Mail, AlertCircle, Check, KeyRound, Copy,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  // Paso 1 — Universidad
  universityName: string;
  universityShortName: string;
  country: string;
  website: string;
  // Paso 2 — Admin
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  // Paso 3 — Confirmación
  acceptedTerms: boolean;
}

type StepErrors = Partial<Record<keyof FormData, string>>;

/** Respuesta del endpoint público de onboarding (sólo lo que consumimos). */
interface OnboardingResponse {
  message?: string | string[];
  /**
   * Credenciales del administrador recién creado. Vienen acá y no solo por
   * correo: si el SMTP no está configurado, el correo no sale nunca y quien
   * se registra queda sin poder entrar jamás, sin ningún error a la vista.
   */
  credenciales?: { email: string; contrasenaTemporal: string; aviso?: string };
  correoEnviado?: boolean;
}

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

const BENEFITS = [
  { icon: GraduationCap, label: 'Cada estudiante opera su propia empresa contable' },
  { icon: ShieldCheck,   label: 'Datos aislados por institución y por empresa' },
  { icon: Sparkles,      label: 'Calificación automática por rúbricas' },
];

// ─── Campos ───────────────────────────────────────────────────────────────────

const INPUT_BASE =
  'w-full rounded-xl bg-white border text-sm text-gray-900 placeholder-gray-400 transition-colors ' +
  'px-4 py-2.5 focus:outline-none focus:ring-2';

const inputCls = (hasError?: boolean, withIcon?: boolean) =>
  `${INPUT_BASE} ${withIcon ? 'pl-10' : ''} ${
    hasError
      ? 'border-red-400 focus:ring-red-500/60 focus:border-red-500'
      : 'border-gray-300 hover:border-gray-400 focus:ring-blue-500/60 focus:border-blue-500'
  }`;

function Field({
  label, required, error, children,
}: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600 cx-shake">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ current }: { current: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const done   = i < current;
          const active = i === current;
          const Icon   = s.icon;
          return (
            <div key={s.label} className="flex items-center gap-2 flex-1 last:flex-none">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border transition-all ${
                  done
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                    : active
                      ? 'bg-gradient-to-br from-blue-600 to-[#1B2E6E] border-transparent text-white shadow-[0_6px_18px_rgba(27,46,110,0.28)] cx-pop'
                      : 'bg-gray-50 border-gray-200 text-gray-400'
                }`}
              >
                {done
                  ? <Check className="w-4 h-4" strokeWidth={2.6} />
                  : <Icon className="w-4 h-4" strokeWidth={1.9} />}
              </div>
              {i < STEPS.length - 1 && (
                <div className="h-1 flex-1 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-[#1B2E6E] transition-all duration-500"
                    style={{ width: done ? '100%' : '0%' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-3">
        <p className="text-sm font-bold text-gray-800">{STEPS[current].label}</p>
        <p className="text-xs text-gray-400 font-mono tabular-nums">
          Paso {current + 1} de {STEPS.length}
        </p>
      </div>
    </div>
  );
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

export default function RegistroPage() {
  const router = useRouter();
  const [step, setStep]               = useState(0);
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess]         = useState(false);
  const [successData, setSuccessData] = useState<{
    universityName: string; adminEmail: string;
    contrasenaTemporal?: string; correoEnviado?: boolean;
  }>({ universityName: '', adminEmail: '' });
  const [copiado, setCopiado] = useState(false);
  const [errors, setErrors]           = useState<StepErrors>({});

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

  // ── Validación por paso ─────────────────────────────────────────────────────

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

  // ── Envío ───────────────────────────────────────────────────────────────────

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
      const data: OnboardingResponse = await res.json();
      if (!res.ok) {
        const msg = data?.message || 'Error al procesar la solicitud.';
        throw new Error(Array.isArray(msg) ? msg[0] : msg);
      }
      setSuccessData({
        universityName:     form.universityName.trim(),
        adminEmail:         data.credenciales?.email ?? form.adminEmail.trim(),
        contrasenaTemporal: data.credenciales?.contrasenaTemporal,
        correoEnviado:      data.correoEnviado,
      });
      setSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setSubmitError(msg || 'Ocurrió un error inesperado. Por favor intente de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#EFF6FF' }}>

      {/* ── Panel izquierdo: marca (solo desktop) ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #03080F 0%, #0F2657 60%, #1E3A8A 100%)' }}
      >
        <div className="lp-blob-bg" aria-hidden />
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
        />

        {/* Logo + marca */}
        <Link href="/" className="flex items-center gap-3 relative z-10 w-fit">
          <div
            className="w-10 h-10 rounded-[11px] overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{ background: '#000', boxShadow: '0 0 20px rgba(59,130,246,0.4)' }}
          >
            <Image src="/sjqa-logo.png" alt="ContaSJ" width={40} height={40} priority className="w-10 h-10 object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight leading-none" style={{ color: '#60A5FA' }}>
              ContaSJ
            </h1>
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.16em] mt-1" style={{ color: '#FBBF24' }}>
              Plataforma educativa · Costa Rica
            </p>
          </div>
        </Link>

        {/* Contenido central */}
        <div className="relative z-10 space-y-8 lp-in lp-in-d2">
          <div>
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] mb-3" style={{ color: '#FBBF24' }}>
              Registro institucional
            </p>
            <p
              className="text-white font-extrabold leading-tight"
              style={{ fontSize: 'clamp(1.4rem,2.4vw,1.9rem)', letterSpacing: '-0.02em' }}
            >
              Lleva tu curso de contabilidad{' '}
              <span style={{ color: '#93C5FD' }}>a la práctica real.</span>
            </p>
          </div>

          <div className="flex justify-center lp-drift" aria-hidden>
            <SceneWelcome size={250} />
          </div>

          <div className="space-y-3">
            {BENEFITS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(59,130,246,0.22)', border: '1px solid rgba(96,165,250,0.2)' }}
                >
                  <Icon className="w-4 h-4" style={{ color: '#93C5FD' }} strokeWidth={1.9} />
                </div>
                <span className="text-white/80 text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 text-[0.68rem] font-medium px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(184,134,11,0.28)', color: 'rgba(253,230,138,0.9)' }}
          >
            IVA 13% · Hacienda v4.4 · NIIF PYMES
          </span>
          <span className="text-xs ml-auto" style={{ color: 'rgba(96,165,250,0.6)' }}>
            © {new Date().getFullYear()}
          </span>
        </div>
      </div>

      {/* ── Panel derecho: wizard / éxito ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white overflow-y-auto">
        <div className="w-full max-w-lg">

          {/* Cabecera móvil */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center justify-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-[10px] overflow-hidden flex items-center justify-center" style={{ background: '#000' }}>
                <Image src="/sjqa-logo.png" alt="ContaSJ" width={36} height={36} className="w-9 h-9 object-contain" />
              </div>
              <h1 className="text-2xl font-black tracking-tight">
                <span style={{ color: '#2563EB' }}>ContaSJ</span>
              </h1>
            </Link>
          </div>

          {success ? (
            /* ── Pantalla de éxito ── */
            <div className="text-center">
              <div className="flex justify-center mb-5 cx-tada">
                <IconTile icon={CheckCircle2} tint="#059669" size={64} />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold-900 mb-1">
                Solicitud recibida
              </p>
              <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">
                ¡Ya casi estamos!
              </h2>
              <p className="text-gray-500 text-sm mt-2">
                Registramos a <strong className="text-gray-800">{successData.universityName}</strong> en ContaSJ.
              </p>

              <div className="mt-7 space-y-3 text-left">
                {/* ── Las credenciales, en pantalla ──────────────────────────
                    Antes esta pantalla decía "revisa tu correo" y nada más. Si
                    el SMTP no está configurado ese correo no sale nunca, y
                    quien se registraba quedaba sin poder entrar jamás: cuenta
                    creada, contraseña generada, y ninguna forma de conocerla.
                    Ahora se muestran acá, que es donde con seguridad llegan. */}
                {successData.contrasenaTemporal && (
                  <div className="p-4 rounded-card bg-gold-50 border-2 border-gold-300">
                    <div className="flex gap-3.5">
                      <IconTile icon={KeyRound} tint="#B8860B" size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gold-900">
                          Tus credenciales — anotalas ahora
                        </p>
                        <p className="text-xs text-gold-900/80 mt-0.5 leading-relaxed">
                          Es la única vez que se muestran. Cambiá la contraseña al entrar.
                        </p>

                        <div className="mt-3 space-y-1.5">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-gold-900/60">Correo</p>
                            <p className="font-mono text-sm text-gray-900 break-all">{successData.adminEmail}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-gold-900/60">Contraseña temporal</p>
                            <p className="font-mono text-sm font-bold text-gray-900 break-all">
                              {successData.contrasenaTemporal}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard
                              ?.writeText(`${successData.adminEmail}
${successData.contrasenaTemporal}`)
                              .then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2500); })
                              .catch(() => {});
                          }}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gold-300 bg-white px-3 py-1.5 text-xs font-semibold text-gold-900 transition-colors hover:bg-gold-50"
                        >
                          {copiado
                            ? <><CheckCircle2 className="w-3.5 h-3.5" /> Copiado</>
                            : <><Copy className="w-3.5 h-3.5" /> Copiar credenciales</>}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3.5 p-4 rounded-card bg-blue-50/70 border border-blue-100">
                  <IconTile icon={Mail} tint="#2563EB" size={40} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-800">
                      {successData.correoEnviado ? 'También te las enviamos por correo' : 'Correo no configurado'}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                      {successData.correoEnviado ? (
                        <>Revisá <strong className="text-gray-800 break-all">{successData.adminEmail}</strong>.
                        Si no lo ves, mirá la carpeta de spam.</>
                      ) : (
                        <>Esta pantalla es la única copia de tu contraseña. Guardala antes de salir.</>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                size="lg"
                onClick={() => router.push('/login')}
                className="w-full mt-7 cx-press"
              >
                Ir al inicio de sesión <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            /* ── Wizard ── */
            <>
              <div className="mb-7">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold-900 mb-1">
                  Registro de universidad
                </p>
                <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">
                  Registra tu universidad
                </h2>
                <p className="text-gray-500 text-sm mt-1.5">
                  Completa estos pasos para solicitar acceso a la plataforma.
                </p>
              </div>

              <Stepper current={step} />

              {/* ── PASO 0: Universidad ── */}
              {step === 0 && (
                <div className="space-y-4 lp-in">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Información de la universidad</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Datos de tu institución educativa.</p>
                  </div>

                  <Field label="Nombre completo de la universidad" required error={errors.universityName}>
                    <input
                      className={inputCls(!!errors.universityName)}
                      value={form.universityName}
                      onChange={e => set('universityName', e.target.value)}
                      placeholder="Nombre oficial de la institución"
                    />
                  </Field>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Nombre corto / siglas" required error={errors.universityShortName}>
                      <input
                        className={`${inputCls(!!errors.universityShortName)} font-mono uppercase`}
                        value={form.universityShortName}
                        onChange={e => set('universityShortName', e.target.value.toUpperCase())}
                        placeholder="SIGLAS"
                        maxLength={20}
                      />
                    </Field>
                    <Field label="País" required error={errors.country}>
                      <select
                        className={inputCls(!!errors.country)}
                        value={form.country}
                        onChange={e => set('country', e.target.value)}
                      >
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </Field>
                  </div>

                  <Field label="Sitio web institucional" error={errors.website}>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        className={inputCls(!!errors.website, true)}
                        value={form.website}
                        onChange={e => set('website', e.target.value)}
                        placeholder="https://institucion.ac.cr"
                        type="url"
                      />
                    </div>
                  </Field>
                </div>
              )}

              {/* ── PASO 1: Administrador ── */}
              {step === 1 && (
                <div className="space-y-4 lp-in">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Datos del administrador</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Esta persona recibirá las credenciales y administrará la plataforma.
                    </p>
                  </div>

                  <Field label="Nombre completo del administrador" required error={errors.adminName}>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        className={inputCls(!!errors.adminName, true)}
                        value={form.adminName}
                        onChange={e => set('adminName', e.target.value)}
                        placeholder="Nombre y apellidos"
                      />
                    </div>
                  </Field>

                  <Field label="Correo electrónico institucional" required error={errors.adminEmail}>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        className={inputCls(!!errors.adminEmail, true)}
                        value={form.adminEmail}
                        onChange={e => set('adminEmail', e.target.value)}
                        placeholder="admin@institucion.ac.cr"
                        type="email"
                      />
                    </div>
                  </Field>

                  <Field label="Teléfono de contacto" error={errors.adminPhone}>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        className={inputCls(false, true)}
                        value={form.adminPhone}
                        onChange={e => set('adminPhone', e.target.value)}
                        placeholder="+506 8888-8888"
                        type="tel"
                      />
                    </div>
                  </Field>
                </div>
              )}

              {/* ── PASO 2: Resumen y confirmación ── */}
              {step === 2 && (
                <div className="space-y-4 lp-in">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Resumen y confirmación</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Verifica que los datos sean correctos antes de enviar.</p>
                  </div>

                  {/* Resumen */}
                  <div className="rounded-card border border-gray-200/70 bg-gray-50/70 p-5 space-y-4">
                    <div className="pb-4 border-b border-gray-200">
                      <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900 mb-2">
                        Universidad
                      </p>
                      <dl className="grid gap-1 text-sm">
                        <div className="flex gap-2">
                          <dt className="text-gray-500">Nombre:</dt>
                          <dd className="font-semibold text-gray-800">{form.universityName}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="text-gray-500">Siglas:</dt>
                          <dd className="font-semibold text-gray-800 font-mono">{form.universityShortName}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="text-gray-500">País:</dt>
                          <dd className="font-semibold text-gray-800">{form.country}</dd>
                        </div>
                        {form.website && (
                          <div className="flex gap-2 min-w-0">
                            <dt className="text-gray-500 flex-shrink-0">Web:</dt>
                            <dd className="font-semibold text-gray-800 truncate">{form.website}</dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    <div>
                      <p className="text-[0.68rem] font-bold uppercase tracking-[0.13em] text-gold-900 mb-2">
                        Administrador
                      </p>
                      <dl className="grid gap-1 text-sm">
                        <div className="flex gap-2">
                          <dt className="text-gray-500">Nombre:</dt>
                          <dd className="font-semibold text-gray-800">{form.adminName}</dd>
                        </div>
                        <div className="flex gap-2 min-w-0">
                          <dt className="text-gray-500 flex-shrink-0">Correo:</dt>
                          <dd className="font-semibold text-gray-800 truncate">{form.adminEmail}</dd>
                        </div>
                        {form.adminPhone && (
                          <div className="flex gap-2">
                            <dt className="text-gray-500">Teléfono:</dt>
                            <dd className="font-semibold text-gray-800 font-mono">{form.adminPhone}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </div>

                  {/* Términos */}
                  <label
                    className={`flex items-start gap-3 p-4 rounded-card border cursor-pointer transition-all ${
                      errors.acceptedTerms
                        ? 'border-red-300 bg-red-50/50'
                        : form.acceptedTerms
                          ? 'border-blue-300 bg-blue-50/60'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.acceptedTerms}
                      onChange={e => set('acceptedTerms', e.target.checked)}
                      className="w-4 h-4 mt-0.5 flex-shrink-0 rounded accent-blue-600"
                    />
                    <span className="text-sm text-gray-700 leading-relaxed">
                      Acepto los{' '}
                      <a href="/terminos" target="_blank" rel="noopener noreferrer" className="text-blue-700 font-semibold hover:underline">
                        términos y condiciones de uso
                      </a>{' '}
                      de ContaSJ y confirmo que la información proporcionada es correcta.
                    </span>
                  </label>
                  {errors.acceptedTerms && (
                    <p className="flex items-center gap-1 text-xs text-red-600 cx-shake">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {errors.acceptedTerms}
                    </p>
                  )}

                  {/* Error de envío */}
                  {submitError && (
                    <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl cx-shake" role="alert">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{submitError}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── Navegación ── */}
              <div className="flex items-center justify-between gap-3 mt-8">
                <Button
                  variant="secondary"
                  onClick={back}
                  disabled={step === 0}
                  className="cx-press"
                >
                  <ArrowLeft className="w-4 h-4" /> Atrás
                </Button>

                {step < STEPS.length - 1 ? (
                  <Button onClick={next} className="cx-press">
                    Siguiente <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button onClick={handleSubmit} loading={submitting} className="cx-press">
                    {submitting ? 'Procesando…' : <>Solicitar acceso <ArrowRight className="w-4 h-4" /></>}
                  </Button>
                )}
              </div>

              <p className="text-center text-xs text-gray-400 mt-8">
                ¿Tu universidad ya está registrada?{' '}
                <Link href="/login" className="text-blue-700 font-semibold hover:underline">
                  Inicia sesión
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
