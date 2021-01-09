const fs = require("fs"),
      xlsx = require("./xlsx"),
      backup = require("./backup"),
      utils = require("./utils"),
      Meeting = require("../models/meeting"),
      Member = require("../models/member"),
      Tutor = require("../models/tutor"),
      Tutee = require("../models/tutee");

module.exports = function(reqBody, newMembers, currentUserIfMember, zipName) {
  return new Promise(function(resolve, reject) {
    backupDatabase(reqBody.minMeetings).then(function() {
      backup.createZipOfDatabase(zipName, reqBody.ext, reqBody.minMeetings).then(function() {
        deleteDatabase(reqBody.preserveMeetings, newMembers ? true : false, reqBody.preserveTutors, reqBody.preserveTutees);
        if (!newMembers) return resolve("Successfully backed up and deleted the database. No new members were uploaded.");
        Member.find({accessLevel: {$gte: 1}}, function(err, previousOfficers) {
          parseFile(newMembers).then(function(parseResult) {
            if (!parseResult.members) return resolve("Backed up and deleted the database.<br>" + parseResult.flashMsg);
            Member.deleteMany({id: {$ne: currentUserIfMember ? currentUserIfMember.id : ""}}, function(err, deleteResult) {
              console.info("Deleted all members from the database: " + JSON.stringify(deleteResult));
              if (currentUserIfMember) updateCurrentUser(currentUserIfMember, parseResult.members);
              Member.create(parseResult.members, function(err, newMembers) {
                if (reqBody.preserveTutors || reqBody.preserveTutees) updateTutorAndTuteeIDs(newMembers);
                resolve("Backed up and deleted the database.<br>" + ((newMembers ? newMembers.length : 0) + (currentUserIfMember ? 1 : 0))
                + " new members have been loaded into the database." + findPreservedOfficers(previousOfficers, parseResult.members) + parseResult.flashMsg);
              });
            });
          });
        });
      });
    });
  });
}

function backupDatabase(minMeetings) {
  return new Promise(function(resolve, reject) {
    var currentDate = utils.getCurrentDate("mm-dd-yyyy");
    backup.mongooseModel("./backups/term-migration/" + currentDate + "/meetings.txt", Meeting);
    backup.mongooseModel("./backups/term-migration/" + currentDate + "/members.txt", Member);
    backup.mongooseModel("./backups/term-migration/" + currentDate + "/membersQualifying.txt", Member, function(members) {
      return members.filter(member => member.meetingsAttended.length >= minMeetings);
    });
    backup.mongooseModel("./backups/term-migration/" + currentDate + "/tutors.txt", Tutor);
    backup.mongooseModel("./backups/term-migration/" + currentDate + "/tutees.txt", Tutee);
    resolve();
  });
}

function deleteDatabase(preserveMeetings, preserveMembers, preserveTutors, preserveTutees) {
  if (!preserveMeetings)
    Meeting.deleteMany({}, function(err, deleteResult){ console.info("Deleted all meetings from the database: " + JSON.stringify(deleteResult)); });
  if (!preserveMembers)
    Member.deleteMany({}, function(err, deleteResult){ console.info("Deleted all members from the database: " + JSON.stringify(deleteResult)); });
  if (!preserveTutors)
    Tutor.deleteMany({}, function(err, deleteResult){ console.info("Deleted all tutors from the database: " + JSON.stringify(deleteResult)); });
  if (!preserveTutees)
    Tutee.deleteMany({}, function(err, deleteResult){ console.info("Deleted all tutees from the database: " + JSON.stringify(deleteResult)); });
}

function parseFile(newMembers) {
  return new Promise(function(resolve, reject) {
    newMembers.mv(newMembers.name, function() {
      var parsedMembers = xlsx.parseMembers(newMembers.name), flashMsg = "";
      fs.unlink(newMembers.name, function(err){});
      if (!parsedMembers.members)
        flashMsg += "Something went wrong with the uploaded member file, so members were not deleted. Review the file and try again.";
      if (parsedMembers.warnings.length > 0)
        flashMsg += "<br>WARNING: The members in rows " + utils.arrayToSentence(parsedMembers.warnings)
        + " of the uploaded Excel sheet are invalid and were not added.";
      resolve({members: parsedMembers.members, flashMsg: flashMsg});
    });
  });
}

function updateCurrentUser(user, newMembers) {
  var matchingNewMember = newMembers.find(newMember => user.id == newMember.id);
  if (matchingNewMember)
    Member.findByIdAndUpdate(user._id, {name: matchingNewMember.name, grade: matchingNewMember.grade, termCount: matchingNewMember.termCount, meetingsAttended: []}).exec();
}

function findPreservedOfficers(previousOfficers, newMembers) {
  var previousOfficersNotPreserved = [];
  previousOfficers.forEach(function(previousOfficer) {
    var matchingNewMember = newMembers.find(newMember => newMember.id == previousOfficer.id);
    if (matchingNewMember) {
      Member.findByIdAndUpdate(matchingNewMember._id, {accessLevel: previousOfficer.accessLevel}).exec();
      console.info(matchingNewMember.name + "\'s (" + matchingNewMember.id + ") access level of " + previousOfficer.accessLevel + " has been conserved.");
    } else if (req.user.id == previousOfficer.id) {
      console.info(previousOfficer.name + "\'s (" + previousOfficer.id + ") access level of " + previousOfficer.accessLevel + " has been conserved.");
    } else {
      console.warn(previousOfficer.name + "\'s (" + previousOfficer.id + ") access level of " + previousOfficer.accessLevel + " was NOT conserved.");
      previousOfficersNotPreserved.push(previousOfficer.name + "\'s (" + previousOfficer.id + ") access level of " + previousOfficer.accessLevel);
    }
  });
  if (previousOfficersNotPreserved.length > 0) return "<br>WARNING: " + utils.arrayToSentence(previousOfficersNotPreserved) + " was NOT conserved.";
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
