const Meeting = require("../models/meeting"),
      Member = require("../models/member"),
      Tutor = require("../models/tutor"),
      Tutee = require("../models/tutee");

var search = {};

search.meeting = function(req, res, next) {
  if (!req.params.id) return next();
  Meeting.findById(req.params.id).populate("attendance").exec(function(err, meeting) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
      res.redirect("back");
    } else if (!meeting) {
      res.redirect("back");
    } else {
      res.locals.meeting = meeting;
      next();
    }
  });
}

search.member = function(req, res, next) {
  if (!req.params.id) return next();
  Member.findById(req.params.id).populate("attendance").exec(function(err, member) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
      res.redirect("back");
    } else if (!member) {
      res.redirect("back");
    } else {
      res.locals.member = member;
      next();
    }
  });
}

search.tutor = function(req, res, next) {
  if (!req.params.id) return next();
  Tutor.findById(req.params.id, function(err, tutor) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
      res.redirect("back");
    } else if (!tutor) {
      res.redirect("back");
    } else {
      res.locals.tutor = tutor;
      if (!req.params.tuteeID) return next();
      Tutee.findById(req.params.tuteeID, function(err, tutee) {
        if (err) {
          console.error(err);
          req.flash("error", "An unexpected error occurred.");
          res.redirect("back");
        } else if (!tutee) {
          res.redirect("back");
        } else {
          res.locals.tutee = tutee;
          next();
        }
      });
    }
  });
}

search.tutee = function(req, res, next) {
  if (!req.params.id) return next();
  Tutee.findById(req.params.id, function(err, tutee) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
      res.redirect("back");
    } else if (!tutee) {
      res.redirect("back");
    } else {
      res.locals.tutee = tutee;
      next();
    }
  });
}

module.exports = search;
