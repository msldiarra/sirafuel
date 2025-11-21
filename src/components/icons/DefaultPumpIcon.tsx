interface DefaultPumpIconProps {
  className?: string
  size?: number
}

export function DefaultPumpIcon({ className = '', size = 24 }: DefaultPumpIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Gas Pump Icon - similar to reference image */}
      {/* Pump body */}
      <rect
        x="6"
        y="4"
        width="8"
        height="12"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Screen/Display at top */}
      <rect
        x="7.5"
        y="5.5"
        width="5"
        height="3"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />
      {/* Nozzle and hose */}
      <path
        d="M14 8C14 8 16 8 16 10V12C16 12 16 14 14 14"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Base/stand */}
      <rect
        x="5"
        y="16"
        width="10"
        height="2"
        rx="0.5"
        fill="currentColor"
        opacity="0.3"
      />
    </svg>
  )
}

