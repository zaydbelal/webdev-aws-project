/**
 * Populates the database with mock data for all three roles.
 * Run with: npm run seed
 * Safe to re-run — wipes and re-inserts every table.
 */
const bcrypt = require('bcryptjs');
const db = require('./index');

const hash = (plain) => bcrypt.hashSync(plain, 10);

function seed() {
  db.exec(`
    DELETE FROM admin_logs;
    DELETE FROM applications;
    DELETE FROM jobs;
    DELETE FROM companies;
    DELETE FROM students;
    DELETE FROM users;
    DELETE FROM sqlite_sequence;
  `);

  const insertUser = db.prepare(
    `INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)`
  );
  const insertStudent = db.prepare(
    `INSERT INTO students (user_id, branch, cgpa, graduation_year, resume_link) VALUES (?, ?, ?, ?, ?)`
  );
  const insertCompany = db.prepare(
    `INSERT INTO companies (recruiter_user_id, name, website, description, status) VALUES (?, ?, ?, ?, ?)`
  );
  const insertJob = db.prepare(
    `INSERT INTO jobs (company_id, title, description, location, package_lpa, min_cgpa, allowed_branches, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertApplication = db.prepare(
    `INSERT INTO applications (job_id, student_user_id, status, applied_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))`
  );
  const insertLog = db.prepare(
    `INSERT INTO admin_logs (admin_user_id, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?)`
  );

  // --- Admin ---
  const adminId = insertUser.run('Placement Cell Admin', 'admin@portal.edu', hash('Admin@123'), 'admin').lastInsertRowid;

  // --- Recruiters ---
  const recruiter1Id = insertUser.run('Asha Rao', 'recruiter1@techcorp.com', hash('Recruiter@123'), 'recruiter').lastInsertRowid;
  const recruiter2Id = insertUser.run('Marco Diaz', 'recruiter2@newstartup.io', hash('Recruiter@123'), 'recruiter').lastInsertRowid;

  // --- Students ---
  const student1Id = insertUser.run('Priya Sharma', 'student1@college.edu', hash('Student@123'), 'student').lastInsertRowid;
  insertStudent.run(student1Id, 'CSE', 8.8, 2026, 'https://example.com/resumes/priya-sharma.pdf');

  const student2Id = insertUser.run('Rahul Verma', 'student2@college.edu', hash('Student@123'), 'student').lastInsertRowid;
  insertStudent.run(student2Id, 'ECE', 7.2, 2026, 'https://example.com/resumes/rahul-verma.pdf');

  const student3Id = insertUser.run('Sneha Iyer', 'student3@college.edu', hash('Student@123'), 'student').lastInsertRowid;
  insertStudent.run(student3Id, 'IT', 6.0, 2027, 'https://example.com/resumes/sneha-iyer.pdf');

  // --- Companies ---
  const techCorpId = insertCompany.run(
    recruiter1Id,
    'TechCorp Solutions',
    'https://techcorp.example.com',
    'Enterprise software and cloud platforms.',
    'approved'
  ).lastInsertRowid;

  const newStartupId = insertCompany.run(
    recruiter2Id,
    'NewStartup Inc',
    'https://newstartup.example.io',
    'Early-stage product studio hiring for its first intern cohort.',
    'pending'
  ).lastInsertRowid;

  // --- Jobs ---
  const swIntern = insertJob.run(
    techCorpId,
    'Software Engineer Intern',
    'Work on our core platform team building internal tooling and APIs.',
    'Bengaluru, India',
    '12 LPA',
    7.5,
    'CSE,IT',
    'approved'
  ).lastInsertRowid;

  const dataAnalyst = insertJob.run(
    techCorpId,
    'Data Analyst',
    'Analyze product usage data and build dashboards for leadership.',
    'Remote',
    '9 LPA',
    6.5,
    '',
    'approved'
  ).lastInsertRowid;

  insertJob.run(
    techCorpId,
    'Backend Engineering Intern',
    'Build and scale backend services in Node.js and Go.',
    'Hyderabad, India',
    '11 LPA',
    7.0,
    'CSE',
    'pending'
  );

  insertJob.run(
    newStartupId,
    'Frontend Developer Intern',
    'Ship UI features for our seed-stage consumer app.',
    'Remote',
    '7 LPA',
    6.0,
    '',
    'pending'
  );

  // --- Applications ---
  insertApplication.run(swIntern, student1Id, 'shortlisted');
  insertApplication.run(dataAnalyst, student2Id, 'applied');
  insertApplication.run(dataAnalyst, student1Id, 'under_review');

  // --- Admin logs ---
  insertLog.run(adminId, 'approved', 'company', techCorpId, 'Approved TechCorp Solutions after verifying registration details.');
  insertLog.run(adminId, 'approved', 'job', swIntern, 'Approved Software Engineer Intern posting.');
  insertLog.run(adminId, 'approved', 'job', dataAnalyst, 'Approved Data Analyst posting.');

  console.log('Database seeded successfully.\n');
  console.log('Mock login credentials:');
  console.log('  Admin:     admin@portal.edu / Admin@123');
  console.log('  Recruiter: recruiter1@techcorp.com / Recruiter@123  (approved company: TechCorp Solutions)');
  console.log('  Recruiter: recruiter2@newstartup.io / Recruiter@123  (pending company: NewStartup Inc)');
  console.log('  Student:   student1@college.edu / Student@123  (CSE, CGPA 8.8)');
  console.log('  Student:   student2@college.edu / Student@123  (ECE, CGPA 7.2)');
  console.log('  Student:   student3@college.edu / Student@123  (IT, CGPA 6.0 - below most eligibility bars)');
}

seed();
