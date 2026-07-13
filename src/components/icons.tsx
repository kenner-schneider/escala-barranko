// Ícones SVG de traço (padrão Lucide) — substituem os emojis de "chrome" do app.
// stroke-width 2, viewBox 24, currentColor. Tamanho via prop `size` (default 18).
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Base({ size = 18, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}
    >
      {children}
    </svg>
  )
}

export const ClipboardIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M9 12h6M9 16h6" />
  </Base>
)

export const SunToggleIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Base>
)

export const MoonToggleIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </Base>
)

export const LogOutIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </Base>
)

export const ChevronLeftIcon = (p: IconProps) => (
  <Base {...p}><path d="M15 18l-6-6 6-6" /></Base>
)

export const ChevronRightIcon = (p: IconProps) => (
  <Base {...p}><path d="M9 18l6-6-6-6" /></Base>
)

export const ScaleIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3v18M5 7l7-4 7 4M5 7l-2 6a4 4 0 0 0 8 0L9 7M19 7l-2 6a4 4 0 0 0 8 0l-2-6" />
  </Base>
)

export const ArrowDownIcon = (p: IconProps) => (
  <Base {...p}><path d="M12 19V5M5 12l7 7 7-7" /></Base>
)

export const ArrowUpIcon = (p: IconProps) => (
  <Base {...p}><path d="M12 5v14M5 12l7-7 7 7" /></Base>
)

export const BarChartIcon = (p: IconProps) => (
  <Base {...p}><path d="M3 3v18h18M7 15l4-4 3 3 5-6" /></Base>
)

export const CheckCircleIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M8 12l3 3 5-6" />
  </Base>
)

export const UserIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Base>
)

export const XIcon = (p: IconProps) => (
  <Base {...p}><path d="M18 6 6 18M6 6l12 12" /></Base>
)

export const CheckIcon = (p: IconProps) => (
  <Base {...p}><path d="M20 6 9 17l-5-5" /></Base>
)

export const CalendarIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </Base>
)

export const CalendarCheckIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4" />
  </Base>
)

export const LockIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Base>
)

export const PhoneIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
  </Base>
)

export const PlusIcon = (p: IconProps) => (
  <Base {...p}><path d="M12 5v14M5 12h14" /></Base>
)

export const SendIcon = (p: IconProps) => (
  <Base {...p}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></Base>
)

export const PartyIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5.8 11.3 2 22l10.7-3.8" />
    <path d="M4 3h.01M22 8h.01M15 2h.01M22 20h.01" />
    <path d="M11 13c1.9-1.9 2.5-4.4 1.4-5.5C11.3 6.4 8.8 7 7 8.9M15.8 6.2A2 2 0 0 0 18 4M12.2 4.5A2 2 0 0 1 14 2M19.5 11.8A2 2 0 0 0 22 14" />
  </Base>
)

export const FlaskIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M9 3h6M10 3v6.5L4.6 18a2 2 0 0 0 1.7 3h11.4a2 2 0 0 0 1.7-3L14 9.5V3" />
    <path d="M7 14h10" />
  </Base>
)
