import React, { useEffect, useRef, useState, useMemo } from "react"
import { getDaysInMonth, isValid, parseISO } from "date-fns"

interface DrumPickerProps {
  value?: string // YYYY-MM-DD
  onChange: (value: string) => void
  minYear?: number
  maxYear?: number
}

const MONTHS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun", 
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
]

export function DrumDatePicker({ 
  value, 
  onChange, 
  minYear = 1920, 
  maxYear = new Date().getFullYear() + 5 
}: DrumPickerProps) {
  const dateObj = value && isValid(parseISO(value)) ? parseISO(value) : new Date()
  
  const [day, setDay] = useState(dateObj.getDate())
  const [month, setMonth] = useState(dateObj.getMonth() + 1)
  const [year, setYear] = useState(dateObj.getFullYear())

  const maxDays = useMemo(() => getDaysInMonth(new Date(year, month - 1)), [year, month])

  useEffect(() => {
    if (day > maxDays) setDay(maxDays)
  }, [maxDays, day])

  useEffect(() => {
    const newDateStr = `${year}-${String(month).padStart(2, '0')}-${String(Math.min(day, maxDays)).padStart(2, '0')}`
    if (newDateStr !== value) {
      onChange(newDateStr)
    }
  }, [day, month, year, maxDays, value, onChange])

  return (
    <div className="flex justify-center items-center h-[200px] w-full bg-background relative select-none">
      <div className="absolute top-[80px] h-[40px] w-full bg-muted/40 border-y border-border pointer-events-none rounded-lg" />
      <div className="absolute top-0 w-full h-[80px] bg-gradient-to-b from-background to-transparent pointer-events-none z-10" />
      <div className="absolute bottom-0 w-full h-[80px] bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />

      <div className="flex w-full px-2 gap-1 z-0 relative">
        <ScrollColumn
          items={Array.from({ length: maxDays }, (_, i) => String(i + 1).padStart(2, '0'))}
          value={String(Math.min(day, maxDays)).padStart(2, '0')}
          onChange={(v) => setDay(Number(v))}
          width="w-1/3"
        />
        <ScrollColumn
          items={MONTHS}
          value={MONTHS[month - 1]}
          onChange={(v) => setMonth(MONTHS.indexOf(v as string) + 1)}
          width="w-1/3"
        />
        <ScrollColumn
          items={Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i)}
          value={year}
          onChange={(v) => setYear(Number(v))}
          width="w-1/3"
        />
      </div>
    </div>
  )
}

function ScrollColumn({ items, value, onChange, width }: { items: (string|number)[], value: string|number, onChange: (val: any) => void, width: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const ITEM_HEIGHT = 40
  const isScrolling = useRef(false)
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (containerRef.current && !isScrolling.current) {
      const index = items.indexOf(value)
      if (index !== -1) {
        containerRef.current.scrollTop = index * ITEM_HEIGHT
      }
    }
  }, [value, items])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    isScrolling.current = true
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
    
    // Smoothly update value as we scroll
    const scrollTop = e.currentTarget.scrollTop
    const index = Math.round(scrollTop / ITEM_HEIGHT)
    if (items[index] !== undefined && items[index] !== value) {
      onChange(items[index])
    }

    scrollTimeout.current = setTimeout(() => {
      isScrolling.current = false
    }, 150)
  }

  const handleClick = (index: number) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: index * ITEM_HEIGHT, behavior: 'smooth' })
    }
  }

  return (
    <div 
      className={`h-[200px] ${width} overflow-y-auto snap-y snap-mandatory scrollbar-hide [&::-webkit-scrollbar]:hidden text-center`}
      ref={containerRef}
      onScroll={handleScroll}
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <div className="h-[80px] shrink-0" />
      {items.map((item, idx) => (
        <div 
          key={`${item}`} 
          onClick={() => handleClick(idx)}
          className={`h-[40px] snap-center flex items-center justify-center cursor-pointer transition-colors duration-200 text-lg font-medium
            ${item === value ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
        >
          {item}
        </div>
      ))}
      <div className="h-[80px] shrink-0" />
    </div>
  )
}
