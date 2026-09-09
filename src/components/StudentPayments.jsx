/* eslint-disable react/prop-types */
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { won } from '../lib/payments'

export default function StudentPayments({ students, classes, payments }) {
  const [search, setSearch] = useState('')
  const [studentId, setStudentId] = useState('')
  const matches = students.filter((student) => student.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  const student = students.find((item) => item.id === studentId)
  const history = payments.filter((payment) => payment.student_id === studentId).sort((a, b) => b.paid_on.localeCompare(a.paid_on) || b.created_at.localeCompare(a.created_at))
  return <section className="rounded-xl border border-[#e1e7df] bg-white p-5 sm:p-7">
    <div className="mb-6 grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="student-payment-search">학생 이름 검색</Label><Input id="student-payment-search" className="h-11" type="search" placeholder="학생 이름" value={search} onChange={(event) => { setSearch(event.target.value); setStudentId('') }} /></div><div className="space-y-2"><Label htmlFor="student-payment-select">학생 선택</Label><select id="student-payment-select" className="h-11 w-full rounded-lg border border-[#dce4dc] bg-white px-3 text-sm" value={studentId} onChange={(event) => setStudentId(event.target.value)}><option value="">{matches.length ? '학생을 선택하세요' : '검색 결과가 없어요'}</option>{matches.map((item) => <option key={item.id} value={item.id}>{item.name}{item.phone ? ' · ' + item.phone : ''}</option>)}</select></div></div>
    {!student ? <p className="py-12 text-center text-sm text-[#879189]">학생을 검색하고 선택하면 납부 내역이 표시됩니다.</p> : <><div className="mb-5 flex flex-wrap justify-between gap-3"><h2 className="font-semibold">{student.name}</h2><p className="text-sm text-[#527b65]">{history.length}건 · 총 납부 {won(history.reduce((sum, item) => sum + item.amount, 0))}</p></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b text-xs text-[#879189]"><tr>{['결제일', '수업', '단위기간', '수강료', '납부 금액'].map((label) => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{history.map((payment) => <tr className="border-b border-[#edf0eb]" key={payment.id}><td className="p-3">{payment.paid_on}</td><td className="p-3 font-medium">{payment.class_id ? classes.find((item) => item.id === payment.class_id)?.name || '수업 정보 없음' : '일반 결제'}</td><td className="p-3">{payment.cycle_start && payment.cycle_end ? <><span className="block">{payment.cycle_start} ~ {payment.cycle_end}</span><span className="mt-1 block text-xs text-[#879189]">{payment.cycle_number}주기{classes.find((item) => item.id === payment.class_id)?.billing_cycle_sessions && <> · {classes.find((item) => item.id === payment.class_id).billing_cycle_sessions}회 수업</>}</span></> : '단위기간 없음'}</td><td className="p-3">{payment.expected_amount == null ? '-' : won(payment.expected_amount)}</td><td className="p-3 font-semibold text-[#305c45]">{won(payment.amount)}</td></tr>)}</tbody></table></div>{!history.length && <p className="py-12 text-center text-sm text-[#879189]">이 학생의 결제 내역이 없어요.</p>}</>}
  </section>
}
