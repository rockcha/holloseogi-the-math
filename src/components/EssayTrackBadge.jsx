/* eslint-disable react/prop-types */
const colors = {
  '인문': 'bg-[#fff0e2] text-[#914515]',
  '사회': 'bg-[#eaf2ff] text-[#285ba1]',
  '자연': 'bg-[#e4f5ef] text-[#176753]',
}

export default function EssayTrackBadge({ track, compact = false }) {
  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap font-normal ${compact ? 'px-1 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'} ${colors[track] || 'bg-[#f4f6f4] text-[#65736b]'}`}>
    {track} 계열
  </span>
}
