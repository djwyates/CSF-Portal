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
              var matchingNewMember = newMembers.find(newMember => newMember.id == previousOfficer.id);
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

router.delete("/backups", middleware.hasAccessLevel(3), function(req, res) {
  fs.unlink(req.body.path, function(err) {
    if (err) {
      console.error(err);
      req.flash("error", "An unexpected error occurred.");
    } else
      req.flash("success", "The selected backup was successfully deleted.");
    res.redirect("/settings/backups");
  });
});

router.get("/diagnostics", middleware.hasAccessLevel(3), function(req, res) {
  res.render("settings/diagnostics");
});

router.get("/diagnostics/run-test", middleware.hasAccessLevel(3), function(req, res) {
  var result = "", matched = false, foundTutee = null, foundTutor = null, course = null;
  Meeting.find({}, function(err, meetings) {
    Member.find({}, function(err, members) {
      meetings.forEach(function(meeting) {
        /* checks for duplicate attendance records */
        var dupeRecords = utils.findDuplicatesInArray(meeting.membersAttended);
        if (dupeRecords.length > 0) {
          result += "The <a class='link--white' href='/meetings/" + meeting._id + "?from=%2Fsettings%2Fdiagnostics'>meeting on " + utils.reformatDate(meeting.date)
          + "</a> has duplicate attendance records of members " + utils.arrayToSentence(dupeRecords) + ".<br>";
        }
        /* checks meetings' and members' attendance records to detect discrepancies */
        meeting.membersAttended.forEach(function(memberID) {
          member = members.find(member => member.id == memberID);
          if (!member) {
            result += "One member who attended the <a class='link--white' href='/meetings/" + meeting._id + "?from=%2Fsettings%2Fdiagnostics'>meeting on " + utils.reformatDate(meeting.date)
            + "</a> with ID " + memberID + " does not exist.<br>";
          } else if (!member.meetingsAttended.includes(meeting.date))
            result += "The <a class='link--white' href='/meetings/" + meeting._id + "?from=%2Fsettings%2Fdiagnostics'>meeting on " + utils.reformatDate(meeting.date)
            + "</a> shows that <a class='link--white' href='/members/" + member._id + "?from=%2Fsettings%2Fdiagnostics'>member " + memberID + "</a> attended while the member\'s attendance records do not show this.<br>";
        });
      });
      members.forEach(function(member) {
        /* checks for duplicate attendance records */
        dupeRecords = utils.findDuplicatesInArray(member.meetingsAttended);
        if (dupeRecords.length > 0) {
          result += "The <a class='link--white' href='/members/" + member._id + "?from=%2Fsettings%2Fdiagnostics'>member " + member.id + "</a> has duplicate attendance records of meetings on "
          + utils.arrayToSentence(dupeRecords.map(record => utils.reformatDate(record))) + ".<br>";
        }
        /* checks members' and meetings' attendance records to detect discrepancies */
        member.meetingsAttended.forEach(function(meetingDate) {
          meeting = meetings.find(meeting => meeting.date == meetingDate);
          if (!meeting) {
            result += "Attendance records of <a class='link--white' href='/members/" + member._id + "?from=%2Fsettings%2Fdiagnostics'>Member " + member.id
            + "</a> indicate them attending a meeting on date " + utils.reformatDate(meetingDate) + " that does not exist.<br>";
          } else if (!meeting.membersAttended.includes(member.id))
            result += "Attendance records of <a class='link--white' href='/members/" + member._id + "?from=%2Fsettings%2Fdiagnostics'>Member " + member.id + "</a> show that they attended the <a class='link--white' href='/meetings/"
            + meeting._id + "?from=%2Fsettings%2Fdiagnostics'>meeting on " + utils.reformatDate(meeting.date) + "</a> while the meeting\'s do not show this.<br>";
        });
      });
      Tutor.find({}, function(err, tutors) {
        Tutee.find({}, function(err, tutees) {
          tutors.forEach(function(tutor) {
            /* checks if tutors and their tutees are in pairs */
            tutor.tuteeSessions.forEach(function(tuteeSession) {
              foundTutee = tutees.find(tutee => tutee._id == tuteeSession.tuteeID);
              if (!foundTutee) {
                result += "Records of <a class='link--white' href='/tutors/" + tutor._id + "?from=%2Fsettings%2Fdiagnostics'>Tutor " + tutor._id + "</a> indicate them tutoring Tutee "
                + tuteeSession.tuteeID + " while that tutee does not exist.<br>";
              } else {
                foundTutee.tutorSessions.forEach(function(tutorSession) {
                  if (tuteeSession.courses.includes(tutorSession.course) && tutorSession.tutorID == tutor._id)
                    matched = true;
                  else
                    course = tutorSession.course;
                });
                if (!matched)
                  result += "Records of <a class='link--white' href='/tutors/" + tutor._id + "?from=%2Fsettings%2Fdiagnostics'>Tutor " + tutor._id + "</a> indicate them tutoring <a class='link--white' href='/tutees/"
                  + tuteeSession.tuteeID + "?from=%2Fsettings%2Fdiagnostics'>Tutee " + tuteeSession.tuteeID + "</a> for course " + course + " while the tutee\'s records do not.<br>";
                matched = false;
              }
            });
          });
          /* checks if tutees and their tutors are in pairs */
          tutees.forEach(function(tutee) {
            tutee.tutorSessions.forEach(function(tutorSession) {
              if (tutorSession.tutorID == null)
                return;
              foundTutor = tutors.find(tutor => tutor._id == tutorSession.tutorID);
              if (!foundTutor) {
                result += "Records of <a class='link--white' href='/tutees/" + tutee._id + "?from=%2Fsettings%2Fdiagnostics'>Tutee " + tutee._id + "</a> indicate them being tutored by Tutor "
                + tutorSession.tutorID + " while that tutor does not exist.<br>";
              } else {
                foundTutor.tuteeSessions.forEach(function(tuteeSession) {
                  if (tuteeSession.tuteeID = tutee._id && tuteeSession.courses.includes(tutorSession.course))
                    matched = true;
                });
                if (!matched)
                  result += "Records of <a class='link--white' href='/tutees/" + tutee._id + "'>Tutee " + tutee._id + "</a> indicate them being tutored by <a class='link--white' href='/tutors/"
                  + tutorSession.tutorID + "'>Tutor " + tutorSession.tutorID + "</a> for course " + tutorSession.course + " while the tutor\'s records do not.<br>";
                matched = false;
              }
            });
          });
          req.flash("info", result ? result.substring(0, result.length-4) : "No discrepancies were found in the database.");
          res.redirect("/settings/diagnostics");
        });
      });
    });
  });
});

module.exports = router;
