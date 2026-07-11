'use client';

import React, { useMemo, useRef, useState } from 'react';

type SubmissionType = 'TEXT' | 'AUDIO' | 'VIDEO';

interface LessonOption {
  id: string;
  title: string;
}

interface ModuleOption {
  id: string;
  title: string;
  lessons: LessonOption[];
}

interface ClassOption {
  id: string;
  name: string;
  category: string;
}

interface AssignmentSummary {
  id: string;
  title: string;
  submissionType: SubmissionType;
  dueDate: string;
  maxAttempts: number;
  active: boolean;
  moduleTitle: string;
  lessonTitle: string | null;
  classNames: string[];
}

interface AssignmentsManagerClientProps {
  schoolSlug: string;
  modules: ModuleOption[];
  classes: ClassOption[];
  initialAssignments: AssignmentSummary[];
}

interface FormState {
  title: string;
  description: string;
  instructions: string;
  moduleId: string;
  lessonId: string;
  submissionType: SubmissionType;
  maxDurationSeconds: number;
  maxAttempts: number;
  dueDate: string;
  classIds: string[];
}

const defaultState: FormState = {
  title: '',
  description: '',
  instructions: '',
  moduleId: '',
  lessonId: '',
  submissionType: 'TEXT',
  maxDurationSeconds: 180,
  maxAttempts: 2,
  dueDate: '',
  classIds: [],
};

