const fs = require("fs"),
      attendance = require("./attendance"),
      backup = require("./backup"),
      utils = require("./utils"),
      xlsx = require("./xlsx"),
      Meeting = require("../models/meeting"),
      Member = require("../models/member"),
      Tutor = require("../models/tutor"),
      Tutee = require("../models/tutee"),
      AttendanceRecord = require("../models/attendance-record");

module.exports = function(reqBody, newMembers, currentUserIfMember, zipName) {
  return new Promise(function(resolve, reject) {
    backupDatabase().then(function() {
      backup.createZipOfDatabase(zipName, reqBody.ext, reqBody.minMeetings).then(function() {
        deleteDatabase(reqBody.preserveOfficers, reqBody.preserveMeetings, newMembers ? true : false, reqBody.preserveTutors, reqBody.preserveTutees);
        if (!newMembers) return resolve("Successfully backed up and deleted the database. No new members were uploaded.");
        Member.find({accessLevel: {$gte: 1}}, function(err, previousOfficers) {
          parseFile(newMembers).then(function(parseResult) {
            if (!parseResult.members) return resolve("Backed up and deleted the database.<br>" + parseResult.flashMsg);
            Member.deleteMany({id: {$ne: currentUserIfMember ? currentUserIfMember.id : ""}}, function(err, deleteResult) {
              if (currentUserIfMember) updateCurrentUser(currentUserIfMember, parseResult.members);
              Member.create(parseResult.members, function(err, createdMembers) {
                if (reqBody.preserveTutors || reqBody.preserveTutees) updateTutorAndTuteeIDs(newMembers);
                resolve("Backed up and deleted the database.<br>" + ((createdMembers ? createdMembers.length : 0) + (currentUserIfMember ? 1 : 0))
                + " new members have been loaded into the database."
                + findPreservedOfficers(previousOfficers, parseResult.members, currentUserIfMember, reqBody.preserveOfficers) + parseResult.flashMsg);
              });
            });
          });
        });
      });
    });
  });
}

function backupDatabase() {
  return new Promise(function(resolve, reject) {
    var currentDate = utils.getCurrentDate("mm-dd-yyyy");
    Meeting.find({}).populate("attendance").lean().exec(function(err, meetings) {
      backup.create("meetings", "Meetings", "term-migration", meetings);
    });
    Member.find({}).populate("attendance").lean().exec(function(err, members) {
      backup.create("members", "Members", "term-migration", members);
    });
    Tutor.find({}, function(err, tutors) {
      backup.create("tutors", "Tutors", "term-migration", tutors);
    });
    Tutee.find({}, function(err, tutees) {
      backup.create("tutees", "Tutees", "term-migration", tutees);
    });
    resolve();
  });
}

function deleteDatabase(preserveOfficers, preserveMeetings, preserveMembers, preserveTutors, preserveTutees) {
  if (!preserveMeetings) Meeting.deleteMany({}).exec();
  if (!preserveMembers) Member.deleteMany({accessLevel: {$lte: preserveOfficers ? 0 : 3}}).exec();
  if (!preserveTutors) Tutor.deleteMany({}).exec();
  if (!preserveTutees) Tutee.deleteMany({}).exec();
  attendance.removeAll();
}

function parseFile(newMembers) {
  return new Promise(function(resolve, reject) {
    newMembers.mv(newMembers.name, function() {
      var parsedMembers = xlsx.parseMembers(newMembers.name), flashMsg = "";
      fs.unlink(newMembers.name, function(err){});
      if (!parsedMembers.members)
        flashMsg += "Something went wrong with the uploaded member file, so members were not deleted. Review the file and try again.";
      if (parsedMembers.warnings.length > 0)
        flashMsg += "<br>[!] The members in rows " + utils.arrayToSentence(parsedMembers.warnings)
        + " of the uploaded Excel sheet are invalid and were not added.";
      resolve({members: parsedMembers.members, flashMsg: flashMsg});
    });
  });
}

function updateCurrentUser(user, newMembers) {
  var matchingNewMember = newMembers.find(newMember => user.id == newMember.id);
  if (matchingNewMember)
    Member.findByIdAndUpdate(user._id, {name: matchingNewMember.name, grade: matchingNewMember.grade, termCount: matchingNewMember.termCount, attendance: []}).exec();
}

function findPreservedOfficers(previousOfficers, newMembers, currentUserIfMember, preserveOfficers) {
  var previousOfficersNotPreserved = [];
  previousOfficers.forEach(function(previousOfficer) {
    var matchingNewMember = newMembers.find(newMember => newMember.id == previousOfficer.id);
    if (matchingNewMember) {
      Member.findByIdAndUpdate(matchingNewMember._id, {accessLevel: previousOfficer.accessLevel}).exec();
      console.info(matchingNewMember.name + "\'s (" + matchingNewMember.id + ") access level of " + previousOfficer.accessLevel + " has been conserved.");
    } else if (currentUserIfMember && currentUserIfMember.id == previousOfficer.id) {
      console.info(previousOfficer.name + "\'s (" + previousOfficer.id + ") access level of " + previousOfficer.accessLevel + " has been conserved.");
    } else if (preserveOfficers) {
      var o = previousOfficer;
      Member.create({id: o.id, name: o.name, grade: o.grade, termCount: o.termCount, accessLevel: o.accessLevel});
    } else {
      console.warn(previousOfficer.name + "\'s (" + previousOfficer.id + ") access level of " + previousOfficer.accessLevel + " was NOT conserved.");
      previousOfficersNotPreserved.push(previousOfficer.name + "\'s (" + previousOfficer.id + ") access level of " + previousOfficer.accessLevel);
    }
  });
  if (preserveOfficers) return "<br>No officers were deleted.";
  else if (previousOfficersNotPreserved.length > 0) return "<br>[!] " + utils.arrayToSentence(previousOfficersNotPreserved) + " was NOT conserved.";
  else return "<br>All previous officers\' permissions were conserved.";
}

function updateTutorAndTuteeIDs() {
  Tutor.find({}, function(err, tutors) {
    Tutee.find({}, function(err, tutees) {
      tutors.forEach(function(tutor) {
        var matchingNewMember = newMembers.find(newMember => tutor.id == newMember.id);
        if (matchingNewMember) Member.findByIdAndUpdate(matchingNewMember._id, {tutorID: tutor._id}).exec();
      });
      tutees.forEach(function(tutee) {
        var matchingNewMember = newMembers.find(newMember => tutee.id == newMember.id);
        if (matchingNewMember) Member.findByIdAndUpdate(matchingNewMember._id, {tuteeID: tutee._id}).exec();
      });
    });
  });
}
