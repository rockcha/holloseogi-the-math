/* eslint-disable react/prop-types */
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cycleFor } from '../lib/payments'

export default function BillingFields({ form, setForm, optional = false }) {
  // 기간 미리보기는 금액 입력 여부와 무관하게 계산합니다.
  const firstCycle = cycleFor({ ...form, billing_amount: 0 }, 1)
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  return <fieldset className="space-y-4">
    <legend className="mb-3 text-sm font-medium">수강료 결제 설정</legend>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2"><Label htmlFor="billing-sessions">결제 주기 (회) *</Label><Input className="h-11 rounded-xl bg-white" id="billing-sessions" placeholder="예: 8" name="billing_cycle_sessions" type="number" min="1" max="365" step="1" required value={form.billing_cycle_sessions} onChange={update} /></div>
      <div className="space-y-2"><Label htmlFor="billing-amount">주기별 금액 (원) *</Label><Input className="h-11 rounded-xl bg-white" id="billing-amount" placeholder="예: 200000" name="billing_amount" type="number" min="0" max="2147483647" step="1" required value={form.billing_amount} onChange={update} /></div>
    </div>
    <div className="space-y-2"><Label htmlFor="billing-start">결제 시작일{optional ? ' (기존 수업 설정 시 입력)' : ' *'}</Label><Input className="h-11 rounded-xl bg-white" id="billing-start" name="billing_start_date" type="date" required={!optional} value={form.billing_start_date || ''} onChange={update} /></div>
    <div aria-live="polite">{firstCycle && <p className="text-sm text-[#52635a]">단위기간 <span className="ml-2 font-semibold text-[#305c45]">{firstCycle.start.replaceAll('-', '.')} ~ {firstCycle.end.replaceAll('-', '.')}</span></p>}</div>
  </fieldset>
}
