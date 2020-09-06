const Tutor = require("../models/tutor"),
      Tutee = require("../models/tutee");

var middleware = {};

middleware.hasTutorAccess = function(req, res, next) {
  if (!req.isAuthenticated()) {
    req.flash("info", "You must be logged in to do that.");
    res.redirect("back");
  } else {
    Tutor.findById(req.params.id).populate("tuteeSessions.tuteeID").exec(function(err, foundTutor) {
      if (err || !foundTutor) {
        req.flash("error", "That tutor does not exist.");
        res.redirect("back");
      } else if (req.user.id == foundTutor.id || req.user.accessLevel >= 2) {
        req.foundTutor = foundTutor;
        next();
      } else {
        req.flash("error", "You do not have permission to do that.");
        res.redirect("back");
      }
    });
  }
}

middleware.hasTuteeAccess = function(req, res, next) {
  if (!req.isAuthenticated()) {
    req.flash("info", "You must be logged in to do that.");
    res.redirect("back");
  } else {
    Tutee.findById(req.params.id).populate("tutorSessions.tutorID").exec(function(err, foundTutee) {
      if (err || !foundTutee) {
        req.flash("error", "That tutee does not exist.");
        res.redirect("back");
      } else if (req.user.id == foundTutee.id || req.user.accessLevel >= 2) {
        req.foundTutee = foundTutee;
        next();
      } else {
        req.flash("error", "You do not have permission to do that.");
        res.redirect("back");
      }
    });
  }
}

middleware.hasAccessLevel = function(accessLevel) {
  return function(req, res, next) {
    if (!req.isAuthenticated()) {
      req.flash("info", "You must be logged in to do that.");
      res.redirect("back");
    } else if (req.user.accessLevel < accessLevel) {
      req.flash("error", "You do not have permission to do that.");
      res.redirect("back");
    } else {
      next();
    }
  }
}

module.exports = middleware;
