function requireAuth(req, res, next) {
  if (!req.session.user) {
    req.session.flash = { type: 'error', message: 'Please log in to continue.' };
    return res.redirect('/login');
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      req.session.flash = { type: 'error', message: 'Please log in to continue.' };
      return res.redirect('/login');
    }
    if (!roles.includes(req.session.user.role)) {
      req.session.flash = { type: 'error', message: 'You do not have access to that page.' };
      return res.redirect('/');
    }
    next();
  };
}

function redirectIfAuthed(req, res, next) {
  if (req.session.user) {
    return res.redirect(`/${req.session.user.role}/dashboard`);
  }
  next();
}

module.exports = { requireAuth, requireRole, redirectIfAuthed };
