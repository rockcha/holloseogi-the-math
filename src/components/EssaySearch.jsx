/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react'
import { Input } from './ui/input'

export default function EssaySearch({ value, onChange }) {
  const [draft, setDraft] = useState(value)
  const composing = useRef(false)
  useEffect(() => {
    if (!composing.current) setDraft(value)
  }, [value])

  return <Input type="search" className="h-10 bg-white" aria-label="학교, 시험명, 계열, 모집단위, 특징 검색" placeholder="학교, 시험명, 계열, 특징 검색" value={draft}
    onCompositionStart={() => { composing.current = true }}
    onCompositionEnd={(event) => {
      composing.current = false
      setDraft(event.currentTarget.value)
      onChange(event.currentTarget.value)
    }}
    onChange={(event) => {
      setDraft(event.target.value)
      if (!composing.current && !event.nativeEvent.isComposing) onChange(event.target.value)
    }}
  />
}
