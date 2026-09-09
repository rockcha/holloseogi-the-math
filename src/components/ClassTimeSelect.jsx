/* eslint-disable react/prop-types */
import { Clock3 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const TIMES = Array.from({ length: 32 }, (_, index) => `${String(8 + Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`)

export default function ClassTimeSelect({ id, value, onChange, after }) {
  return <Select required value={value} onValueChange={onChange}>
    <SelectTrigger id={id} className="h-11! w-full rounded-xl bg-white [&>svg:last-child]:hidden"><SelectValue placeholder="시간 선택" /><Clock3 className="ml-auto h-4 w-4 text-[#758078]" /></SelectTrigger>
    <SelectContent position="popper" className="max-h-64">{TIMES.filter((time) => !after || time > after).map((time) => <SelectItem key={time} value={time}>{time}</SelectItem>)}</SelectContent>
  </Select>
}
