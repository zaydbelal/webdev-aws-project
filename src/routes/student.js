const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');
const { checkEligibility } = require('../utils/eligibility');

const router = express.Router();
router.use(requireRole('student'));

function getStudentProfile(userId) {
  return db
    .prepare(
      `SELECT u.id as user_id, u.name, u.email, s.branch, s.cgpa, s.graduation_year, s.resume_link
       FROM users u JOIN students s ON s.user_id = u.id WHERE u.id = ?`
    )
    .get(userId);
}

router.get('/dashboard', (req, res) => {
  const student = getStudentProfile(req.session.user.id);

  const jobs = db
    .prepare(
      `SELECT j.*, c.name as company_name
       FROM jobs j JOIN companies c ON c.id = j.company_id
       WHERE j.status = 'approved' AND c.status = 'approved'
       ORDER BY j.created_at DESC`
    )
    .all();

  const appliedJobIds = new Set(
    db
      .prepare('SELECT job_id FROM applications WHERE student_user_id = ?')
      .all(req.session.user.id)
      .map((r) => r.job_id)
  );

  const jobsWithEligibility = jobs.map((job) => ({
    ...job,
    eligibility: checkEligibility(student, job),
    alreadyApplied: appliedJobIds.has(job.id),
  }));

  res.render('student/dashboard', { title: 'Job Openings', student, jobs: jobsWithEligibility });
});

router.get('/jobs/:id', (req, res) => {
  const student = getStudentProfile(req.session.user.id);
  const job = db
    .prepare(
      `SELECT j.*, c.name as company_name, c.description as company_description, c.website as company_website
       FROM jobs j JOIN companies c ON c.id = j.company_id
       WHERE j.id = ? AND j.status = 'approved' AND c.status = 'approved'`
    )
    .get(req.params.id);

  if (!job) {
    req.session.flash = { type: 'error', message: 'That job posting is not available.' };
    return res.redirect('/student/dashboard');
  }

  const existingApplication = db
    .prepare('SELECT * FROM applications WHERE job_id = ? AND student_user_id = ?')
    .get(job.id, req.session.user.id);

  const eligibility = checkEligibility(student, job);

  res.render('student/job-detail', { title: job.title, job, student, eligibility, existingApplication });
});

router.post('/jobs/:id/apply', (req, res) => {
  const student = getStudentProfile(req.session.user.id);
  const job = db
    .prepare(`SELECT j.*, c.status as company_status FROM jobs j JOIN companies c ON c.id = j.company_id WHERE j.id = ?`)
    .get(req.params.id);

  if (!job || job.status !== 'approved' || job.company_status !== 'approved') {
    req.session.flash = { type: 'error', message: 'That job posting is not available.' };
    return res.redirect('/student/dashboard');
  }

  const existing = db
    .prepare('SELECT id FROM applications WHERE job_id = ? AND student_user_id = ?')
    .get(job.id, req.session.user.id);
  if (existing) {
    req.session.flash = { type: 'error', message: 'You have already applied to this job.' };
    return res.redirect(`/student/jobs/${job.id}`);
  }

  const { eligible, reasons } = checkEligibility(student, job);
  if (!eligible) {
    req.session.flash = { type: 'error', message: `You are not eligible for this role: ${reasons.join(' ')}` };
    return res.redirect(`/student/jobs/${job.id}`);
  }

  db.prepare('INSERT INTO applications (job_id, student_user_id, status) VALUES (?, ?, ?)').run(
    job.id,
    req.session.user.id,
    'applied'
  );

  req.session.flash = { type: 'success', message: `Application submitted for ${job.title}.` };
  res.redirect('/student/applications');
});

router.get('/applications', (req, res) => {
  const applications = db
    .prepare(
      `SELECT a.*, j.title as job_title, c.name as company_name
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       JOIN companies c ON c.id = j.company_id
       WHERE a.student_user_id = ?
       ORDER BY a.applied_at DESC`
    )
    .all(req.session.user.id);

  res.render('student/applications', { title: 'My Applications', applications });
});

router.get('/profile', (req, res) => {
  const student = getStudentProfile(req.session.user.id);
  res.render('student/profile', { title: 'My Profile', student });
});

router.post('/profile', (req, res) => {
  const { branch, cgpa, graduation_year, resume_link } = req.body;
  db.prepare(
    'UPDATE students SET branch = ?, cgpa = ?, graduation_year = ?, resume_link = ? WHERE user_id = ?'
  ).run((branch || '').trim(), parseFloat(cgpa) || 0, parseInt(graduation_year, 10) || 0, (resume_link || '').trim(), req.session.user.id);

  req.session.flash = { type: 'success', message: 'Profile updated.' };
  res.redirect('/student/profile');
});

module.exports = router;
