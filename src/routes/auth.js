const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { redirectIfAuthed } = require('../middleware/auth');

const router = express.Router();

router.get('/login', redirectIfAuthed, (req, res) => {
  res.render('auth/login', { title: 'Log In' });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').trim().toLowerCase());

  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    req.session.flash = { type: 'error', message: 'Invalid email or password.' };
    return res.redirect('/login');
  }

  req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.redirect(`/${user.role}/dashboard`);
});

router.get('/register', redirectIfAuthed, (req, res) => {
  res.render('auth/register', { title: 'Register', form: {} });
});

router.post('/register', (req, res) => {
  const { name, email, password, role, branch, cgpa, graduation_year, resume_link, company_name, company_website } = req.body;

  const cleanEmail = (email || '').trim().toLowerCase();
  const errors = [];

  if (!name || !name.trim()) errors.push('Name is required.');
  if (!cleanEmail) errors.push('Email is required.');
  if (!password || password.length < 6) errors.push('Password must be at least 6 characters.');
  if (!['student', 'recruiter'].includes(role)) errors.push('Choose a valid account type.');

  if (cleanEmail && db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail)) {
    errors.push('An account with that email already exists.');
  }

  if (errors.length) {
    req.session.flash = { type: 'error', message: errors.join(' ') };
    return res.render('auth/register', { title: 'Register', form: req.body });
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  const insertUser = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');

  const transaction = db.transaction(() => {
    const userId = insertUser.run(name.trim(), cleanEmail, passwordHash, role).lastInsertRowid;

    if (role === 'student') {
      db.prepare(
        'INSERT INTO students (user_id, branch, cgpa, graduation_year, resume_link) VALUES (?, ?, ?, ?, ?)'
      ).run(userId, (branch || '').trim(), parseFloat(cgpa) || 0, parseInt(graduation_year, 10) || 0, (resume_link || '').trim());
    } else if (role === 'recruiter' && company_name && company_name.trim()) {
      db.prepare(
        'INSERT INTO companies (recruiter_user_id, name, website, description, status) VALUES (?, ?, ?, ?, ?)'
      ).run(userId, company_name.trim(), (company_website || '').trim(), '', 'pending');
    }

    return userId;
  });

  const userId = transaction();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  req.session.flash = { type: 'success', message: 'Account created successfully.' };
  res.redirect(`/${user.role}/dashboard`);
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
