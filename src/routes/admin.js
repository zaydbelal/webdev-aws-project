const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireRole('admin'));

function logAction(adminUserId, action, targetType, targetId, details) {
  db.prepare(
    'INSERT INTO admin_logs (admin_user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)'
  ).run(adminUserId, action, targetType, targetId, details || '');
}

router.get('/dashboard', (req, res) => {
  const stats = {
    pendingCompanies: db.prepare(`SELECT COUNT(*) as c FROM companies WHERE status = 'pending'`).get().c,
    pendingJobs: db.prepare(`SELECT COUNT(*) as c FROM jobs WHERE status = 'pending'`).get().c,
    totalStudents: db.prepare(`SELECT COUNT(*) as c FROM users WHERE role = 'student'`).get().c,
    totalRecruiters: db.prepare(`SELECT COUNT(*) as c FROM users WHERE role = 'recruiter'`).get().c,
    totalCompanies: db.prepare(`SELECT COUNT(*) as c FROM companies`).get().c,
    totalJobs: db.prepare(`SELECT COUNT(*) as c FROM jobs`).get().c,
    totalApplications: db.prepare(`SELECT COUNT(*) as c FROM applications`).get().c,
  };

  const recentLogs = db
    .prepare(
      `SELECT l.*, u.name as admin_name FROM admin_logs l JOIN users u ON u.id = l.admin_user_id ORDER BY l.created_at DESC LIMIT 6`
    )
    .all();

  res.render('admin/dashboard', { title: 'Admin Dashboard', stats, recentLogs });
});

router.get('/companies', (req, res) => {
  const filter = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  const companies = db
    .prepare(
      `SELECT c.*, u.name as recruiter_name, u.email as recruiter_email,
         (SELECT COUNT(*) FROM jobs j WHERE j.company_id = c.id) as job_count
       FROM companies c JOIN users u ON u.id = c.recruiter_user_id
       WHERE c.status = ? ORDER BY c.created_at DESC`
    )
    .all(filter);

  res.render('admin/companies', { title: 'Companies', companies, filter });
});

router.post('/companies/:id/approve', (req, res) => {
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!company) return res.redirect('/admin/companies');

  db.prepare(`UPDATE companies SET status = 'approved' WHERE id = ?`).run(company.id);
  logAction(req.session.user.id, 'approved', 'company', company.id, `Approved company "${company.name}".`);
  req.session.flash = { type: 'success', message: `${company.name} approved.` };
  res.redirect('/admin/companies');
});

router.post('/companies/:id/reject', (req, res) => {
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
  if (!company) return res.redirect('/admin/companies');

  db.prepare(`UPDATE companies SET status = 'rejected' WHERE id = ?`).run(company.id);
  logAction(req.session.user.id, 'rejected', 'company', company.id, `Rejected company "${company.name}".`);
  req.session.flash = { type: 'success', message: `${company.name} rejected.` };
  res.redirect('/admin/companies');
});

router.get('/jobs', (req, res) => {
  const filter = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  const jobs = db
    .prepare(
      `SELECT j.*, c.name as company_name, c.status as company_status,
         (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) as applicant_count
       FROM jobs j JOIN companies c ON c.id = j.company_id
       WHERE j.status = ? ORDER BY j.created_at DESC`
    )
    .all(filter);

  res.render('admin/jobs', { title: 'Job Postings', jobs, filter });
});

router.post('/jobs/:id/approve', (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.redirect('/admin/jobs');

  db.prepare(`UPDATE jobs SET status = 'approved' WHERE id = ?`).run(job.id);
  logAction(req.session.user.id, 'approved', 'job', job.id, `Approved job posting "${job.title}".`);
  req.session.flash = { type: 'success', message: `${job.title} approved.` };
  res.redirect('/admin/jobs');
});

router.post('/jobs/:id/reject', (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.redirect('/admin/jobs');

  db.prepare(`UPDATE jobs SET status = 'rejected' WHERE id = ?`).run(job.id);
  logAction(req.session.user.id, 'rejected', 'job', job.id, `Rejected job posting "${job.title}".`);
  req.session.flash = { type: 'success', message: `${job.title} rejected.` };
  res.redirect('/admin/jobs');
});

router.get('/logs', (req, res) => {
  const logs = db
    .prepare(
      `SELECT l.*, u.name as admin_name, u.email as admin_email
       FROM admin_logs l JOIN users u ON u.id = l.admin_user_id
       ORDER BY l.created_at DESC`
    )
    .all();

  res.render('admin/logs', { title: 'Audit Log', logs });
});

module.exports = router;
