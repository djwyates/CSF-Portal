const express = require("express"),
      router = express.Router(),
      passport = require("passport"),
      Meeting = require("../models/meeting"),
      Member = require("../models/member"),
      Tutor = require("../models/tutor"),
      Tutee = require("../models/tutee");

router.get("/", function(req, res) {
  res.redirect("/members/attendance"); /* no home page as of now */
});

router.get("/login/google", passport.authenticate("google", {scope: ["email"]}));

router.get("/login/google/callback", passport.authenticate("google"), function(req, res) {
  req.flash("success", "You have successfully logged in.");
  res.redirect("/members/attendance");
});

router.get("/logout", function(req, res) {
  req.logout();
  req.flash("success", "You have been logged out.");
  res.redirect("/members/attendance");
});

router.get("/search", function(req, res) {
  var queryRegExp = new RegExp(req.query.q.trim(), "i"), result = [];
  Meeting.find(queryRegExp.test("meetings") ? {} : {$or: [{date: queryRegExp}, {description: queryRegExp}]}, function(err, meetings) {
    meetings.forEach(function(meeting) {
      result.push({type: "Meeting", date: meeting.date, description: meeting.description ? meeting.description : "No meeting description", href: "/meetings/" + meeting._id});
    });
    if (!req.user || req.user.accessLevel <= 0) {
      Member.findOne({id: req.query.q.trim()}, function(err, member) {
        if (member)
          result.unshift({type: "Attendance", id: member.id, meetingsAttendedCount: member.meetingsAttended.length, href: "/members/attendance?id=" + member.id});
        res.json(result);
      });
    } else if (req.user.accessLevel >= 1) {
      Member.find(queryRegExp.test("members") ? {} : {$or: [{name: queryRegExp}, {id: queryRegExp}]}, function(err, members) {
        members.forEach(function(member) {
          result.push({type: "Member", id: member.id, name: member.name, href: "/members/" + member._id});
        });
        if (req.user.accessLevel >= 2) {
          Tutor.find(queryRegExp.test("tutors") ? {} : {$or: [{name: queryRegExp}, {id: queryRegExp}]}, function(err, tutors) {
            tutors.forEach(function(tutor) {
              result.push({type: "Tutor", id: tutor.id, name: tutor.name, href: "/tutors/" + tutor._id + "?from=%2Ftutors"});
            });
            Tutee.find(queryRegExp.test("tutees") ? {} : {$or: [{name: queryRegExp}, {id: queryRegExp}]}, function(err, tutees) {
              tutees.forEach(function(tutee) {
                result.push({type: "Tutee", id: tutee.id, name: tutee.name, href: "/tutees/" + tutee._id + "?from=%2Ftutees"});
              });
              res.json(result);
            });
          });
        } else {
          res.json(result);
        }
      });
    }
  });
});

router.get("*", function(req, res) {
  res.render("404");
});

module.exports = router;
