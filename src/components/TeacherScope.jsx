/* eslint-disable react/prop-types */
import { Switch } from 'radix-ui'

export default function TeacherScope({ all, onChange }) {
  return <div className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-[#305c45]">
    <button type="button" onClick={() => onChange(false)} aria-pressed={!all} className={`cursor-pointer transition-colors ${all ? 'text-[#94a69b]' : 'text-[#305c45]'}`}>담당 수업</button>
    <Switch.Root checked={all} onCheckedChange={onChange} aria-label="전체 수업 보기" className="teacher-scope-switch relative inline-flex h-5 w-9 shrink-0 items-center bg-[#305c45] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#527b65]">
      <Switch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[18px]" />
    </Switch.Root>
    <button type="button" onClick={() => onChange(true)} aria-pressed={all} className={`cursor-pointer transition-colors ${all ? 'text-[#305c45]' : 'text-[#94a69b]'}`}>전체</button>
  </div>
}