export function AssignmentsManagerClient({
  schoolSlug,
  modules,
  classes,
  initialAssignments,
}: AssignmentsManagerClientProps) {
  const [formState, setFormState] = useState<FormState>(defaultState);
  const [assignments, setAssignments] = useState<AssignmentSummary[]>(initialAssignments);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  const selectedModule = useMemo(
    () => modules.find((module) => module.id === formState.moduleId),
    [modules, formState.moduleId]
  );

  const availableLessons = selectedModule?.lessons ?? [];

  const handleClassToggle = (classId: string) => {
    setFormState((prev) => {
      const nextClassIds = prev.classIds.includes(classId)
        ? prev.classIds.filter((id) => id !== classId)
        : [...prev.classIds, classId];

      return {
        ...prev,
        classIds: nextClassIds,
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (isSubmittingRef.current) {
      return;
    }

    isSubmittingRef.current = true;
    setError(null);
    setSuccess(null);

    if (!formState.title.trim()) {
      setError('Assignment title is required.');
      isSubmittingRef.current = false;
      return;
    }

    if (!formState.moduleId) {
      setError('Please select a module.');
      isSubmittingRef.current = false;
      return;
    }

    if (!formState.dueDate) {
      setError('Please set a due date.');
      isSubmittingRef.current = false;
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/ec/${schoolSlug}/admin/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formState,
          lessonId: formState.lessonId || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to create assignment.');
        return;
      }

      const selectedClassNames = classes
        .filter((entry) => formState.classIds.includes(entry.id))
        .map((entry) => entry.name);

      const moduleTitle = modules.find((module) => module.id === formState.moduleId)?.title ?? 'Unknown module';
      const lessonTitle =
        availableLessons.find((lesson) => lesson.id === formState.lessonId)?.title ?? null;

      setAssignments((prev) => [
        {
          id: data.assignment.id,
          title: data.assignment.title,
          submissionType: data.assignment.submissionType,
          dueDate: new Date(data.assignment.dueDate).toISOString(),
          maxAttempts: data.assignment.maxAttempts,
          active: data.assignment.active,
          moduleTitle,
          lessonTitle,
          classNames: selectedClassNames,
        },
        ...prev,
      ]);

      setSuccess('Assignment created successfully.');
      setFormState(defaultState);
    } catch (submitError) {
      console.error('Error creating assignment:', submitError);
      setError('Unexpected error while creating assignment.');
    } finally {
      setSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <section className="xl:col-span-2 bg-canvas border border-slate/10 rounded-xl p-5 md:p-6">
        <h3 className="text-lg font-semibold text-ink mb-4">Create Assignment</h3>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate mb-1">Title</label>
            <input
              value={formState.title}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, title: event.target.value }))
              }
              className="w-full border border-slate/15 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brandGreen/40"
              placeholder="Mid-term literature essay"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate mb-1">Module</label>
              <select
                value={formState.moduleId}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    moduleId: event.target.value,
                    lessonId: '',
                  }))
                }
                className="w-full border border-slate/15 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brandGreen/40"
              >
                <option value="">Select module</option>
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate mb-1">Lesson (optional)</label>
              <select
                value={formState.lessonId}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, lessonId: event.target.value }))
                }
                disabled={!formState.moduleId}
                className="w-full border border-slate/15 rounded-lg px-3 py-2 text-sm bg-white disabled:bg-slate/5 disabled:text-slate focus:outline-none focus:ring-2 focus:ring-brandGreen/40"
              >
                <option value="">No lesson link</option>
                {availableLessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate mb-1">Submission Type</label>
              <select
                value={formState.submissionType}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    submissionType: event.target.value as SubmissionType,
                  }))
                }
                className="w-full border border-slate/15 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brandGreen/40"
              >
                <option value="TEXT">Text</option>
                <option value="AUDIO">Audio</option>
                <option value="VIDEO">Video</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate mb-1">Attempts</label>
              <input
                type="number"
                min={1}
                max={10}
                value={formState.maxAttempts}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    maxAttempts: Number(event.target.value || 1),
                  }))
                }
                className="w-full border border-slate/15 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brandGreen/40"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate mb-1">Max Duration (sec)</label>
              <input
                type="number"
                min={30}
                max={3600}
                value={formState.maxDurationSeconds}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    maxDurationSeconds: Number(event.target.value || 180),
                  }))
                }
                className="w-full border border-slate/15 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brandGreen/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate mb-1">Due Date</label>
            <input
              type="datetime-local"
              value={formState.dueDate}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, dueDate: event.target.value }))
              }
              className="w-full border border-slate/15 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brandGreen/40"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate mb-1">Description (optional)</label>
            <textarea
              value={formState.description}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, description: event.target.value }))
              }
              rows={3}
              className="w-full border border-slate/15 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brandGreen/40"
              placeholder="Assignment summary for students"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate mb-1">Instructions (optional)</label>
            <textarea
              value={formState.instructions}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, instructions: event.target.value }))
              }
              rows={4}
              className="w-full border border-slate/15 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brandGreen/40"
              placeholder="Submission guidance, marking policy, and constraints"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate mb-2">Target Classes (optional)</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-slate/10 rounded-lg p-3 bg-surface/40">
              {classes.map((entry) => {
                const selected = formState.classIds.includes(entry.id);
                return (
                  <label
                    key={entry.id}
                    className="flex items-center gap-2 text-sm text-ink"
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => handleClassToggle(entry.id)}
                    />
                    <span>{entry.name}</span>
                    <span className="text-xs text-slate">({entry.category})</span>
                  </label>
                );
              })}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-700">{success}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-lg bg-brandGreen text-brandTealDeep font-semibold text-sm px-4 py-2.5 hover:brightness-95 disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Assignment'}
          </button>
        </form>
      </section>

      <section className="bg-canvas border border-slate/10 rounded-xl p-5 md:p-6">
        <h3 className="text-lg font-semibold text-ink mb-4">Recent Assignments</h3>

        <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1">
          {assignments.length === 0 ? (
            <p className="text-sm text-slate">No assignments created yet.</p>
          ) : (
            assignments.map((assignment) => (
              <article key={assignment.id} className="border border-slate/10 rounded-lg p-3 bg-surface/50">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="font-medium text-ink text-sm">{assignment.title}</h4>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      assignment.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {assignment.active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>

                <p className="text-xs text-slate mt-1">
                  {assignment.moduleTitle}
                  {assignment.lessonTitle ? ` • ${assignment.lessonTitle}` : ''}
                </p>

                <p className="text-xs text-slate mt-1">
                  Type: {assignment.submissionType} • Attempts: {assignment.maxAttempts}
                </p>

                <p className="text-xs text-slate mt-1">
                  Due: {new Date(assignment.dueDate).toLocaleString()}
                </p>

                <p className="text-xs text-slate mt-1">
                  Classes:{' '}
                  {assignment.classNames.length > 0
                    ? assignment.classNames.join(', ')
                    : 'All classes'}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
