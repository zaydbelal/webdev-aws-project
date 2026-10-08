const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireRole('recruiter'));

function getCompany(recruiterUserId) {
  return db.prepare('SELECT * FROM companies WHERE recruiter_user_id = ?').get(recruiterUserId);
}

router.get('/dashboard', (req, res) => {
  const company = getCompany(req.session.user.id);

  let jobCount = 0;
  let applicationCount = 0;
  let recentApplications = [];

  if (company) {
    jobCount = db.prepare('SELECT COUNT(*) as c FROM jobs WHERE company_id = ?').get(company.id).c;
    applicationCount = db
      .prepare(
        `SELECT COUNT(*) as c FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.company_id = ?`
      )
      .get(company.id).c;
    recentApplications = db
      .prepare(
        `SELECT a.*, j.title as job_title, u.name as student_name
         FROM applications a
         JOIN jobs j ON j.id = a.job_id
         JOIN users u ON u.id = a.student_user_id
         WHERE j.company_id = ?
         ORDER BY a.applied_at DESC LIMIT 8`
      )
      .all(company.id);
  }

  res.render('recruiter/dashboard', { title: 'Dashboard', company, jobCount, applicationCount, recentApplications });
});

router.get('/company', (req, res) => {
  const company = getCompany(req.session.user.id);
  res.render('recruiter/company', { title: 'Company Profile', company });
});

router.post('/company', (req, res) => {
  const { name, website, description } = req.body;
  if (!name || !name.trim()) {
    req.session.flash = { type: 'error', message: 'Company name is required.' };
    return res.redirect('/recruiter/company');
  }

  const existing = getCompany(req.session.user.id);

  if (existing) {
    db.prepare('UPDATE companies SET name = ?, website = ?, description = ? WHERE id = ?').run(
      name.trim(),
      (website || '').trim(),
      (description || '').trim(),
      existing.id
    );
    req.session.flash = { type: 'success', message: 'Company profile updated.' };
  } else {
    db.prepare(
      'INSERT INTO companies (recruiter_user_id, name, website, description, status) VALUES (?, ?, ?, ?, ?)'
    ).run(req.session.user.id, name.trim(), (website || '').trim(), (description || '').trim(), 'pending');
    req.session.flash = { type: 'success', message: 'Company profile created and submitted for admin approval.' };
  }

  res.redirect('/recruiter/company');
});

router.get('/jobs', (req, res) => {
  const company = getCompany(req.session.user.id);
  if (!company) {
    req.session.flash = { type: 'error', message: 'Create your company profile before posting jobs.' };
    return res.redirect('/recruiter/company');
  }

  const jobs = db
    .prepare(
      `SELECT j.*, (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) as applicant_count
       FROM jobs j WHERE j.company_id = ? ORDER BY j.created_at DESC`
    )
    .all(company.id);

  res.render('recruiter/jobs', { title: 'Job Postings', company, jobs });
});

router.get('/jobs/new', (req, res) => {
  const company = getCompany(req.session.user.id);
  if (!company) {
    req.session.flash = { type: 'error', message: 'Create your company profile before posting jobs.' };
    return res.redirect('/recruiter/company');
  }
  res.render('recruiter/job-form', { title: 'New Job Posting', company, form: {} });
});

router.post('/jobs', (req, res) => {
  const company = getCompany(req.session.user.id);
  if (!company) {
    req.session.flash = { type: 'error', message: 'Create your company profile before posting jobs.' };
    return res.redirect('/recruiter/company');
  }

  const { title, description, location, package_lpa, min_cgpa, allowed_branches } = req.body;
  if (!title || !title.trim()) {
    req.session.flash = { type: 'error', message: 'Job title is required.' };
    return res.render('recruiter/job-form', { title: 'New Job Posting', company, form: req.body });
  }

  const result = db
    .prepare(
      `INSERT INTO jobs (company_id, title, description, location, package_lpa, min_cgpa, allowed_branches, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
    )
    .run(
      company.id,
      title.trim(),
      (description || '').trim(),
      (location || '').trim(),
      (package_lpa || '').trim(),
      parseFloat(min_cgpa) || 0,
      (allowed_branches || '').trim()
    );

  req.session.flash = { type: 'success', message: 'Job posting submitted for admin approval.' };
  res.redirect(`/recruiter/jobs/${result.lastInsertRowid}`);
});

function getOwnedJob(req) {
  const company = getCompany(req.session.user.id);
  if (!company) return { company: null, job: null };
  const job = db.prepare('SELECT * FROM jobs WHERE id = ? AND company_id = ?').get(req.params.id, company.id);
  return { company, job };
}

router.get('/jobs/:id', (req, res) => {
  const { company, job } = getOwnedJob(req);
  if (!job) {
    req.session.flash = { type: 'error', message: 'Job posting not found.' };
    return res.redirect('/recruiter/jobs');
  }

  const applicants = db
    .prepare(
      `SELECT a.*, u.name as student_name, u.email as student_email, s.branch, s.cgpa, s.graduation_year, s.resume_link
       FROM applications a
       JOIN users u ON u.id = a.student_user_id
       JOIN students s ON s.user_id = u.id
       WHERE a.job_id = ?
       ORDER BY a.applied_at DESC`
    )
    .all(job.id);

  res.render('recruiter/job-detail', { title: job.title, company, job, applicants });
});

const VALID_STATUSES = ['applied', 'under_review', 'shortlisted', 'rejected', 'hired'];

router.post('/jobs/:id/applicants/status', (req, res) => {
  const { job } = getOwnedJob(req);
  if (!job) {
    req.session.flash = { type: 'error', message: 'Job posting not found.' };
    return res.redirect('/recruiter/jobs');
  }

  const { status, application_ids } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    req.session.flash = { type: 'error', message: 'Invalid status.' };
    return res.redirect(`/recruiter/jobs/${job.id}`);
  }

  const ids = Array.isArray(application_ids) ? application_ids : [application_ids].filter(Boolean);
  if (ids.length === 0) {
    req.session.flash = { type: 'error', message: 'Select at least one applicant.' };
    return res.redirect(`/recruiter/jobs/${job.id}`);
  }

  const update = db.prepare(
    `UPDATE applications SET status = ?, updated_at = datetime('now') WHERE id = ? AND job_id = ?`
  );
  const transaction = db.transaction((applicationIds) => {
    applicationIds.forEach((id) => update.run(status, id, job.id));
  });
  transaction(ids);

  req.session.flash = {
    type: 'success',
    message: `Updated ${ids.length} applicant${ids.length > 1 ? 's' : ''} to "${status.replace('_', ' ')}".`,
  };
  res.redirect(`/recruiter/jobs/${job.id}`);
});

module.exports = router;
