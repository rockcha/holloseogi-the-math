import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Users, Search, StickyNote, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";

const emptyForm = {
  name: "",
  gender: "",
  phone: "",
  parent_phone: "",
  parent_relation: "",
  memo: "",
};
const inputClass =
  "h-11 rounded-xl border-[#dce4dc] bg-white px-4 focus-visible:border-[#527b65] focus-visible:ring-[#527b65]/10";

export default function StudentsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [params, setParams] = useSearchParams();
  const [localDialogOpen, setLocalDialogOpen] = useState(false);
  const dialogOpen = localDialogOpen || params.get("action") === "new";
  function setDialogOpen(open) {
    if (saveStudent.isPending || deleteStudent.isPending) return;
    setLocalDialogOpen(open);
    if (!open) {
      setForm(emptyForm);
      setEditingId(null);
    }
    if (!open && params.has("action")) setParams({}, { replace: true });
  }

  const profile = useQuery({
    queryKey: ["teacher-profile", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("is_teacher")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const students = useQuery({
    queryKey: ["students", user?.id],
    enabled: Boolean(user && profile.data?.is_teacher),
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id,name,gender,phone,parent_phone,parent_relation,memo")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  const saveStudent = useMutation({
    mutationFn: async (values) => {
      if (!profile.data?.is_teacher)
        throw new Error("교사로 등록된 계정만 학생을 등록할 수 있어요.");
      if (!values.name.trim()) throw new Error("학생 이름을 입력해 주세요.");
      const payload = {
        name: values.name.trim(),
        gender: values.gender || null,
        phone: values.phone.trim() || null,
        parent_phone: values.parent_phone.trim() || null,
        parent_relation: values.parent_relation.trim() || null,
        memo: values.memo.trim() || null,
      };
      const request = editingId
        ? supabase.from("students").update(payload).eq("id", editingId)
        : supabase.from("students").insert(payload);
      const { error } = await request.select("id").single();
      if (error) throw error;
    },
    onSuccess: async () => {
      setForm(emptyForm);
      setLocalDialogOpen(false);
      setEditingId(null);
      if (params.has("action")) setParams({}, { replace: true });
      await queryClient.refetchQueries({
        queryKey: ["students"],
        type: "active",
      });
      toast.success(
        editingId ? "학생 정보와 메모를 수정했어요." : "학생을 등록했어요.",
      );
    },
    onError: (error) =>
      toast.error(error.message || "학생 정보를 저장하지 못했어요."),
  });
  const deleteStudent = useMutation({
    mutationFn: async () => {
      if (!profile.data?.is_teacher)
        throw new Error("교사로 등록된 계정만 학생을 삭제할 수 있어요.");
      if (!editingId) throw new Error("삭제할 학생을 찾을 수 없어요.");
      const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: async () => {
      setForm(emptyForm);
      setLocalDialogOpen(false);
      setEditingId(null);
      await queryClient.refetchQueries({
        queryKey: ["students"],
        type: "active",
      });
      toast.success("학생을 삭제했어요.");
    },
    onError: (error) => {
      const message =
        error.code === "23503"
          ? "결제 기록이 있는 학생은 삭제할 수 없어요."
          : error.message || "학생을 삭제하지 못했어요.";
      toast.error(message);
    },
  });
  const filteredStudents = (students.data || []).filter((student) => {
    const term = search.trim().toLocaleLowerCase();
    return !term || student.name.toLocaleLowerCase().includes(term);
  });
  function openStudent(student) {
    setEditingId(student?.id ?? null);
    setForm(
      student
        ? Object.fromEntries(
            Object.keys(emptyForm).map((key) => [key, student[key] ?? ""]),
          )
        : emptyForm,
    );
    setLocalDialogOpen(true);
  }
  const update = (event) =>
    setForm((value) => ({ ...value, [event.target.name]: event.target.value }));

  if (authLoading)
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f9f5] text-[#65736b]">
        불러오는 중...
      </div>
    );
  if (!user)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f9f5] px-5">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold">로그인이 필요해요</h1>
          <Link
            className="mt-6 inline-block rounded-sm bg-[#305c45] px-6 py-3 font-bold text-white"
            to="/login"
          >
            로그인하기
          </Link>
        </div>
      </main>
    );

  const isTeacher = profile.data?.is_teacher === true;
  return (
    <div className="flex min-h-screen flex-col bg-[#f7f9f5] text-[#26372f]">
      <main className="mx-auto w-[min(1080px,calc(100%-32px))] py-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-48 flex-1 sm:max-w-sm">
            <Input
              aria-label="학생 이름 검색"
              type="search"
              className="h-11 bg-white pl-10"
              placeholder="학생 이름 검색"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <Button
              onClick={() => openStudent(null)}
              className="h-11 shrink-0 rounded-xl bg-[#305c45] px-4 font-bold text-white shadow-sm hover:bg-[#264c38]"
              disabled={!isTeacher}
            >
              <Plus />
              학생 추가
            </Button>
            <DialogContent className="max-h-[calc(100vh-32px)] overflow-y-auto rounded-3xl p-6 sm:max-w-lg sm:p-7">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl font-bold">
                  {editingId ? "학생 수정" : "학생 추가"}
                </DialogTitle>
                <DialogDescription>
                  학생 정보와 메모를 입력해 주세요. 이름은 필수 항목이에요.
                </DialogDescription>
              </DialogHeader>
              <form
                className="mt-6"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveStudent.mutate(form);
                }}
              >
                <fieldset
                  disabled={saveStudent.isPending}
                  className="grid gap-4 sm:grid-cols-2"
                >
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="student-name">이름 *</Label>
                    <Input
                      autoFocus
                      className={inputClass}
                      id="student-name"
                      name="name"
                      onChange={update}
                      placeholder="학생 이름"
                      required
                      value={form.name}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-gender">성별</Label>
                    <Select
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          gender: value === "none" ? "" : value,
                        }))
                      }
                      value={form.gender || "none"}
                    >
                      <SelectTrigger
                        className={`${inputClass} w-full`}
                        id="student-gender"
                      >
                        <SelectValue placeholder="선택 안 함" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">선택 안 함</SelectItem>
                        <SelectItem value="남">남</SelectItem>
                        <SelectItem value="여">여</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-phone">학생 연락처</Label>
                    <Input
                      className={inputClass}
                      id="student-phone"
                      name="phone"
                      onChange={update}
                      placeholder="010-0000-0000"
                      type="tel"
                      value={form.phone}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parent-phone">학부모 연락처</Label>
                    <Input
                      className={inputClass}
                      id="parent-phone"
                      name="parent_phone"
                      onChange={update}
                      placeholder="010-0000-0000"
                      type="tel"
                      value={form.parent_phone}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parent-relation">학생과의 관계</Label>
                    <Input
                      className={inputClass}
                      id="parent-relation"
                      name="parent_relation"
                      onChange={update}
                      placeholder="예: 어머니, 아버지"
                      value={form.parent_relation}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="student-memo">메모</Label>
                    <textarea
                      id="student-memo"
                      name="memo"
                      value={form.memo}
                      onChange={update}
                      rows={5}
                      maxLength={5000}
                      placeholder="학습 특징, 상담 내용, 참고할 사항을 기록해 주세요."
                      className="w-full resize-y rounded-lg border border-[#dce4dc] bg-white p-3 text-sm leading-6 outline-none focus:border-[#527b65] focus:ring-2 focus:ring-[#527b65]/10"
                    />
                    <p className="text-right text-xs text-[#879189]">
                      {form.memo.length.toLocaleString()} / 5,000
                    </p>
                  </div>
                </fieldset>
                <DialogFooter className="mx-0 mb-0 mt-7 border-0 bg-transparent p-0">
                  <div className="mr-auto">
                    {editingId && (
                      <Button
                        className="h-11 rounded-xl bg-[#b84e43] px-5 font-bold text-white hover:bg-[#9f4138]"
                        disabled={
                          saveStudent.isPending || deleteStudent.isPending
                        }
                        onClick={() => {
                          if (
                            window.confirm(
                              `${form.name || "이 학생"}을(를) 삭제할까요? 관련 출결 기록도 함께 삭제됩니다.`,
                            )
                          )
                            deleteStudent.mutate();
                        }}
                        type="button"
                      >
                        <Trash2 />
                        {deleteStudent.isPending ? "삭제 중..." : "학생 삭제"}
                      </Button>
                    )}
                  </div>
                  <Button
                    className="h-11 rounded-xl px-5 font-bold"
                    disabled={saveStudent.isPending || deleteStudent.isPending}
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    type="button"
                  >
                    취소
                  </Button>
                  <Button
                    className="h-11 rounded-xl bg-[#305c45] px-5 font-bold text-white hover:bg-[#264c38]"
                    disabled={saveStudent.isPending || deleteStudent.isPending}
                    type="submit"
                  >
                    {saveStudent.isPending
                      ? "저장 중..."
                      : editingId
                        ? "변경 저장"
                        : "등록하기"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        {profile.isError && (
          <div className="mb-6 rounded-2xl bg-[#fff2ee] p-4 text-sm text-[#9a4936]">
            교사 정보를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.
          </div>
        )}
        {!profile.isLoading && !isTeacher && !profile.isError && (
          <div className="mb-6 rounded-2xl bg-[#fff7df] p-4 text-sm text-[#795f1c]">
            교사로 승인된 계정만 학생을 등록하고 조회할 수 있어요.
          </div>
        )}
        <section className="overflow-hidden rounded-3xl border border-[#e1e7df] bg-white shadow-sm">
          <div className="flex items-center justify-end border-b border-[#edf0eb] px-6 py-3">
            <span className="rounded-full bg-[#edf3ee] px-3 py-1 text-xs font-bold text-[#527b65]">
              {filteredStudents.length}명
              {search.trim() && ` / 전체 ${students.data?.length ?? 0}명`}
            </span>
          </div>
          {students.isLoading ? (
            <p className="p-10 text-center text-sm text-[#879189]">
              학생 목록을 불러오는 중...
            </p>
          ) : students.isError ? (
            <div className="p-10 text-center">
              <p className="text-sm font-semibold text-[#a95848]">
                학생 목록을 불러오지 못했어요.
              </p>
              <p className="mx-auto mt-2 max-w-lg break-words text-xs text-[#8e6259]">
                {students.error?.message}
              </p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => students.refetch()}
              >
                다시 불러오기
              </Button>
            </div>
          ) : !students.data?.length ? (
            <div className="p-14 text-center">
              <Users className="mx-auto h-10 w-10 text-[#b8c3bb]" />
              <p className="mt-3 font-semibold">아직 등록된 학생이 없어요.</p>
              <p className="mt-1 text-sm text-[#879189]">
                학생 추가 버튼을 눌러 첫 학생을 등록해 보세요.
              </p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => students.refetch()}
              >
                다시 불러오기
              </Button>
            </div>
          ) : !filteredStudents.length ? (
            <div className="p-14 text-center">
              <Search className="mx-auto mb-3 text-[#b8c3bb]" />
              <p>검색 결과가 없어요.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setSearch("")}
              >
                검색 초기화
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                <div className="grid grid-cols-[1.2fr_60px_1fr_1fr_70px_1fr] items-center gap-3 border-b border-[#edf0eb] bg-[#fafbf9] px-6 py-3 text-xs font-semibold text-[#879189]">
                  <span>이름</span>
                  <span>성별</span>
                  <span>학생 연락처</span>
                  <span>학부모 연락처</span>
                  <span>관계</span>
                  <span>메모</span>
                </div>
                <div className="divide-y divide-[#edf0eb]">
                  {filteredStudents.map((student) => (
                    <button
                      type="button"
                      onClick={() => openStudent(student)}
                      aria-label={student.name + " 정보 및 메모 수정"}
                      className="w-full text-left transition hover:bg-[#f4f8f5] focus-visible:outline-2 focus-visible:outline-[#527b65] grid grid-cols-[1.2fr_60px_1fr_1fr_70px_1fr] items-center gap-3 px-6 py-4 text-sm"
                      key={student.id}
                    >
                      <strong className="truncate">{student.name}</strong>
                      <span className="text-[#748078]">
                        {student.gender || "-"}
                      </span>
                      <span className="truncate text-[#58665e]">
                        {student.phone || "-"}
                      </span>
                      <span className="truncate text-[#58665e]">
                        {student.parent_phone || "-"}
                      </span>
                      <span className="truncate text-[#748078]">
                        {student.parent_relation || "-"}
                      </span>
                      <span className="flex min-w-0 items-center gap-2 text-[#748078]">
                        {student.memo && (
                          <StickyNote
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0"
                          />
                        )}
                        <span className="truncate">{student.memo || "-"}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
