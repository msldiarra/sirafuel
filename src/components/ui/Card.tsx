import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      className={`bg-gray-800 rounded-xl shadow-lg border-2 border-gray-700 ${onClick ? 'cursor-pointer hover:shadow-xl hover:border-gray-600 transition-all' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

