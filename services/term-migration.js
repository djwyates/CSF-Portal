const archiver = require("archiver"),
      fs = require("fs"),
      xlsx = require("../services/xlsx"),
      backup = require("./backup"),
      utils = require("./utils"),
      Meeting = require("../models/meeting"),
      Member = require("../models/member"),
      Tutor = require("../models/tutor"),
      Tutee = require("../models/tutee");

module.exports = function(reqBody, newMembers, currentUserIfMember) {
  return new Promise(function(resolve, reject) {
    backupDatabase(reqBody.minMeetings).then(function() {
      createZip(reqBody.ext, reqBody.minMeetings).then(function() {
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

function createZip(format, minMeetings) {
  return new Promise(function(resolve, reject) {
    writeZipFiles(format, minMeetings).then(function() {
      var output = fs.createWriteStream("./term_migration_" + utils.getCurrentDate("mm-dd-yyyy") + ".zip")
      var archive = archiver("zip", {zlib: {level: 9}});
      output.on("finish", function() {
        fs.unlink("meetings." + format, function(err){});
        fs.unlink("members." + format, function(err){});
        fs.unlink("membersQualifying." + format, function(err){});
        fs.unlink("tutors." + format, function(err){});
        fs.unlink("tutees." + format, function(err){});
        resolve();
      });
      archive.pipe(output);
      archive.append(fs.createReadStream("meetings." + format), {name: "meetings." + format});
      archive.append(fs.createReadStream("members." + format), {name: "members." + format});
      archive.append(fs.createReadStream("membersQualifying." + format), {name: "membersQualifying." + format});
      archive.append(fs.createReadStream("tutors." + format), {name: "tutors." + format});
      archive.append(fs.createReadStream("tutees." + format), {name: "tutees." + format});
      archive.finalize();
    });
  });
}

function writeZipFiles(format, minMeetings) {
  return new Promise(function(resolve, reject) {
    var meetingsLimit = function(meetings) {return meetings.map(meeting => Object.assign(meeting, {numMembersAttended: meeting.membersAttended.length}));};
    var membersLimit = function(members) {return members.map(member => Object.assign(member, {numMeetingsAttended: member.meetingsAttended.length}));};
    var membersQualifyingLimit = function(members) {
      return members.filter(member => member.meetingsAttended.length >= minMeetings)
      .map(member => Object.assign(member, {numMeetingsAttended: member.meetingsAttended.length}));
    };
    xlsx.writeMongooseModel(Meeting, "meetings.xlsb", meetingsLimit).then(function() {
      xlsx.writeMongooseModel(Member, "members.xlsb", membersLimit).then(function() {
        xlsx.writeMongooseModel(Member, "membersQualifying.xlsb", membersQualifyingLimit).then(function() {
          xlsx.writeMongooseModel(Tutor, "tutors.xlsb").then(function() {
            xlsx.writeMongooseModel(Tutee, "tutees.xlsb").then(function() {
              resolve();
            });
          });
        });
      });
    });
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
