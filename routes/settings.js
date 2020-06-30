const express = require("express"),
      router = express.Router(),
      fs = require("fs"),
      middleware = require("../middleware/index"),
      backup = require("../services/backup"),
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
  var currentDate = new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"}).slice(0,9).replace(/\//g, "-");
  backup.mongooseModel("./backups/term-migration/" + currentDate + "/meetings.txt", Meeting);
  backup.mongooseModel("./backups/term-migration/" + currentDate + "/members.txt", Member);
  backup.mongooseModel("./backups/term-migration/" + currentDate + "/membersQualifying.txt", Member, function(members) {
    var qualifyingMembers = [];
    members.forEach(function(member) {
      if (member.meetingsAttended.length >= req.body.minMeetings)
        qualifyingMembers.push(member);
    });
    return qualifyingMembers;
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
    if (parsedMembers.warnings.length == 1) {
      warningMsg += "<br>The member in row " + parsedMembers.warnings[0] + " of the uploaded Excel sheet is invalid.";
    } else if (parsedMembers.warnings.length == 2) {
      warningMsg += "<br>The members in rows " + parsedMembers.warnings[0] + " and " + parsedMembers.warnings[1] + " of the uploaded Excel sheet are invalid.";
    } else if (parsedMembers.warnings.length >= 3) {
      warningMsg += "<br>The members in rows ";
      for (var i=0; i<parsedMembers.warnings.length-1; i++)
        warningMsg += parsedMembers.warnings[i] + ", ";
      warningMsg += "and " + parsedMembers.warnings[parsedMembers.warnings.length-1] + " of the uploaded Excel sheet are invalid.";
    }
    /* finds previous members who were officers, then deletes all previous members & creates new ones who were successfully parsed from the uploaded file */
    Member.find({accessLevel: {$gte: 1}}, function(err, previousOfficers) {
      Member.deleteMany({}, function(err, deleteResult) {
        console.info("Deleted all members from the database: " + JSON.stringify(deleteResult));
        Member.create(parsedMembers.members, function(err, newMembers) {
          /* conserves permissions of previous officers if found in the collection of new members */
          if (!previousOfficers) {
            warningMsg += "<br>Since no officers existed in the previous database, no permissions were conserved. Make sure to grant permissions!";
          } else {
            var previousOfficersNotPreserved = [];
            previousOfficers.forEach(function(previousOfficer) {
              var matchingNewMember = newMembers.find(function(newMember) { return newMember.id == previousOfficer.id });
              if (matchingNewMember) {
                Member.findByIdAndUpdate(matchingNewMember._id, {accessLevel: previousOfficer.accessLevel}, function(err, updatedMember){});
                console.info(matchingNewMember.name + "\'s (" + matchingNewMember.id + ") access level of " + previousOfficer.accessLevel + " has been conserved.");
              } else {
                console.warn(previousOfficer.name + "\'s (" + previousOfficer.id + ") access level of " + previousOfficer.accessLevel + " was NOT conserved.");
                previousOfficersNotPreserved.push(previousOfficer.name);
              }
            });
            /* formulates a message about the officers who did or did not conserve permissions */
            if (previousOfficersNotPreserved.length == 0) {
              warningMsg += "<br>All previous officers\' permissions were conserved.";
            } else if (previousOfficersNotPreserved.length == previousOfficers.length) {
              warningMsg += "<br>None of the previous officers\' permissions were conserved. Make sure to grant permissions!";
            } else if (previousOfficersNotPreserved.length >= 1) {
              warningMsg += "<br>Only some of the previous officers\' permissions were conserved. Make sure to grant permissions! Not preserved: " + previousOfficersNotPreserved[0];
              if (previousOfficersNotPreserved.length == 2) {
                warningMsg += " and " + previousOfficersNotPreserved[1];
              } else if (previousOfficersNotPreserved.length >= 3) {
                warningMsg += "<br>WARNING: The members in rows ";
                for (var i=1; i<previousOfficersNotPreserved.length-1; i++)
                  warningMsg += ", " + previousOfficersNotPreserved[i];
                warningMsg += ", and " + previousOfficersNotPreserved[previousOfficersNotPreserved.length-1];
              }
            }
          }
          /* term migration is successful; this redirects the user & displays the term migration report via a flash message */
          req.flash("info", "Backed up and deleted all meetings, members, tutors, and tutees. " + newMembers.length + " new members have been loaded into the database." + warningMsg);
          res.redirect("/settings/permissions");
        });
      });
    });
  });
});

router.get("/restore-from-backup", middleware.hasAccessLevel(3), function(req, res) {
  // TODO: pass in info obtained from the backup folder. if there's no backup folder do what should be done.
  res.render("settings/restore-from-backup");
});

module.exports = router;
