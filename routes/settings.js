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
  res.render("settings/backups", {backupsDirTree: dirTree("./backups", {extensions: /\.txt/})});
});

module.exports = router;
