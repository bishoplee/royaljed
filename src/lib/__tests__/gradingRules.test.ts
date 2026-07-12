import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRubric,
  normalizeScores,
  normalizeTimestampedFeedback,
  calculatePercentage,
  MAX_TIMESTAMP_SECONDS,
  MAX_FEEDBACK_TEXT_LENGTH,
  MAX_TIMESTAMP_COMMENT_LENGTH,
} from '../grading';

test('normalizeRubric processes and sanitizes rubric configurations', () => {
  // Valid rubric conversion
  const rawRubric = [
    { name: 'Clarity', percentage: 25 },
    { name: '  Pronunciation  ', percentage: '30' },
    { name: 'Fluency', percentage: 45.5 },
  ];
  const normalized = normalizeRubric(rawRubric);
  assert.deepEqual(normalized, [
    { name: 'Clarity', percentage: 25 },
    { name: 'Pronunciation', percentage: 30 },
    { name: 'Fluency', percentage: 45.5 },
  ]);

  // Invalid item filtering
  const badRubric = [
    { name: '', percentage: 20 }, // empty name
    { name: 'Tone', percentage: 0 }, // zero percentage
    { name: 'Speed', percentage: -5 }, // negative percentage
    { name: 'Gesture', percentage: NaN }, // invalid percentage
    null,
    'not-an-object',
  ];
  assert.deepEqual(normalizeRubric(badRubric), []);
  assert.deepEqual(normalizeRubric(null), []);
  assert.deepEqual(normalizeRubric(''), []);
});

test('normalizeScores processes and sanitizes criterion scores', () => {
  // Valid scores conversion
  const rawScores = [
    { criteria: 'Clarity', score: 85 },
    { criteria: '  Pronunciation  ', score: '90' },
  ];
  assert.deepEqual(normalizeScores(rawScores), [
    { criteria: 'Clarity', score: 85 },
    { criteria: 'Pronunciation', score: 90 },
  ]);

  // Invalid item filtering
  const badScores = [
    { criteria: '', score: 80 },
    { criteria: 'Tone', score: NaN },
    null,
    'string',
  ];
  assert.deepEqual(normalizeScores(badScores), []);
  assert.deepEqual(normalizeScores(undefined), []);
});

test('normalizeTimestampedFeedback sanitizes, validates, and sorts timeline comments', () => {
  // Valid inputs, sorting correctness, and flooring
  const rawComments = [
    { timestampSeconds: 20.7, comment: 'Nice breath control' },
    { timestampSeconds: 5, comment: '  Slight pause here  ' },
    { timestampSeconds: 12.3, comment: 'Good posture' },
  ];
  const normalized = normalizeTimestampedFeedback(rawComments);
  assert.deepEqual(normalized, [
    { timestampSeconds: 5, comment: 'Slight pause here' },
    { timestampSeconds: 12, comment: 'Good posture' },
    { timestampSeconds: 20, comment: 'Nice breath control' },
  ]);

  // Out of bounds and size limit validation
  const invalidComments = [
    { timestampSeconds: -1, comment: 'Negative timestamp' },
    { timestampSeconds: MAX_TIMESTAMP_SECONDS + 1, comment: 'Exceeds limit' },
    { timestampSeconds: 10, comment: '' }, // empty comment
    { timestampSeconds: 10, comment: 'a'.repeat(MAX_TIMESTAMP_COMMENT_LENGTH + 1) }, // too long
    null,
  ];
  assert.deepEqual(normalizeTimestampedFeedback(invalidComments), []);
});

test('calculatePercentage handles grading calculations correctly', () => {
  const rubric = [
    { name: 'Clarity', percentage: 25 },
    { name: 'Pronunciation', percentage: 25 },
    { name: 'Fluency', percentage: 50 },
  ];

  // Perfect score
  const perfectScores = [
    { criteria: 'Clarity', score: 100 },
    { criteria: 'Pronunciation', score: 100 },
    { criteria: 'Fluency', score: 100 },
  ];
  const resultPerfect = calculatePercentage(rubric, perfectScores);
  assert.equal(resultPerfect.ok, true);
  if (resultPerfect.ok) {
    assert.equal(resultPerfect.percentage, 100);
  }

  // Weighted calculation verification
  const mixedScores = [
    { criteria: 'Clarity', score: 80 }, // 80 * 0.25 = 20
    { criteria: 'Pronunciation', score: 90 }, // 90 * 0.25 = 22.5
    { criteria: 'Fluency', score: 70 }, // 70 * 0.50 = 35
  ]; // Total: 20 + 22.5 + 35 = 77.5
  const resultMixed = calculatePercentage(rubric, mixedScores);
  assert.equal(resultMixed.ok, true);
  if (resultMixed.ok) {
    assert.equal(resultMixed.percentage, 77.5);
  }

  // Error case: Missing score for a criterion
  const missingScores = [
    { criteria: 'Clarity', score: 80 },
    { criteria: 'Fluency', score: 70 },
  ];
  const resultMissing = calculatePercentage(rubric, missingScores);
  assert.equal(resultMissing.ok, false);
  if (!resultMissing.ok) {
    assert.match(resultMissing.error, /Missing scores for rubric criteria: Pronunciation/);
  }

  // Error case: Score out of bounds (< 0)
  const negativeScore = [
    { criteria: 'Clarity', score: -5 },
    { criteria: 'Pronunciation', score: 90 },
    { criteria: 'Fluency', score: 70 },
  ];
  const resultNegative = calculatePercentage(rubric, negativeScore);
  assert.equal(resultNegative.ok, false);
  if (!resultNegative.ok) {
    assert.match(resultNegative.error, /must be between 0 and 100/);
  }

  // Error case: Score out of bounds (> 100)
  const tooHighScore = [
    { criteria: 'Clarity', score: 105 },
    { criteria: 'Pronunciation', score: 90 },
    { criteria: 'Fluency', score: 70 },
  ];
  const resultTooHigh = calculatePercentage(rubric, tooHighScore);
  assert.equal(resultTooHigh.ok, false);
  if (!resultTooHigh.ok) {
    assert.match(resultTooHigh.error, /must be between 0 and 100/);
  }

  // Error case: Rubric weights total zero or negative
  const zeroWeightRubric = [
    { name: 'Clarity', percentage: 0 },
    { name: 'Fluency', percentage: 0 },
  ];
  const zeroWeightScores = [
    { criteria: 'Clarity', score: 80 },
    { criteria: 'Fluency', score: 70 },
  ];
  const resultZeroWeight = calculatePercentage(zeroWeightRubric, zeroWeightScores);
  assert.equal(resultZeroWeight.ok, false);
  if (!resultZeroWeight.ok) {
    assert.match(resultZeroWeight.error, /weights must be greater than zero/);
  }
});
