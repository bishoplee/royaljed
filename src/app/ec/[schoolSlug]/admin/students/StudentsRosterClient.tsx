'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ClassData {
  id: string;
  name: string;
}

interface StudentData {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  dateOfBirth?: string | null;
  sex?: 'MALE' | 'FEMALE' | 'OTHER' | null;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  classes: ClassData[];
}

interface StudentsRosterClientProps {
  initialStudents: StudentData[];
  availableClasses: ClassData[];
  schoolSlug: string;
}

export function StudentsRosterClient({ initialStudents, availableClasses, schoolSlug }: StudentsRosterClientProps) {
  const router = useRouter();
  const [students, setStudents] = useState<StudentData[]>(initialStudents);
  const [activeTab, setActiveTab] = useState<'roster' | 'manual' | 'csv'>('roster');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [selectedSex, setSelectedSex] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const isFiltered =
    searchTerm.trim() !== '' ||
    selectedClassId !== 'ALL' ||
    selectedSex !== 'ALL' ||
    selectedStatus !== 'ALL';

  const resetAllFilters = () => {
    setSearchTerm('');
    setSelectedClassId('ALL');
    setSelectedSex('ALL');
    setSelectedStatus('ALL');
    setCurrentPage(1);
  };

  // Manual Form States
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [sex, setSex] = useState<'MALE' | 'FEMALE' | 'OTHER' | ''>('');
  const [password, setPassword] = useState('');
  const [createClassId, setCreateClassId] = useState<string | null>(null);
  const [createClassSearch, setCreateClassSearch] = useState('');
  const classNameToId = new Map(
    availableClasses.map((classItem) => [classItem.name.toLowerCase().trim(), classItem.id])
  );
  
  // CSV Import States
  const [csvText, setCsvText] = useState('');
  const [csvPreview, setCsvPreview] = useState<{
    fullName: string;
    email: string;
    phone: string;
    className: string;
    dateOfBirth?: string;
    sex?: string;
    valid: boolean;
    isMissingClass?: boolean;
    errorReason?: string;
  }[]>([]);
  const [missingClasses, setMissingClasses] = useState<string[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // Edit Modal States
  const [editingStudent, setEditingStudent] = useState<StudentData | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editSex, setEditSex] = useState<'MALE' | 'FEMALE' | 'OTHER' | ''>('');
  const [editClassId, setEditClassId] = useState<string | null>(null);
  const [editClassSearch, setEditClassSearch] = useState('');

  // Password Reset Modal States
  const [resetStudent, setResetStudent] = useState<StudentData | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState('');

  // UX Feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const filteredCreateClasses = availableClasses.filter((c) =>
    c.name.toLowerCase().includes(createClassSearch.toLowerCase())
  );

  const filteredEditClasses = availableClasses.filter((c) =>
    c.name.toLowerCase().includes(editClassSearch.toLowerCase())
  );

  const handleCreateClassToggle = (classId: string) => {
    setCreateClassId((prev) => (prev === classId ? null : classId));
  };

  const handleEditClassToggle = (classId: string) => {
    setEditClassId((prev) => (prev === classId ? null : classId));
  };

  const handleRefresh = async () => {
    try {
      const res = await fetch(`/api/ec/${schoolSlug}/admin/students`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
      }
    } catch (e) {
      console.error('Failed to reload student roster', e);
    }
  };

  // Student manual add submit
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const emailNormalized = email.toLowerCase().trim();
    if (students.some((s) => s.email.toLowerCase().trim() === emailNormalized)) {
      setError(`Duplicate Student Data: A student with email "${emailNormalized}" is already registered in this school roster.`);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/ec/${schoolSlug}/admin/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          phone: phone.trim() === '' ? null : phone,
          dateOfBirth: dateOfBirth ? dateOfBirth : null,
          sex: sex ? sex : null,
          password: password.trim() === '' ? undefined : password,
          classId: createClassId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to register student');
        setLoading(false);
        return;
      }

      setSuccess('Student account registered successfully!');
      setFullName('');
      setEmail('');
      setPhone('');
      setDateOfBirth('');
      setSex('');
      setPassword('');
      setCreateClassId(null);
      setCreateClassSearch('');
      setLoading(false);
      setActiveTab('roster');
      handleRefresh();

      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  // Delete student account
  const handleDeleteStudent = async (student: StudentData) => {
    if (!confirm(`Are you sure you want to remove student "${student.fullName}"? This will permanently delete their account and submissions.`)) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/ec/${schoolSlug}/admin/students?studentId=${student.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok) {
        setStudents((prev) => prev.filter((s) => s.id !== student.id));
        setSuccess(`Student "${student.fullName}" removed successfully.`);
        setTimeout(() => setSuccess(''), 4000);
      } else {
        alert(data.error || 'Failed to remove student');
      }
    } catch (err) {
      alert('Error removing student');
    } finally {
      setLoading(false);
    }
  };

  // Submit Password Reset
  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetStudent) return;
    setResetSubmitting(true);
    setResetError('');

    try {
      const res = await fetch(`/api/ec/${schoolSlug}/admin/students`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: resetStudent.id,
          password: newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResetError(data.error || 'Failed to reset password');
        setResetSubmitting(false);
        return;
      }

      setSuccess(`Password for ${resetStudent.fullName} updated successfully.`);
      setResetStudent(null);
      setNewPassword('');
      setResetSubmitting(false);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setResetError('An error occurred while resetting password.');
      setResetSubmitting(false);
    }
  };

  // Edit Student submission
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/ec/${schoolSlug}/admin/students`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: editingStudent.id,
          fullName: editName,
          email: editEmail,
          phone: editPhone.trim() === '' ? null : editPhone,
          dateOfBirth: editDob || null,
          sex: editSex || null,
          classId: editClassId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to update student');
        setLoading(false);
        return;
      }

      setSuccess('Student profile updated.');
      setEditingStudent(null);
      setLoading(false);
      handleRefresh();

      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError('Something went wrong.');
      setLoading(false);
    }
  };

  // Parse CSV function
  const parseCSVData = (text: string) => {
    const rows = text.split('\n');
    const missingClassSet = new Set<string>();
    const seenBatchEmails = new Set<string>();
    const existingSchoolEmails = new Set(
      students.map((s) => s.email.toLowerCase().trim())
    );

    const parsedRows = rows
      .map((row, index) => {
        if (index === 0 && row.toLowerCase().includes('name') && row.toLowerCase().includes('email')) {
          // Skip header row if present
          return null;
        }

        const cols = row.split(',');
        if (cols.length === 0 || row.trim() === '') return null;

        const name = cols[0] ? cols[0].trim() : '';
        const emailVal = cols[1] ? cols[1].trim() : '';
        const phoneVal = cols[2] ? cols[2].trim() : '';
        const classNameVal = cols[3] ? cols[3].trim() : '';
        const dobVal = cols[4] ? cols[4].trim() : '';
        const sexVal = cols[5] ? cols[5].trim() : '';

        // Validation checks
        let valid = true;
        let errorReason = '';
        let isMissingClass = false;

        const emailNormalized = emailVal.toLowerCase().trim();

        if (!name) {
          valid = false;
          errorReason = 'Missing Name';
        } else if (!emailVal) {
          valid = false;
          errorReason = 'Missing Email';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
          valid = false;
          errorReason = 'Invalid Email Format';
        } else if (existingSchoolEmails.has(emailNormalized)) {
          valid = false;
          errorReason = 'Email Already Registered';
        } else if (seenBatchEmails.has(emailNormalized)) {
          valid = false;
          errorReason = 'Duplicate Email in CSV Payload';
        } else if (classNameVal && !classNameToId.has(classNameVal.toLowerCase())) {
          isMissingClass = true;
          missingClassSet.add(classNameVal);
        }

        if (valid && emailNormalized) {
          seenBatchEmails.add(emailNormalized);
        }

        return {
          fullName: name,
          email: emailVal,
          phone: phoneVal,
          className: classNameVal,
          dateOfBirth: dobVal,
          sex: sexVal,
          valid,
          isMissingClass,
          errorReason,
        };
      })
      .filter(Boolean) as any[];

    setCsvPreview(parsedRows);
    setMissingClasses(Array.from(missingClassSet));
  };

  const handleCsvPasteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCsvText(text);
    parseCSVData(text);
  };

  // File reader for CSV
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      parseCSVData(text);
    };
    reader.readAsText(file);
  };

  // Bulk Import submit
  const handleBulkSubmit = async (createMissing = false) => {
    const validStudents = csvPreview.filter(p => p.valid).map(p => ({
      fullName: p.fullName,
      email: p.email,
      phone: p.phone || null,
      classId: p.className ? classNameToId.get(p.className.toLowerCase()) : undefined,
      className: p.className || undefined,
      dateOfBirth: p.dateOfBirth || null,
      sex: p.sex || null,
    }));

    if (validStudents.length === 0) {
      setError('No valid student records found to import. Check duplicate email or invalid format errors in the preview.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/ec/${schoolSlug}/admin/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: validStudents,
          createMissingClasses: createMissing,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Bulk registration failed.');
        setLoading(false);
        return;
      }

      if (data.failed && data.failed.length > 0) {
        const failedDetails = data.failed.map((f: any) => `${f.email} (${f.error})`).join('; ');
        setError(`Skipped ${data.failed.length} record(s) due to duplicates: ${failedDetails}`);
      }

      setSuccess(data.message || 'Roster successfully imported!');
      setCsvText('');
      setCsvPreview([]);
      setMissingClasses([]);
      setCsvFile(null);
      setLoading(false);
      setActiveTab('roster');
      handleRefresh();
      router.refresh();

      setTimeout(() => setSuccess(''), 5000);
    } catch (e) {
      setError('Something went wrong during bulk submission.');
      setLoading(false);
    }
  };

  const handleDownloadCsvTemplate = () => {
    const classExamples = availableClasses.slice(0, 2).map((classItem) => classItem.name);
    const firstClass = classExamples[0] || 'Primary 1A';
    const secondClass = classExamples[1] || firstClass;
    const csvTemplate = [
      'Name,Email,Phone,Class,DoB (YYYY-MM-DD),Sex (Male/Female/Other)',
      `Jane Doe,jane.doe@example.com,+2348000000001,${firstClass},2015-05-14,Female`,
      `John Smith,john.smith@example.com,+2348000000002,${secondClass},2014-11-20,Male`,
    ].join('\n');

    const blob = new Blob([csvTemplate], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'students-import-template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Search & Multi-field filter matching
  const filteredStudents = students.filter((s) => {
    // 1. Text Search matching (Name, Email, Phone)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const matchName = s.fullName.toLowerCase().includes(term);
      const matchEmail = s.email.toLowerCase().includes(term);
      const matchPhone = Boolean(s.phone && s.phone.includes(term));
      if (!matchName && !matchEmail && !matchPhone) return false;
    }

    // 2. Class / Grade level filter
    if (selectedClassId !== 'ALL') {
      if (selectedClassId === 'UNENROLLED') {
        if (s.classes && s.classes.length > 0) return false;
      } else {
        if (!s.classes || !s.classes.some((c) => c.id === selectedClassId)) return false;
      }
    }

    // 3. Sex filter
    if (selectedSex !== 'ALL') {
      if (selectedSex === 'UNSPECIFIED') {
        if (s.sex) return false;
      } else {
        if (s.sex !== selectedSex) return false;
      }
    }

    // 4. Status filter
    if (selectedStatus !== 'ALL') {
      if (s.status !== selectedStatus) return false;
    }

    return true;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredStudents.length);
  const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-yellow-800 text-xs font-medium flex gap-3 items-center">
          <span className="text-sm select-none">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-md bg-brandGreenSoft border border-brandGreen/20 text-brandGreenDark text-xs font-medium flex gap-3 items-center">
          <span className="text-sm select-none">✓</span>
          <span>{success}</span>
        </div>
      )}

      {/* Tabs Layout */}
      <div className="flex border-b border-slate/10 gap-6 select-none">
        <button
          onClick={() => {
            setActiveTab('roster');
            setError('');
          }}
          className={`pb-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'roster'
              ? 'border-brandGreenDark text-brandTealDeep'
              : 'border-transparent text-slate hover:text-brandTealDeep'
          }`}
        >
          Student Directory ({students.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('manual');
            setError('');
          }}
          className={`pb-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'manual'
              ? 'border-brandGreenDark text-brandTealDeep'
              : 'border-transparent text-slate hover:text-brandTealDeep'
          }`}
        >
          Add Student Manually
        </button>
        <button
          onClick={() => {
            setActiveTab('csv');
            setError('');
          }}
          className={`pb-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'csv'
              ? 'border-brandGreenDark text-brandTealDeep'
              : 'border-transparent text-slate hover:text-brandTealDeep'
          }`}
        >
          CSV Batch Import
        </button>
      </div>

      {/* TAB 1: STUDENT DIRECTORY */}
      {activeTab === 'roster' && (
        <div className="bg-canvas border border-slate/10 rounded-lg p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
              {/* Search Field */}
              <div className="relative flex-1 min-w-[240px]">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Search by name, email, or phone..."
                  value={searchTerm}
                  onChange={e => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 text-xs border border-slate/20 rounded-md focus:outline-none focus:border-brandGreenDark bg-canvas text-ink"
                />
              </div>

              {/* Multi-field Filter Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Class / Grade Level Filter */}
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 text-xs border border-slate/20 rounded-md bg-canvas text-ink focus:outline-none focus:border-brandGreenDark font-medium"
                >
                  <option value="ALL">All Classes & Grade Levels</option>
                  <option value="UNENROLLED">Not Enrolled</option>
                  {availableClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {/* Sex Filter */}
                <select
                  value={selectedSex}
                  onChange={(e) => {
                    setSelectedSex(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 text-xs border border-slate/20 rounded-md bg-canvas text-ink focus:outline-none focus:border-brandGreenDark font-medium"
                >
                  <option value="ALL">All Sexes</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                  <option value="UNSPECIFIED">Unspecified</option>
                </select>

                {/* Account Status Filter */}
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 text-xs border border-slate/20 rounded-md bg-canvas text-ink focus:outline-none focus:border-brandGreenDark font-medium"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>

                {/* Refresh List Button */}
                <button
                  onClick={handleRefresh}
                  className="text-xs font-semibold text-brandGreenDark hover:text-brandTealDeep flex items-center gap-1 border border-slate/10 px-3 py-2 rounded-md bg-surface"
                >
                  🔄 Refresh
                </button>
              </div>
            </div>

            {/* Active Filters Summary Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate border-t border-slate/5">
              {/* <span className="font-medium text-slate-500">
                Showing <strong className="font-bold text-ink">{filteredStudents.length > 0 ? startIndex + 1 : 0}</strong>–
                <strong className="font-bold text-ink">{endIndex}</strong> of{' '}
                <strong className="font-bold text-ink">{filteredStudents.length}</strong> students
                {filteredStudents.length !== students.length && (
                  <span className="text-slate-400 font-normal"> (filtered from {students.length} total)</span>
                )}
              </span> */}
              {isFiltered && (
                <button
                  onClick={resetAllFilters}
                  className="text-[11px] font-bold text-red-600 hover:underline flex items-center gap-1"
                >
                  Clear All Filters ✕
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            {filteredStudents.length > 0 ? (
              <table className="min-w-full text-left text-xs font-sans">
                <thead>
                  <tr className="border-b border-slate/10 text-slate uppercase tracking-wider text-[10px] font-bold">
                    <th className="py-3">Full Name</th>
                    <th className="py-3">Email Address</th>
                    <th className="py-3">Phone</th>
                    <th className="py-3">DoB / Sex</th>
                    <th className="py-3">Class Enrolled</th>
                    <th className="py-3">Account Status</th>
                    <th className="py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate/5 text-slate-700">
                  {paginatedStudents.map(student => (
                    <tr key={student.id} className="hover:bg-surface/50">
                      <td className="py-3.5 font-medium text-ink flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700">
                          {student.fullName.charAt(0)}
                        </div>
                        {student.fullName}
                      </td>
                      <td className="py-3.5">{student.email}</td>
                      <td className="py-3.5 text-slate-500">{student.phone || '-'}</td>
                      <td className="py-3.5 whitespace-nowrap">
                        {student.dateOfBirth || student.sex ? (
                          <div className="text-[11px] leading-tight space-y-0.5">
                            {student.dateOfBirth && <p className="font-mono text-ink">{student.dateOfBirth}</p>}
                            {student.sex && (
                              <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-700 uppercase">
                                {student.sex}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">—</span>
                        )}
                      </td>
                      <td className="py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {student.classes.length > 0 ? (
                            student.classes.map(c => (
                              <span
                                key={c.id}
                                className="px-2 py-0.5 rounded bg-brandGreenSoft text-brandGreenDark text-[9px] font-semibold"
                              >
                                {c.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Not Enrolled</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            student.status === 'ACTIVE'
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {student.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-right space-x-3">
                        <button
                          onClick={() => {
                            setEditingStudent(student);
                            setEditName(student.fullName);
                            setEditEmail(student.email);
                            setEditPhone(student.phone || '');
                            setEditDob(student.dateOfBirth || '');
                            setEditSex((student.sex as any) || '');
                            if ((student.classes?.length || 0) > 1) {
                              setError('This student currently has multiple class assignments. Saving will keep only one class.');
                            }
                            setEditClassId(student.classes?.[0]?.id || null);
                            setEditClassSearch('');
                          }}
                          className="text-brandTeal hover:underline font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setResetStudent(student);
                            setNewPassword('');
                            setResetError('');
                          }}
                          className="text-amber-600 hover:underline font-semibold"
                        >
                          Reset Password
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(student)}
                          className="text-red-600 hover:underline font-semibold"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-slate text-sm space-y-3">
                <p>{isFiltered ? 'No students match your selected search and filter criteria.' : 'No students registered in this school roster yet.'}</p>
                {isFiltered && (
                  <button
                    onClick={resetAllFilters}
                    className="px-4 py-1.5 text-xs font-bold bg-brandGreenSoft text-brandGreenDark hover:bg-brandGreenSoft/80 rounded-full"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Pagination Controls Bar */}
          {filteredStudents.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate/10 text-xs text-slate">
              <div className="flex items-center gap-3">
                <span>
                  Showing <strong className="font-semibold text-ink">{startIndex + 1}</strong>–
                  <strong className="font-semibold text-ink">{endIndex}</strong> of{' '}
                  <strong className="font-semibold text-ink">{filteredStudents.length}</strong> students
                </span>
                <div className="flex items-center gap-1.5 ml-2">
                  <span className="text-[11px] text-slate-400">Show</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1 border border-slate/20 rounded bg-canvas text-ink text-xs focus:outline-none focus:border-brandGreenDark font-medium"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-[11px] text-slate-400">per page</span>
                </div>
              </div>

              {/* Page Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={safeCurrentPage === 1}
                  className="px-2.5 py-1 border border-slate/20 rounded bg-surface hover:bg-canvas text-slate disabled:opacity-40 text-xs font-medium cursor-pointer disabled:cursor-not-allowed"
                  title="First Page"
                >
                  « First
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                  className="px-3 py-1 border border-slate/20 rounded bg-surface hover:bg-canvas text-slate disabled:opacity-40 text-xs font-medium cursor-pointer disabled:cursor-not-allowed"
                  title="Previous Page"
                >
                  ‹ Prev
                </button>
                <span className="px-3 py-1 font-semibold text-ink text-xs bg-slate-100/60 rounded">
                  Page {safeCurrentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="px-3 py-1 border border-slate/20 rounded bg-surface hover:bg-canvas text-slate disabled:opacity-40 text-xs font-medium cursor-pointer disabled:cursor-not-allowed"
                  title="Next Page"
                >
                  Next ›
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safeCurrentPage === totalPages}
                  className="px-2.5 py-1 border border-slate/20 rounded bg-surface hover:bg-canvas text-slate disabled:opacity-40 text-xs font-medium cursor-pointer disabled:cursor-not-allowed"
                  title="Last Page"
                >
                  Last »
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MANUAL CREATION */}
      {activeTab === 'manual' && (
        <div className="bg-canvas border border-slate/10 rounded-lg p-6 max-w-2xl">
          <h3 className="text-lg font-medium text-ink border-b border-slate/5 pb-3 mb-5">
            Register Student Profile
          </h3>

          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                Student Full Name
              </label>
              <input
                id="fullName"
                type="text"
                required
                placeholder="e.g. John Doe"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="student@school.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                  Phone (Optional)
                </label>
                <input
                  id="phone"
                  type="text"
                  placeholder="+234..."
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="dob" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                  Date of Birth (Optional)
                </label>
                <input
                  id="dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={e => setDateOfBirth(e.target.value)}
                  className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark bg-canvas text-ink"
                />
              </div>

              <div>
                <label htmlFor="sex" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                  Sex (Optional)
                </label>
                <select
                  id="sex"
                  value={sex}
                  onChange={e => setSex(e.target.value as any)}
                  className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark bg-canvas text-ink"
                >
                  <option value="">Unspecified</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="pass" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                Custom Password (Optional)
              </label>
              <input
                id="pass"
                type="password"
                placeholder="Defaults to password123"
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={6}
                className="w-full text-input rounded-md px-3.5 py-2.5 text-sm border border-slate/20 focus:outline-none focus:border-brandGreenDark"
              />
            </div>

            <div className="border border-slate/10 rounded-lg p-3 bg-surface">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-ink uppercase tracking-wider">
                  Assign Class {createClassId ? '(1)' : '(0)'}
                </p>
                <button
                  type="button"
                  onClick={() => setCreateClassId(null)}
                  disabled={!createClassId}
                  className="rounded-full border border-slate/20 px-2 py-0.5 text-[10px] font-semibold text-slate hover:bg-canvas disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
              <input
                type="text"
                placeholder="Search classes..."
                value={createClassSearch}
                onChange={(e) => setCreateClassSearch(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate/20 rounded focus:outline-none focus:border-brandGreenDark bg-canvas text-ink mb-2"
              />
              <div className="max-h-44 overflow-y-auto space-y-1">
                {filteredCreateClasses.map((classItem) => {
                  const isSelected = createClassId === classItem.id;
                  return (
                    <label key={classItem.id} className="flex items-center justify-between p-2 rounded text-xs bg-canvas border border-slate/10 cursor-pointer">
                      <span className="truncate pr-2">{classItem.name}</span>
                      <input
                        type="radio"
                        name="student-create-class"
                        checked={isSelected}
                        onChange={() => handleCreateClassToggle(classItem.id)}
                        className="w-4 h-4 accent-brandGreen"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-brandGreen text-brandTealDeep font-bold px-6 py-2.5 rounded-full hover:bg-brandGreen/90 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {loading ? 'Creating...' : 'Register Student'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: CSV BATCH IMPORT */}
      {activeTab === 'csv' && (
        <div className="bg-canvas border border-slate/10 rounded-lg p-6 space-y-6">
          <div className="border-b border-slate/5 pb-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h3 className="text-lg font-medium text-ink">
                Roster CSV Bulk Importer
              </h3>
              <p className="text-slate text-xs mt-1">
                Add multiple students at once. Columns should be formatted as: <strong>Name, Email, Phone, Class</strong>. Headers are ignored automatically.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadCsvTemplate}
              className="text-xs font-semibold text-brandGreenDark hover:text-brandTealDeep border border-slate/10 px-3 py-2 rounded-md bg-surface whitespace-nowrap"
            >
              Download Sample CSV
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Options */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                  Upload CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFileChange}
                  className="block w-full text-xs text-slate file:mr-4 file:py-2.5 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-brandGreenSoft file:text-brandGreenDark hover:file:bg-brandGreenSoft/80"
                />
              </div>

              <div>
                <label htmlFor="csvPaste" className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                  Or Paste CSV Text
                </label>
                <textarea
                  id="csvPaste"
                  rows={8}
                  placeholder="e.g.&#10;Michael Scott,michael@dunder.com,08011223344&#10;Dwight Schrute,dwight@dunder.com,08055667788"
                  value={csvText}
                  onChange={handleCsvPasteChange}
                  className="w-full text-input rounded-md px-3.5 py-2.5 text-xs font-mono border border-slate/20 focus:outline-none focus:border-brandGreenDark"
                />
              </div>
            </div>

            {/* Preview Column */}
            <div className="border border-slate/10 rounded-lg p-4 bg-surface flex flex-col justify-between h-[320px] overflow-hidden">
              <div className="overflow-y-auto space-y-3 flex-1 mb-4">
                <span className="text-[10px] font-bold text-slate uppercase tracking-wider block mb-1">
                  Parsing Live Preview
                </span>

                {csvPreview.length > 0 ? (
                  <div className="space-y-2.5 text-[11px] font-sans">
                    {csvPreview.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded border flex justify-between items-center ${
                          !item.valid
                            ? 'bg-red-50/50 border-red-200 text-red-800'
                            : item.isMissingClass
                            ? 'bg-amber-50/60 border-amber-200 text-amber-900'
                            : 'bg-green-50/50 border-green-200 text-green-800'
                        }`}
                      >
                        <div>
                          <p className="font-semibold">{item.fullName || 'Blank Name'}</p>
                          <p className="text-[10px] opacity-75">{item.email || 'Blank Email'}</p>
                          <p className="text-[10px] opacity-75">
                            {item.className ? (
                              <span>
                                Class: <strong className="font-semibold">{item.className}</strong>
                              </span>
                            ) : (
                              'No Class'
                            )}
                          </p>
                        </div>
                        <div>
                          {!item.valid ? (
                            <span
                              className="text-[9px] font-bold bg-red-200 px-2 py-0.5 rounded cursor-help"
                              title={item.errorReason}
                            >
                              Error: {item.errorReason}
                            </span>
                          ) : item.isMissingClass ? (
                            <span className="text-[9px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                              New Class Needed
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold bg-green-200 px-2 py-0.5 rounded">Valid</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                    Paste text or load a CSV file to inspect parse trees.
                  </div>
                )}
              </div>

              {csvPreview.length > 0 && (
                <div className="border-t border-slate/10 pt-3 space-y-3">
                  {missingClasses.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-900 flex items-start gap-2">
                      <span className="text-base leading-none">✨</span>
                      <div>
                        <p className="font-semibold">
                          {missingClasses.length} new {missingClasses.length === 1 ? 'class' : 'classes'} detected in CSV
                        </p>
                        <p className="text-[11px] text-amber-800/80 mt-0.5">
                          Uncreated class(es): <strong className="font-mono">{missingClasses.join(', ')}</strong>.
                          Submitting will automatically create {missingClasses.length === 1 ? 'this class' : 'these classes'} and enroll students.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-xs font-medium text-ink gap-2 flex-wrap">
                    <span>
                      Valid: <span className="text-green-700 font-bold">{csvPreview.filter((p) => p.valid).length}</span> | Invalid:{' '}
                      <span className="text-red-600 font-bold">{csvPreview.filter((p) => !p.valid).length}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      {missingClasses.length > 0 ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleBulkSubmit(false)}
                            disabled={loading || csvPreview.filter((p) => p.valid).length === 0}
                            className="border border-slate/20 text-slate hover:text-ink px-3 py-1.5 rounded-full font-medium text-[11px] transition-all disabled:opacity-50"
                          >
                            Submit Only Existing
                          </button>
                          <button
                            type="button"
                            onClick={() => handleBulkSubmit(true)}
                            disabled={loading || csvPreview.filter((p) => p.valid).length === 0}
                            className="bg-brandGreen text-brandTealDeep px-4 py-2 rounded-full font-bold hover:bg-brandGreen/90 disabled:opacity-50 transition-all text-[11px] shadow-sm flex items-center gap-1.5"
                          >
                            <span>{loading ? 'Creating & Submitting...' : 'Submit & Create Classes'}</span>
                            <span className="bg-brandTealDeep/15 text-brandTealDeep text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold">
                              +{missingClasses.length}
                            </span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleBulkSubmit(false)}
                          disabled={loading || csvPreview.filter((p) => p.valid).length === 0}
                          className="bg-brandGreen text-brandTealDeep px-4 py-2 rounded-full font-bold hover:bg-brandGreen/90 disabled:opacity-50 transition-all text-[11px]"
                        >
                          {loading ? 'Submitting...' : 'Submit Import'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL DIALOG */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-brandTealDeep/50 backdrop-blur-xs" onClick={() => setEditingStudent(null)} />
          <div className="relative bg-canvas border border-slate/10 rounded-lg p-6 w-full max-w-md shadow-2xl animate-fade-in font-sans">
            <h3 className="text-base font-semibold text-ink border-b border-slate/5 pb-2.5 mb-4">
              Edit Student Profile
            </h3>
            
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label htmlFor="editName" className="block text-[11px] font-semibold text-slate uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  id="editName"
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full text-input rounded-md px-3 py-2 text-xs border border-slate/20 focus:outline-none focus:border-brandGreenDark"
                />
              </div>

              <div>
                <label htmlFor="editEmail" className="block text-[11px] font-semibold text-slate uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  id="editEmail"
                  type="email"
                  required
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="w-full text-input rounded-md px-3 py-2 text-xs border border-slate/20 focus:outline-none focus:border-brandGreenDark"
                />
              </div>

              <div>
                <label htmlFor="editPhone" className="block text-[11px] font-semibold text-slate uppercase tracking-wider mb-1.5">
                  Phone (Optional)
                </label>
                <input
                  id="editPhone"
                  type="text"
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  className="w-full text-input rounded-md px-3 py-2 text-xs border border-slate/20 focus:outline-none focus:border-brandGreenDark"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="editDob" className="block text-[11px] font-semibold text-slate uppercase tracking-wider mb-1.5">
                    Date of Birth
                  </label>
                  <input
                    id="editDob"
                    type="date"
                    value={editDob}
                    onChange={e => setEditDob(e.target.value)}
                    className="w-full text-input rounded-md px-3 py-2 text-xs border border-slate/20 focus:outline-none focus:border-brandGreenDark bg-canvas text-ink"
                  />
                </div>
                <div>
                  <label htmlFor="editSex" className="block text-[11px] font-semibold text-slate uppercase tracking-wider mb-1.5">
                    Sex
                  </label>
                  <select
                    id="editSex"
                    value={editSex}
                    onChange={e => setEditSex(e.target.value as any)}
                    className="w-full text-input rounded-md px-3 py-2 text-xs border border-slate/20 focus:outline-none focus:border-brandGreenDark bg-canvas text-ink"
                  >
                    <option value="">Unspecified</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="border border-slate/10 rounded-lg p-3 bg-surface">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold text-ink uppercase tracking-wider">
                    Assigned Class {editClassId ? '(1)' : '(0)'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setEditClassId(null)}
                    disabled={!editClassId}
                    className="rounded-full border border-slate/20 px-2 py-0.5 text-[10px] font-semibold text-slate hover:bg-canvas disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Search classes..."
                  value={editClassSearch}
                  onChange={(e) => setEditClassSearch(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate/20 rounded focus:outline-none focus:border-brandGreenDark bg-canvas text-ink mb-2"
                />
                <div className="max-h-44 overflow-y-auto space-y-1">
                  {filteredEditClasses.map((classItem) => {
                    const isSelected = editClassId === classItem.id;
                    return (
                      <label key={classItem.id} className="flex items-center justify-between p-2 rounded text-xs bg-canvas border border-slate/10 cursor-pointer">
                        <span className="truncate pr-2">{classItem.name}</span>
                        <input
                          type="radio"
                          name="student-edit-class"
                          checked={isSelected}
                          onChange={() => handleEditClassToggle(classItem.id)}
                          className="w-4 h-4 accent-brandGreen"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 border border-slate/10 text-xs text-slate hover:bg-surface rounded-full"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-brandGreen text-brandTealDeep font-bold text-xs hover:bg-brandGreen/90 disabled:opacity-50 rounded-full"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PASSWORD RESET MODAL DIALOG */}
      {resetStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-brandTealDeep/50 backdrop-blur-xs"
            onClick={() => setResetStudent(null)}
          />
          <div className="relative bg-canvas border border-slate/10 rounded-lg p-6 w-full max-w-md shadow-2xl animate-fade-in font-sans space-y-4">
            <div className="border-b border-slate/10 pb-3">
              <h3 className="text-base font-semibold text-ink">Reset Student Password</h3>
              <p className="text-xs text-slate mt-0.5">
                Set a new password for <strong className="font-semibold text-ink">{resetStudent.fullName}</strong> ({resetStudent.email}).
              </p>
            </div>

            {resetError && (
              <div className="bg-red-50 text-red-700 border border-red-200 px-3 py-2 rounded text-xs font-medium">
                {resetError}
              </div>
            )}

            <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="newStudentPassword"
                  className="block text-[11px] font-semibold text-slate uppercase tracking-wider mb-1.5"
                >
                  New Password *
                </label>
                <div className="flex gap-2">
                  <input
                    id="newStudentPassword"
                    type="text"
                    required
                    minLength={6}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="flex-1 text-input rounded-md px-3 py-2 text-xs border border-slate/20 focus:outline-none focus:border-brandGreenDark font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
                      let gen = '';
                      for (let i = 0; i < 8; i++) gen += chars.charAt(Math.floor(Math.random() * chars.length));
                      setNewPassword(gen);
                    }}
                    className="px-2.5 py-1.5 border border-slate/20 text-xs text-slate hover:text-ink rounded bg-surface font-medium whitespace-nowrap"
                  >
                    🎲 Generate
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate/10">
                <button
                  type="button"
                  onClick={() => setResetStudent(null)}
                  className="px-4 py-2 border border-slate/10 text-xs text-slate hover:bg-surface rounded-full"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetSubmitting || !newPassword}
                  className="px-4 py-2 bg-brandGreen text-brandTealDeep font-bold text-xs hover:bg-brandGreen/90 disabled:opacity-50 rounded-full"
                >
                  {resetSubmitting ? 'Updating…' : 'Save New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
