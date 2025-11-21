import { ReactNode } from 'react'

interface MarkerPinProps {
  color: string // Color for the pin (red or green)
  children?: ReactNode // Content to display in the circle (brand icon)
  size?: number // Size multiplier
}

export function MarkerPin({ color, children, size = 1 }: MarkerPinProps) {
  const scale = size
  const width = 375 * scale
  const height = 374.999991 * scale

  return (
    <div className="relative" style={{ width: `${width}px`, height: `${height}px` }}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={width}
        height={height}
        viewBox="0 0 375 374.999991"
        preserveAspectRatio="xMidYMid meet"
        version="1.0"
        className="drop-shadow-lg absolute inset-0"
      >
        <defs>
          <clipPath id="marker-clip">
            <path
              d="M 63.046875 6 L 310 6 L 310 373 L 63.046875 373 Z M 63.046875 6 "
              clipRule="nonzero"
            />
          </clipPath>
        </defs>
        <g clipPath="url(#marker-clip)">
          {/* Pin shape - color changes based on fuel availability */}
          <path
            fill={color}
            d="M 307.953125 108.535156 C 298.675781 54.035156 252.96875 11.59375 197.832031 6.648438 C 124.597656 0 63.117188 57.515625 63.117188 129.40625 C 63.117188 145.253906 66.210938 160.328125 71.703125 174.320312 L 71.625 174.320312 L 71.78125 174.628906 C 74.640625 181.816406 145.246094 312.074219 174.246094 365.335938 C 179.503906 375 193.425781 375 198.683594 365.335938 C 227.605469 312.074219 298.289062 181.816406 301.148438 174.628906 L 301.304688 174.320312 L 301.226562 174.320312 C 308.960938 154.375 311.976562 132.035156 307.953125 108.535156 Z M 186.464844 199.445312 C 147.332031 199.445312 115.550781 167.75 115.550781 128.554688 C 115.550781 89.363281 147.257812 57.667969 186.464844 57.667969 C 225.671875 57.667969 257.378906 89.363281 257.378906 128.554688 C 257.378906 167.75 225.59375 199.445312 186.464844 199.445312 Z M 186.464844 199.445312 "
            fillOpacity="1"
            fillRule="nonzero"
          />
        </g>
      </svg>
      {/* White circle and icon overlay - positioned absolutely */}
      <div
        className="absolute"
        style={{
          left: '50%',
          top: '34.3%', // Approximately center of the circle in the pin
          transform: 'translate(-50%, -50%)',
          width: `${70.89 * scale * 2}px`,
          height: `${70.89 * scale * 2}px`,
        }}
      >
        <div className="w-full h-full bg-white rounded-full flex items-center justify-center shadow-sm">
          {children}
        </div>
      </div>
    </div>
  )
}

