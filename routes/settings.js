const express = require("express"),
      router = express.Router(),
      fs = require("fs"),
      dirTree = require("directory-tree"),
      auth = require("../middleware/auth"),
      backup = require("../services/backup"),
      utils = require("../services/utils"),
      xlsx = require("../services/xlsx"),
      Meeting = require("../models/meeting"),
      Member = require("../models/member"),
      Tutor = require("../models/tutor"),
      Tutee = require("../models/tutee");

router.get("/", auth.hasAccessLevel(3), function(req, res) {
  res.render("settings/index");
});

router.get("/permissions", auth.hasAccessLevel(3), function(req, res) {
  Member.find({accessLevel: {$gte: 1}}, function(err, members) {
    if (err) console.error(err);
    else res.render("settings/permissions", {members: members});
  });
});

router.get("/term-migration", auth.hasAccessLevel(3), function(req, res) {
  res.render("settings/term-migration");
});

router.put("/term-migration", auth.hasAccessLevel(3), function(req, res) {
  /* backs up the current database */
  var currentDate = new Date().toISOString().slice(0,10);
  backup.mongooseModel("./backups/term-migration/" + currentDate + "/meetings.txt", Meeting);
  backup.mongooseModel("./backups/term-migration/" + currentDate + "/members.txt", Member);
  backup.mongooseModel("./backups/term-migration/" + currentDate + "/membersQualifying.txt", Member, function(members) {
    return members.filter(member => member.meetingsAttended.length >= req.body.minMeetings);
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
      warningMsg += " WARNING: The members in rows " + utils.arrayToSentence(parsedMembers.warnings) + " of the uploaded Excel sheet are invalid and were not added.";
    /* finds previous members who were officers, then deletes all previous members & creates new ones who were successfully parsed from the uploaded file */
    Member.find({accessLevel: {$gte: 1}}, function(err, previousOfficers) {
      Member.deleteMany({id: {$ne: req.user.id}}, function(err, deleteResult) {
        console.info("Deleted all members from the database: " + JSON.stringify(deleteResult));
        /* if the current user is a new member, they will be not deleted & will be updated separately so term migration does not log them out */
        var newMemberOfUser = parsedMembers.members.find(member => member.id == req.user.id);
        if (parsedMembers.members.indexOf(newMemberOfUser) >= 0) {
          parsedMembers.members.splice(parsedMembers.members.indexOf(newMemberOfUser), 1);
          Member.findOneAndUpdate({id: req.user.id}, newMemberOfUser).exec();
        } else
          Member.deleteOne({id: req.user.id}).exec();
        Member.create(parsedMembers.members, function(err, newMembers) {
          /* conserves permissions of previous officers if found in the collection of new members */
          if (!previousOfficers) {
            warningMsg += "<br>NOTICE: Since no officers existed in the previous database, no permissions were conserved. Make sure to grant permissions!";
          } else {
            var previousOfficersNotPreserved = [];
            previousOfficers.forEach(function(previousOfficer) {
              var matchingNewMember = newMembers.find(newMember => newMember.id == previousOfficer.id);
              if (matchingNewMember) {
                Member.findByIdAndUpdate(matchingNewMember._id, {accessLevel: previousOfficer.accessLevel}, function(err, updatedMember){});
                console.info(matchingNewMember.name + "\'s (" + matchingNewMember.id + ") access level of " + previousOfficer.accessLevel + " has been conserved.");
              } else if (req.user.id == previousOfficer.id) {
                console.info(previousOfficer.name + "\'s (" + previousOfficer.id + ") access level of " + previousOfficer.accessLevel + " has been conserved.");
              } else {
                console.warn(previousOfficer.name + "\'s (" + previousOfficer.id + ") access level of " + previousOfficer.accessLevel + " was NOT conserved.");
                previousOfficersNotPreserved.push(previousOfficer.name + "\'s (" + previousOfficer.id + ") access level of " + previousOfficer.accessLevel);
              }
            });
            /* formulates a message about the officers who did or did not conserve permissions */
            if (previousOfficersNotPreserved.length > 0) warningMsg += "<br>WARNING: " + utils.arrayToSentence(previousOfficersNotPreserved) + " was NOT conserved.";
            else warningMsg += "<br>All previous officers\' permissions were conserved.";
          }
          /* term migration is successful; this redirects the user & displays the term migration report via a flash message */
          var totalNewMembers = (newMembers ? newMembers.length : 0) + (newMemberOfUser ? 1 : 0);
          req.flash("info", "Backed up and deleted all meetings, members, tutors, and tutees.<br>" + totalNewMembers + " new members have been loaded into the database." + warningMsg);
          res.redirect("/settings/permissions");
        });
      });
    });
  });
});

router.get("/backups", auth.hasAccessLevel(3), function(req, res) {
  res.render("settings/backups", {backupsDirTree: dirTree("./backups", {extensions: /\.txt/}), backupsData: backup.getBackupsData()});
});

