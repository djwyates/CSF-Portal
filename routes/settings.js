const express = require("express"),
      router = express.Router(),
      fs = require("fs"),
      dirTree = require("directory-tree"),
      middleware = require("../middleware/index"),
      backup = require("../services/backup"),
      utils = require("../services/utils"),
      xlsx = require("../services/xlsx"),
      Meeting = require("../models/meeting"),
      Member = require("../models/member"),
      Tutor = require("../models/tutor"),
      Tutee = require("../models/tutee");

router.get("/", middleware.hasAccessLevel(3), function(req, res) {
  res.render("settings/index");
});

router.get("/permissions", middleware.hasAccessLevel(3), function(req, res) {
  Member.find({accessLevel: {$gte: 1}}, function(err, members) {
    if (err) {
      console.error(err);
    } else {
      res.render("settings/permissions", {members: members});
    }
  });
});

router.get("/term-migration", middleware.hasAccessLevel(3), function(req, res) {
  res.render("settings/term-migration");
});

router.put("/term-migration", middleware.hasAccessLevel(3), function(req, res) {
  /* backs up the current database */
  var currentDate = new Date().toISOString().slice(0,10);
  backup.mongooseModel("./backups/term-migration/" + currentDate + "/meetings.txt", Meeting);
  backup.mongooseModel("./backups/term-migration/" + currentDate + "/members.txt", Member);
  backup.mongooseModel("./backups/term-migration/" + currentDate + "/membersQualifying.txt", Member, function(members) {
    return members.filter(function(member) { member.meetingsAttended.length >= req.body.minMeetings; });
  });
  backup.mongooseModel("./backups/term-migration/" + currentDate + "/tutors.txt", Tutor);
  backup.mongooseModel("./backups/term-migration/" + currentDate + "/tutees.txt", Tutee);
  /* deletes the current database (besides members if a file is uploaded) */
  Meeting.deleteMany({}, function(err, deleteResult){ console.info("Deleted all meetings from the database: " + JSON.stringify(deleteResult)); });
  Tutor.deleteMany({}, function(err, deleteResult){ console.info("Deleted all tutors from the database: " + JSON.stringify(deleteResult)); });
  Tutee.deleteMany({}, function(err, deleteResult){ console.info("Deleted all tutees from the database: " + JSON.stringify(deleteResult)); });
  if (!req.files) {
    Member.deleteMany({}, function(err, deleteResult){ console.info("Deleted all members from the database: " + JSON.stringify(deleteResult)); });
    req.flash("success", "Successfully backed up and deleted all meetings, members, tutors, and tutees. No new members were uploaded into the database.");
    return res.redirect("/");
  }
  /* parses the uploaded file; if it is empty or not in the correct format, the process will be terminated & previous members will not be deleted */
  req.files.newMembers.mv(req.files.newMembers.name, function() {
    var parsedMembers = xlsx.parseMembers(req.files.newMembers.name);
    fs.unlink(req.files.newMembers.name, function(err){});
    if (!parsedMembers.members) {
      req.flash("error", "Backed up and deleted all meetings, tutors, and tutees. Something went wrong with the uploaded member file, so members were not deleted. Review the file and try again.");
      return res.redirect("/settings/term-migration");
    }
    /* formulates a message if any members of the uploaded file could not be parsed */
    var warningMsg = "";
    if (parsedMembers.warnings.length > 0)
      warningMsg += " WARNING: The member(s) in row(s) " + utils.arrayToSentence(parsedMembers.warnings) + " of the uploaded Excel sheet is invalid and was not added.";
    /* finds previous members who were officers, then deletes all previous members & creates new ones who were successfully parsed from the uploaded file */
    Member.find({accessLevel: {$gte: 1}}, function(err, previousOfficers) {
      Member.deleteMany({}, function(err, deleteResult) {
        console.info("Deleted all members from the database: " + JSON.stringify(deleteResult));
        Member.create(parsedMembers.members, function(err, newMembers) {
          /* conserves permissions of previous officers if found in the collection of new members */
          if (!previousOfficers) {
            warningMsg += "<br>NOTICE: Since no officers existed in the previous database, no permissions were conserved. Make sure to grant permissions!";
          } else {
            var previousOfficersNotPreserved = [];
            previousOfficers.forEach(function(previousOfficer) {
              var matchingNewMember = newMembers.find(function(newMember) { return newMember.id == previousOfficer.id });
              if (matchingNewMember) {
                Member.findByIdAndUpdate(matchingNewMember._id, {accessLevel: previousOfficer.accessLevel}, function(err, updatedMember){});
                console.info(matchingNewMember.name + "\'s (" + matchingNewMember.id + ") access level of " + previousOfficer.accessLevel + " has been conserved.");
              } else {
                console.warn(previousOfficer.name + "\'s (" + previousOfficer.id + ") access level of " + previousOfficer.accessLevel + " was NOT conserved.");
                previousOfficersNotPreserved.push(previousOfficer.name + "\'s (" + previousOfficer.id + ") access level of " + previousOfficer.accessLevel);
              }
            });
            /* formulates a message about the officers who did or did not conserve permissions */
            if (previousOfficersNotPreserved.length > 0)
              warningMsg += "<br>WARNING: " + utils.arrayToSentence(previousOfficersNotPreserved) + " was NOT conserved.";
            else
              warningMsg += "<br>All previous officers\' permissions were conserved.";
          }
          /* term migration is successful; this redirects the user & displays the term migration report via a flash message */
          req.flash("info", "Backed up and deleted all meetings, members, tutors, and tutees.<br>" + newMembers.length + " new members have been loaded into the database." + warningMsg);
          res.redirect("/settings/permissions");
        });
      });
    });
  });
});

