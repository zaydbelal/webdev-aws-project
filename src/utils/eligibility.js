/**
 * Server-side eligibility gate. A posting with an empty allowed_branches
 * string is open to every branch; otherwise the student's branch must
 * appear in the comma-separated list (case-insensitive).
 */
function checkEligibility(student, job) {
  const reasons = [];

  if (student.cgpa < job.min_cgpa) {
    reasons.push(`Your CGPA (${student.cgpa}) is below the required minimum (${job.min_cgpa}).`);
  }

  const allowed = (job.allowed_branches || '')
    .split(',')
    .map((b) => b.trim().toUpperCase())
    .filter(Boolean);

  if (allowed.length > 0 && !allowed.includes((student.branch || '').trim().toUpperCase())) {
    reasons.push(`Your branch (${student.branch}) is not in the eligible branches for this role (${allowed.join(', ')}).`);
  }

  return { eligible: reasons.length === 0, reasons };
}

module.exports = { checkEligibility };
