'use client'

import { useState, useRef, useCallback, useMemo } from 'react'

interface RangeSliderProps {
  min: number
  max: number
  defaultValue: number
  step?: number
  unit?: string
  label?: string
  onChange: (value: number) => void
}

export function RangeSlider({
  min,
  max,
  defaultValue,
  step = 1,
  unit = 'km',
  label,
  onChange,
}: RangeSliderProps) {
  // Use defaultValue only on initial mount, then manage internally
  const [value, setValue] = useState(() => defaultValue)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const onChangeRef = useRef(onChange)
  const isDraggingRef = useRef(false)

  // Keep onChange ref up to date
  onChangeRef.current = onChange

  const handleChange = useCallback((newValue: number) => {
    isDraggingRef.current = true
    setValue(newValue)
    
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    // Debounce onChange to avoid too many updates while dragging
    timeoutRef.current = setTimeout(() => {
      onChangeRef.current(newValue)
      isDraggingRef.current = false
    }, 150)
  }, [])

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    const newValue = Number(e.currentTarget.value)
    setValue(newValue)
    
    // Clear timeout and call immediately
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    onChangeRef.current(newValue)
    isDraggingRef.current = false
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLInputElement>) => {
    const newValue = Number(e.currentTarget.value)
    setValue(newValue)
    
    // Clear timeout and call immediately
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    onChangeRef.current(newValue)
    isDraggingRef.current = false
  }, [])

  const percentage = useMemo(() => {
    return ((value - min) / (max - min)) * 100
  }, [value, min, max])

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {label}
        </label>
      )}
      
      <div className="relative pt-8 pb-6">
        {/* Value display tooltip */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none z-30"
          style={{ left: `${percentage}%` }}
        >
          <div className="bg-primary-teal text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap relative">
            {value} {unit}
            {/* Tooltip arrow pointing down */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-primary-teal" />
          </div>
        </div>

        {/* Slider track */}
        <div className="relative h-2 bg-gray-600 rounded-full mt-4">
          {/* Filled portion */}
          <div
            className="absolute h-full bg-primary-teal rounded-full transition-all duration-150"
            style={{ width: `${percentage}%` }}
          />
          
          {/* Slider handle */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => handleChange(Number(e.target.value))}
            onMouseUp={handleMouseUp}
            onTouchEnd={handleTouchEnd}
            className="absolute inset-0 w-full h-2 opacity-0 cursor-pointer z-10"
          />
          
          {/* Visual handle */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-gray-100 border-2 border-primary-teal rounded-full shadow-lg cursor-pointer hover:scale-110 transition-transform z-20 pointer-events-none"
            style={{ left: `calc(${percentage}% - 10px)` }}
          />
        </div>

        {/* Min and Max labels */}
        <div className="flex justify-between mt-8 text-xs">
          <div className="text-left">
            <div className="font-semibold text-white">{min} {unit}</div>
            <div className="text-gray-400 mt-0.5">Minimum</div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-white">{max} {unit}</div>
            <div className="text-gray-400 mt-0.5">Maximum</div>
          </div>
        </div>
      </div>
    </div>
  )
}

