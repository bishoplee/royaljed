export type RubricItem = {
  name: string;
  percentage: number;
};

export type ScoreInput = {
  criteria: string;
  score: number;
};

export type TimestampedFeedbackInput = {
  timestampSeconds: number;
  comment: string;
};

export const MAX_TIMESTAMP_SECONDS = 24 * 60 * 60;
export const MAX_FEEDBACK_TEXT_LENGTH = 5000;
export const MAX_TIMESTAMP_COMMENT_LENGTH = 1000;

export function normalizeRubric(raw: unknown): RubricItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;

      const name = 'name' in item ? String(item.name).trim() : '';
      const percentageRaw = 'percentage' in item ? Number(item.percentage) : NaN;

      if (!name || !Number.isFinite(percentageRaw) || percentageRaw <= 0) {
        return null;
      }

      return {
        name,
        percentage: percentageRaw,
      };
    })
    .filter((item): item is RubricItem => Boolean(item));
}

export function normalizeScores(raw: unknown): ScoreInput[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;

      const criteria = 'criteria' in item ? String(item.criteria).trim() : '';
      const score = 'score' in item ? Number(item.score) : NaN;

      if (!criteria || !Number.isFinite(score)) {
        return null;
      }

      return {
        criteria,
        score,
      };
    })
    .filter((item): item is ScoreInput => Boolean(item));
}

export function normalizeTimestampedFeedback(raw: unknown): TimestampedFeedbackInput[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;

      const timestampSeconds = 'timestampSeconds' in item ? Number(item.timestampSeconds) : NaN;
      const comment = 'comment' in item ? String(item.comment).trim() : '';

      if (
        !Number.isFinite(timestampSeconds) ||
        timestampSeconds < 0 ||
        timestampSeconds > MAX_TIMESTAMP_SECONDS ||
        !comment ||
        comment.length > MAX_TIMESTAMP_COMMENT_LENGTH
      ) {
        return null;
      }

      return {
        timestampSeconds: Math.floor(timestampSeconds),
        comment,
      };
    })
    .filter((item): item is TimestampedFeedbackInput => Boolean(item))
    .sort((a, b) => a.timestampSeconds - b.timestampSeconds);
}

export function calculatePercentage(rubric: RubricItem[], scores: ScoreInput[]) {
  const scoreByCriteria = new Map(scores.map((entry) => [entry.criteria, entry.score]));

  const missingCriteria = rubric
    .filter((criterion) => !scoreByCriteria.has(criterion.name))
    .map((criterion) => criterion.name);

  if (missingCriteria.length > 0) {
    return {
      ok: false as const,
      error: `Missing scores for rubric criteria: ${missingCriteria.join(', ')}`,
    };
  }

  for (const scoreEntry of scores) {
    if (scoreEntry.score < 0 || scoreEntry.score > 100) {
      return {
        ok: false as const,
        error: `Score for ${scoreEntry.criteria} must be between 0 and 100.`,
      };
    }
  }

  const totalWeight = rubric.reduce((sum, item) => sum + item.percentage, 0);
  if (totalWeight <= 0) {
    return {
      ok: false as const,
      error: 'Rubric weights must be greater than zero.',
    };
  }

  const weightedScore = rubric.reduce((sum, criterion) => {
    const score = scoreByCriteria.get(criterion.name) ?? 0;
    return sum + score * (criterion.percentage / totalWeight);
  }, 0);

  return {
    ok: true as const,
    percentage: Number(weightedScore.toFixed(2)),
  };
}
