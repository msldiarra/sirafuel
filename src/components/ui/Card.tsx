import { ReactNode, CSSProperties, MouseEvent } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: (e?: MouseEvent<HTMLDivElement>) => void
  style?: CSSProperties
}

export function Card({ children, className = '', onClick, style }: CardProps) {
  return (
    <div
      className={`bg-gray-800 rounded-xl shadow-lg border-2 border-gray-700 ${onClick ? 'cursor-pointer hover:shadow-xl hover:border-gray-600 transition-all' : ''} ${className}`}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  )
}

