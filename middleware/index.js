var middleware = {};

middleware.isLoggedIn = function(req, res, next) {
  if (req.isAuthenticated()) {
    next();
  } else {
    req.flash("error", "You must be logged in to do that.");
    res.redirect("back");
  }
}

middleware.hasAccessLevel = function(accessLevel) {
  return function(req, res, next) {
    if (!req.isAuthenticated() || req.user.accessLevel < accessLevel) {
      req.flash("error", "You do not have permission to do that.");
      res.redirect("back");
    } else {
      next();
    }
  }
}

module.exports = middleware;