router.put("/backups", auth.hasAccessLevel(3), function(req, res) {
  if (req.body.data) req.body.data = JSON.parse(req.body.data);
  var warningMsg = "";
  /* if the backup is a single meeting */
  if (req.body.date) {
    if (req.body.membersAttended.length == 0) req.body.membersAttended = [];
    else req.body.membersAttended = req.body.membersAttended.split(",");
    Meeting.create([req.body], function(err, newMeeting) {
      if (newMeeting) {
        newMeeting[0].membersAttended.forEach(function(memberID) {
          Member.updateOne({id: memberID}, {$addToSet: {"meetingsAttended": newMeeting[0].date}}, function(err, updateResult) {
            if (updateResult.n == 0) {
              warningMsg += "<br>WARNING: The attendance records of the restored meeting contains a member with ID " + memberID + " that does not exist.";
              console.warn("WARNING: The attendance records of the meeting on " + utils.reformatDate(newMeeting[0].date) + " that was restored from backup contains a member with ID " + memberID + " that does not exist.");
            } if (newMeeting[0].membersAttended.indexOf(memberID) == newMeeting[0].membersAttended.length-1) {
              req.flash("success", "The selected backup was successfully restored." + warningMsg);
              res.redirect("/settings/backups");
            }
          });
        });
      } else {
        req.flash("error", "The selected backup was not restored because it would overwrite current data. Check for a meeting that exists with the same date.");
        res.redirect("/settings/backups");
      }
    });
  /* if the backup is a single member */
  } else if (req.body.id) {
    if (req.body.meetingsAttended.length == 0) req.body.meetingsAttended = [];
    else req.body.meetingsAttended = req.body.meetingsAttended.split(",");
    Member.create([req.body], function(err, newMember) {
      if (newMember) {
        newMember[0].meetingsAttended.forEach(function(meetingDate) {
          Meeting.updateOne({date: meetingDate}, {$addToSet: {"membersAttended": newMember[0].id}}, function(err, updateResult) {
            if (updateResult.n == 0) {
              warningMsg += "<br>WARNING: The attendance records of the restored member contains a meeting on " + utils.reformatDate(meetingDate) + " that does not exist.";
              console.warn("WARNING: The attendance records of the member with ID " + newMember[0].id + " that was restored from backup contains a meeting on " + utils.reformatDate(meetingDate) + " that does not exist.");
            } if (newMember[0].meetingsAttended.indexOf(meetingDate) == newMember[0].meetingsAttended.length-1) {
              req.flash("success", "The selected backup was successfully restored." + warningMsg);
              res.redirect("/settings/backups");
            }
          });
        });
      } else {
        req.flash("error", "The selected backup was not restored because it would overwrite current data. Check for a member that exists with the same ID.");
        res.redirect("/settings/backups");
      }
    });
  } else if (req.body.data && req.body.data[0]) {
    /* if the backup is an array of meetings */
    if (req.body.data[0].date) {
      backup.mongooseModel("./backups/replaced/meetings.txt", Meeting);
      Meeting.deleteMany({}, function(err, deleteResult) {
        Meeting.create(req.body.data, function(err, newMeetings) {
          if (err) {
            console.error(err);
            req.flash("error", "An unexpected error occurred.");
          } else
            req.flash("success", "The selected backup was successfully restored: All previous meetings were backed up and replaced.");
          res.redirect("/settings/backups");
        });
      });
    /* if the backup is an array of tutees */
    } else if (req.body.data[0].parentEmail) {
      backup.mongooseModel("./backups/replaced/tutees.txt", Tutee);
      Tutee.deleteMany({}, function(err, deleteResult) {
        Tutee.create(req.body.data, function(err, newTutees) {
          if (err) {
            console.error(err);
            req.flash("error", "An unexpected error occurred.");
          } else
            req.flash("success", "The selected backup was successfully restored: All previous tutees were backed up and replaced.");
          res.redirect("/settings/backups");
        });
      });
    /* if the backup is an array of tutors */
    } else if (req.body.data[0].email) {
      backup.mongooseModel("./backups/replaced/tutors.txt", Tutor);
      Tutor.deleteMany({}, function(err, deleteResult) {
        Tutor.create(req.body.data, function(err, newTutors) {
          if (err) {
            console.error(err);
            req.flash("error", "An unexpected error occurred.");
          } else
            req.flash("success", "The selected backup was successfully restored: All previous tutors were backed up and replaced.");
          res.redirect("/settings/backups");
        });
      });
    /* if the backup is an array of members */
    } else if (req.body.data[0].id) {
      backup.mongooseModel("./backups/replaced/members.txt", Member);
      Member.deleteMany({}, function(err, deleteResult) {
        Member.create(req.body.data, function(err, newMembers) {
          if (err) {
            console.error(err);
            req.flash("error", "An unexpected error occurred.");
          } else
            req.flash("success", "The selected backup was successfully restored: All previous members were backed up and replaced.");
          res.redirect("/settings/backups");
        });
      });
    }
  } else {
    req.flash("error", "You cannot restore from an empty backup.");
    res.redirect("/settings/backups");
  }
});

router.delete("/backups", auth.hasAccessLevel(3), function(req, res) {
  fs.unlink(req.body.path, function(err) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
    } else
      req.flash("success", "The selected backup was successfully deleted.");
    res.redirect("/settings/backups");
  });
});

router.get("/diagnostics", auth.hasAccessLevel(3), function(req, res) {
  res.render("settings/diagnostics");
});

router.get("/diagnostics/run-test", auth.hasAccessLevel(3), function(req, res) {
  Meeting.find({}, function(err, meetings) {
    Member.find({}, function(err, members) {
      Tutor.find({}, function(err, tutors) {
        Tutee.find({}, function(err, tutees) {
          var result = require("../services/diagnostics")(meetings, members, tutors, tutees);
          req.flash("info", result ? result.substring(0, result.length-4) : "No discrepancies were found in the database.");
          res.redirect("/settings/diagnostics");
        });
      });
    });
  });
});

module.exports = router;
