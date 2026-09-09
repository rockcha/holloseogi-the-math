import { Link } from 'react-router-dom'

/* eslint-disable react/prop-types */

export default function BrandLogo({ brandName = '홀로서기 더매쓰', className = '', imageClassName = 'h-12 w-12', textClassName = 'text-xl', light = false }) {
  return (
    <Link
      aria-label={`${brandName} 홈`}
      className={`inline-flex shrink-0 items-center gap-2.5 font-display font-bold ${light ? 'text-white' : 'text-[#305c45]'} ${className}`}
      to="/"
    >
      <img alt="" aria-hidden="true" className={`${imageClassName} object-contain`} src="/logo.png" />
      <span className={textClassName}>{brandName}</span>
    </Link>
  )
}
