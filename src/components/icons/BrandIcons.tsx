interface BrandIconProps {
  className?: string
  size?: number
}

// Oryx Logo - Orange with white arrow
export function OryxIcon({ className = '', size = 24 }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="11" fill="#FF6B00" />
      <path
        d="M12 7L15 12H13V17H11V12H9L12 7Z"
        fill="white"
      />
    </svg>
  )
}

// Shell Logo - Red and yellow shell
export function ShellIcon({ className = '', size = 24 }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="11" fill="#FF0000" />
      <path
        d="M12 8C10 8 8.5 9.5 8.5 11.5C8.5 13.5 10 15 12 15C14 15 15.5 13.5 15.5 11.5C15.5 9.5 14 8 12 8Z"
        fill="#FFD700"
      />
      <path
        d="M9 11.5C9 10.5 10 9.5 11 9.5C12 9.5 13 10.5 13 11.5C13 12.5 12 13.5 11 13.5C10 13.5 9 12.5 9 11.5Z"
        fill="#FF0000"
      />
    </svg>
  )
}

// Total Logo - Red circle with white square
export function TotalIcon({ className = '', size = 24 }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="11" fill="#FF0000" />
      <rect x="9" y="9" width="6" height="6" fill="white" rx="1" />
    </svg>
  )
}

// BP Logo - Green and yellow sunburst
export function BPIcon({ className = '', size = 24 }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="11" fill="#00A8E8" />
      <circle cx="12" cy="12" r="7" fill="#FFD700" />
      <circle cx="12" cy="12" r="4" fill="#00A8E8" />
    </svg>
  )
}

// Mobil Logo - Red rectangle with white M
export function MobilIcon({ className = '', size = 24 }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" fill="#FF0000" />
      <path
        d="M8 7V17H10V12.5L12 15.5L14 12.5V17H16V7H14L12 10L10 7H8Z"
        fill="white"
      />
    </svg>
  )
}

// Corridor Logo - Blue circle with white lines
export function CorridorIcon({ className = '', size = 24 }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="11" fill="#0066CC" />
      <path d="M7 10H17M7 12H17M7 14H17" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

// Yara Logo - Green circle with Y
export function YaraIcon({ className = '', size = 24 }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="11" fill="#00A859" />
      <path
        d="M12 8L15 14H13.5L12.5 12H11.5L10.5 14H9L12 8ZM12 10.5L11.2 12H12.8L12 10.5Z"
        fill="white"
      />
    </svg>
  )
}

// BCF Logo
export function BCFIcon({ className = '', size = 24 }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="11" fill="#1E3A8A" />
      <text x="12" y="17" fontSize="7" fill="white" textAnchor="middle" fontWeight="bold">BCF</text>
    </svg>
  )
}

// CDS Logo
export function CDSIcon({ className = '', size = 24 }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="11" fill="#DC2626" />
      <text x="12" y="17" fontSize="7" fill="white" textAnchor="middle" fontWeight="bold">CDS</text>
    </svg>
  )
}

// KDF Logo
export function KDFIcon({ className = '', size = 24 }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="11" fill="#059669" />
      <text x="12" y="17" fontSize="7" fill="white" textAnchor="middle" fontWeight="bold">KDF</text>
    </svg>
  )
}

// Amazone Logo
export function AmazoneIcon({ className = '', size = 24 }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="11" fill="#7C3AED" />
      <path d="M8 10L12 14L16 10" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// Generic brand icon mapper
export function getBrandIcon(brand: string, className = '', size = 24) {
  const brandLower = brand.toLowerCase().trim()

  switch (brandLower) {
    case 'oryx':
      return <OryxIcon className={className} size={size} />
    case 'shell':
      return <ShellIcon className={className} size={size} />
    case 'total':
      return <TotalIcon className={className} size={size} />
    case 'bp':
      return <BPIcon className={className} size={size} />
    case 'mobil':
      return <MobilIcon className={className} size={size} />
    case 'corridor':
      return <CorridorIcon className={className} size={size} />
    case 'yara':
    case 'yara service':
      return <YaraIcon className={className} size={size} />
    case 'bcf':
      return <BCFIcon className={className} size={size} />
    case 'cds':
      return <CDSIcon className={className} size={size} />
    case 'kdf':
      return <KDFIcon className={className} size={size} />
    case 'amazone':
      return <AmazoneIcon className={className} size={size} />
    default:
      return null
  }
}