router.get("/backups", middleware.hasAccessLevel(3), function(req, res) {
  res.render("settings/backups", {backupsDirTree: dirTree("./backups", {extensions: /\.txt/}), backupsData: backup.getBackupsData()});
});

router.put("/backups", middleware.hasAccessLevel(3), function(req, res) {
  if (req.body.id) {
    Member.findOne({id: req.body.id}, function(err, member) {
      if (member) {
        backup.object("./backups/replaced/members/" + member.id + ".txt", member.toObject());
        Member.findByIdAndUpdate(member._id, req.body, function(err, updatedMember) {
          req.flash("info", "The selected backup was successfully restored. Since a member with the same ID already existed, it was backed up and replaced. ID: " + req.body.id);
          res.redirect("/settings/backups");
        });
      } else {
        Member.create([req.body], function(err, newMember) {
          req.flash("info", "The selected backup was successfully restored. ID: " + req.body.id);
          res.redirect("/settings/backups");
        });
      }
    });
  } else if (req.body.date) {
    Meeting.findOne({date: req.body.date}, function(err, meeting) {
      if (meeting) {
        backup.object("./backups/replaced/meetings/" + meeting.date + ".txt", meeting.toObject());
        Member.findByIdAndUpdate(meeting._id, req.body, function(err, updatedMeeting) {
          req.flash("info", "The selected backup was successfully restored. Since a meeting with the same date already existed, it was backed up and replaced. Meeting Date: " + req.body.date);
          res.redirect("/settings/backups");
        });
      } else {
        Meeting.create([req.body], function(err, newMeeting) {
          req.flash("info", "The selected backup was successfully restored. Meeting Date: " + req.body.date);
          res.redirect("/settings/backups");
        });
      }
    });
  } else if (req.body.data) {
    req.body.data = JSON.parse(req.body.data);
    if (!req.body.data[0]) {
      req.flash("error", "You cannot restore from an empty backup.");
      res.redirect("/settings/backups");
    } else if (req.body.data[0].date) {
      backup.mongooseModel("./backups/replaced/meetings/meetings.txt", Meeting);
      Meeting.create(req.body.data, function(err, newMeetings) {
        req.flash("info", "The selected backup was successfully restored and all previous meetings were backed up. Number of Restored Meetings: " + req.body.data.length);
        res.redirect("/settings/backups");
      });
    } else if (req.body.data[0].parentEmail) {
      backup.mongooseModel("./backups/replaced/tutees/tutees.txt", Tutee);
      Tutee.create(req.body.data, function(err, newTutees) {
        req.flash("info", "The selected backup was successfully restored and all previous tutees were backed up. Number of Restored Tutees: " + req.body.data.length);
        res.redirect("/settings/backups");
      });
    } else if (req.body.data[0].email) {
      backup.mongooseModel("./backups/replaced/tutors/tutors.txt", Tutor);
      Tutor.create(req.body.data, function(err, newTutors) {
        req.flash("info", "The selected backup was successfully restored and all previous tutors were backed up. Number of Restored Tutors: " + req.body.data.length);
        res.redirect("/settings/backups");
      });
    } else if (req.body.data[0].id) {
      backup.mongooseModel("./backups/replaced/members/members.txt", Member);
      Member.create(req.body.data, function(err, newMembers) {
        req.flash("info", "The selected backup was successfully restored and all previous members were backed up. Number of Restored Members: " + req.body.data.length);
        res.redirect("/settings/backups");
      });
    }
  } else {
    req.flash("error", "An unexpected error occurred.");
    res.redirect("/settings/backups");
  }
});

router.delete("/backups", middleware.hasAccessLevel(3), function(req, res) {
  fs.unlink(req.body.path, function(err) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
    } else {
      req.flash("success", "The selected backup was successfully deleted.");
    }
    res.redirect("/settings/backups");
  });
});

module.exports = router;
