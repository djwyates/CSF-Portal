const Tutor = require("../models/tutor"),
      Tutee = require("../models/tutee");

var auth = {};

auth.hasTutorAccess = function(req, res, next) {
  if (!req.isAuthenticated()) {
    req.flash("info", "You must be logged in to do that.");
    res.redirect("back");
  } else {
    Tutor.findById(req.params.id).populate("tuteeSessions.tuteeID").exec(function(err, tutor) {
      if (err || !tutor) {
        req.flash("error", "That tutor does not exist.");
        res.redirect("back");
      } else if (req.user.id == tutor.id || req.user.accessLevel >= 2 || req.user.email == tutor.email) {
        res.locals.tutor = tutor;
        next();
      } else {
        req.flash("error", "You do not have permission to do that.");
        res.redirect("back");
      }
    });
  }
}

auth.hasTuteeAccess = function(req, res, next) {
  if (!req.isAuthenticated()) {
    req.flash("info", "You must be logged in to do that.");
    res.redirect("back");
  } else {
    Tutee.findById(req.params.id).populate("tutorSessions.tutorID").exec(function(err, tutee) {
      if (err || !tutee) {
        req.flash("error", "That tutee does not exist.");
        res.redirect("back");
      } else if (req.user.id == tutee.id || req.user.accessLevel >= 2 || req.user.email == tutee.email || req.user.email == tutee.parentEmail) {
        res.locals.tutee = tutee;
        next();
      } else {
        req.flash("error", "You do not have permission to do that.");
        res.redirect("back");
      }
    });
  }
}

auth.hasAccessLevel = function(accessLevel) {
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

module.exports = auth;
