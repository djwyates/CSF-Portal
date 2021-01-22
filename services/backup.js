const archiver = require("archiver"),
      fs = require("fs"),
      pathJS = require("path"),
      pdf = require("./pdf"),
      xlsx = require("./xlsx"),
      Meeting = require("../models/meeting"),
      Member = require("../models/member"),
      Tutor = require("../models/tutor"),
      Tutee = require("../models/tutee");

/* helper functions */

function writeFileSync(path, data) {
  var parsedPath = pathJS.parse(path);
  if (!fs.existsSync(path)) {
    if (!fs.existsSync(parsedPath.dir))
      fs.mkdirSync(parsedPath.dir, {recursive: true}, function(err) { if (err) console.error(err); });
    fs.writeFileSync(path, typeof data == "object" ? JSON.stringify(data) : data, function(err) { if (err) console.error(err); });
  } else {
    var duplicateCount = 1;
    while (fs.existsSync(parsedPath.dir + "/" + parsedPath.name + " (" + duplicateCount + ")" + parsedPath.ext)) duplicateCount++;
    fs.writeFileSync(parsedPath.dir + "/" + parsedPath.name + " (" + duplicateCount + ")" + parsedPath.ext, typeof data == "object" ? JSON.stringify(data) : data, function(err) { if (err) console.error(err); });
  }
}

function getFileData(dirPath, arrayOfFiles) {
  arrayOfFiles = arrayOfFiles || [];
  fs.readdirSync(dirPath).forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory())
      arrayOfFiles = getFileData(dirPath + "/" + file, arrayOfFiles);
    else
      arrayOfFiles.push({name: file, path: dirPath + "/" + file, data: fs.readFileSync(dirPath + "/" + file).toString().replace(/\n/g,"")});
  });
  return arrayOfFiles;
}

/* exported functions */

var backup = {};

backup.object = function(path, object) {
  writeFileSync(path, object);
}

backup.mongooseModel = function(path, model, limit) {
  model.find({}).lean().exec(function(err, documents) {
    if (err || !documents) console.error(err ? err : "ERROR: The model you tried to back up does not exist.");
    else writeFileSync(path, limit ? limit(documents) : documents);
  });
}

backup.createZipOfDatabase = function(zipName, format, minMeetings) {
  return new Promise(function(resolve, reject) {
    writeDatabaseFilesToZip(format, minMeetings).then(function() {
      if (fs.existsSync(zipName)) fs.unlinkSync(zipName);
      var output = fs.createWriteStream(zipName);
      var archive = archiver("zip", {zlib: {level: 9}});
      output.on("finish", function() {
        fs.unlink("meetings." + format, function(err){});
        fs.unlink("members." + format, function(err){});
        if (minMeetings) fs.unlink("membersQualifying." + format, function(err){});
        if (minMeetings) fs.unlink("membersNotQualifying." + format, function(err){});
        fs.unlink("tutors." + format, function(err){});
        fs.unlink("tutees." + format, function(err){});
        resolve();
      });
      archive.pipe(output);
      archive.append(fs.createReadStream("meetings." + format), {name: "meetings." + format});
      archive.append(fs.createReadStream("members." + format), {name: "members." + format});
      if (minMeetings) archive.append(fs.createReadStream("membersQualifying." + format), {name: "membersQualifying." + format});
      if (minMeetings) archive.append(fs.createReadStream("membersNotQualifying." + format), {name: "membersNotQualifying." + format});
      archive.append(fs.createReadStream("tutors." + format), {name: "tutors." + format});
      archive.append(fs.createReadStream("tutees." + format), {name: "tutees." + format});
      archive.finalize();
    });
  });
}

function writeDatabaseFilesToZip(format, minMeetings) {
  return new Promise(function(resolve, reject) {
    var formatServices = format == "pdf" ? pdf : xlsx;
    var meetingsLimit = function(meetings) {
      return meetings.map(function(meeting) {
        if (format == "pdf") return Object.assign(meeting, {membersAttended: meeting.membersAttended.length});
        Object.assign(meeting, {numMembersAttended: meeting.membersAttended.length});
        return Object.assign(meeting, {membersAttended: meeting.membersAttended.length > 0 ? meeting.membersAttended.join(", ") : "none"});
      });
    };
    var membersLimit = function(members) {
      return members.map(function(member) {
        if (format == "pdf") return Object.assign(member, {meetingsAttended: member.meetingsAttended.length});
        Object.assign(member, {numMeetingsAttended: member.meetingsAttended.length});
        return Object.assign(member, {meetingsAttended: member.meetingsAttended.length > 0 ? member.meetingsAttended.join(", ") : "none"});
      });
    };
    var tutorsLimit = function(tutors) {
      return tutors.map(function(tutor) {
        Object.assign(tutor, {tuteeSessions: JSON.stringify(tutor.tuteeSessions)});
        return Object.assign(tutor, {courses: tutor.courses.length > 0 ? tutor.courses.join(", ") : "none"});
      });
    };
    var tuteesLimit = function(tutees) {
      return tutees.map(function(tutee) {
        Object.assign(tutee, {tutorSessions: JSON.stringify(tutee.tutorSessions)});
        return Object.assign(tutee, {courses: tutee.courses.length > 0 ? tutee.courses.join(", ") : "none"});
      });
    };
    if (fs.existsSync("meetings." + format)) fs.unlinkSync("meetings." + format);
    formatServices.writeMongooseModel(Meeting, "meetings." + format, meetingsLimit).then(function() {
      if (fs.existsSync("members." + format)) fs.unlinkSync("members." + format);
      formatServices.writeMongooseModel(Member, "members." + format, membersLimit).then(function() {
        if (fs.existsSync("tutors." + format)) fs.unlinkSync("tutors." + format);
        formatServices.writeMongooseModel(Tutor, "tutors." + format, tutorsLimit).then(function() {
          if (fs.existsSync("tutees." + format)) fs.unlinkSync("tutees." + format);
          formatServices.writeMongooseModel(Tutee, "tutees." + format, tuteesLimit).then(function() {
            if (!minMeetings) return resolve();
            var membersQualifyingLimit = function(members) {
              return members.filter(member => member.meetingsAttended.length >= minMeetings).map(function(member) {
                if (format == "pdf") return Object.assign(member, {meetingsAttended: member.meetingsAttended.length});
                Object.assign(member, {numMeetingsAttended: member.meetingsAttended.length});
                return Object.assign(member, {meetingsAttended: member.meetingsAttended.length > 0 ? member.meetingsAttended.join(", ") : "none"});
              });
            };
            var membersNotQualifyingLimit = function(members) {
              return members.filter(member => member.meetingsAttended.length < minMeetings).map(function(member) {
                if (format == "pdf") return Object.assign(member, {meetingsAttended: member.meetingsAttended.length});
                Object.assign(member, {numMeetingsAttended: member.meetingsAttended.length});
                return Object.assign(member, {meetingsAttended: member.meetingsAttended.length > 0 ? member.meetingsAttended.join(", ") : "none"});
              });
            };
            if (fs.existsSync("membersQualifying." + format)) fs.unlinkSync("membersQualifying." + format);
            formatServices.writeMongooseModel(Member, "membersQualifying." + format, membersQualifyingLimit).then(function() {
              if (fs.existsSync("membersNotQualifying." + format)) fs.unlinkSync("membersNotQualifying." + format);
              formatServices.writeMongooseModel(Member, "membersNotQualifying." + format, membersNotQualifyingLimit).then(function() {
                resolve();
              });
            });
          });
        });
      });
    });
  });
}

backup.getBackupFiles = function() {
  return fs.existsSync("./backups") ? getFileData("./backups") : [];
}

backup.restoreFromBackup = function(reqBody) {
  return new Promise(function(resolve, reject) {
    if (reqBody.data) reqBody.data = JSON.parse(reqBody.data);
    var warningMsg = "";
    /* if the backup is a single meeting */
    if (reqBody.date) {
      reqBody.membersAttended = reqBody.membersAttended.length == 0 ? [] : reqBody.membersAttended.split(",");
      Meeting.create(reqBody, function(err, newMeeting) {
        if (newMeeting) {
          if (newMeeting.membersAttended.length > 0) {
            newMeeting.membersAttended.forEach(function(memberID) {
              Member.updateOne({id: memberID}, {$addToSet: {"meetingsAttended": newMeeting.date}}, function(err, updateResult) {
                if (updateResult.n == 0) {
                  warningMsg += "<br>WARNING: The attendance records of the restored meeting contains a member with ID " + memberID + " that does not exist.";
                  console.warn("WARNING: The attendance records of the meeting on " + utils.reformatDate(newMeeting.date) + " that was restored from backup contains a member with ID " + memberID + " that does not exist.");
                } if (newMeeting.membersAttended.indexOf(memberID) == newMeeting.membersAttended.length-1)
                  resolve("The selected backup was successfully restored." + warningMsg);
              });
            });
          } else resolve("The selected backup was successfully restored.");
        } else resolve("The selected backup was not restored because it would overwrite current data. Check for a meeting that exists with the same date.");
      });
    /* if the backup is a single tutee */
    } else if (reqBody.parentEmail) {
      delete reqBody.tutorSessions;
      reqBody.courses = reqBody.courses.length == 0 ? [] : reqBody.courses.split(",");
      Tutee.create(reqBody, function(err, newTutee) {
        if (newTutee) {
          Member.findOneAndUpdate({id: newTutee.id}, {tuteeID: newTutee._id}).exec();
          resolve("The selected backup was successfully restored.");
        } else resolve("The selected backup was not restored because it would overwrite current data. Check for a tutee that exists with the same ID.");
      });
    /* if the backup is a single member */
    } else if (reqBody.id) {
      reqBody.meetingsAttended = reqBody.meetingsAttended.length == 0 ? [] : reqBody.meetingsAttended.split(",");
      Member.create(reqBody, function(err, newMember) {
        if (newMember) {
          if (newMember.meetingsAttended.length > 0) {
            newMember.meetingsAttended.forEach(function(meetingDate) {
              Meeting.updateOne({date: meetingDate}, {$addToSet: {"membersAttended": newMember.id}}, function(err, updateResult) {
                if (updateResult.n == 0) {
                  warningMsg += "<br>WARNING: The attendance records of the restored member contains a meeting on " + utils.reformatDate(meetingDate) + " that does not exist.";
                  console.warn("WARNING: The attendance records of the member with ID " + newMember.id + " that was restored from backup contains a meeting on " + utils.reformatDate(meetingDate) + " that does not exist.");
                } if (newMember.meetingsAttended.indexOf(meetingDate) == newMember.meetingsAttended.length-1)
                  resolve("The selected backup was successfully restored." + warningMsg);
              });
            });
          } else resolve("The selected backup was successfully restored.");
        } else resolve("The selected backup was not restored because it would overwrite current data. Check for a member that exists with the same ID.");
      });
    } else if (reqBody.data && reqBody.data[0]) {
      /* if the backup is an array of meetings */
      if (reqBody.data[0].date) {
        backup.mongooseModel("./backups/replaced/meetings.txt", Meeting);
        Meeting.deleteMany({}, function(err, deleteResult) {
          Meeting.create(reqBody.data, function(err, newMeetings) {
            if (err) {
              console.error(err);
              resolve("An unexpected error occurred.");
            } else
              resolve("The selected backup was successfully restored: All previous meetings were backed up and replaced.");
          });
        });
      /* if the backup is an array of tutees */
      } else if (reqBody.data[0].parentEmail) {
        backup.mongooseModel("./backups/replaced/tutees.txt", Tutee);
        Tutee.find({}, function(err, tutees) {
          tutees.forEach(function(tutee) {
            Member.findOneAndUpdate({id: tutee.id}, {$unset: {tuteeID: ""}}).exec();
          });
          Tutee.deleteMany({}, function(err, deleteResult) {
            Tutee.create(reqBody.data, function(err, newTutees) {
              if (err) {
                console.error(err);
                resolve("An unexpected error occurred.");
              } else {
                newTutees.forEach(function(newTutee) {
                  Member.findOneAndUpdate({id: newTutee.id}, {tuteeID: newTutee._id}).exec();
                });
                resolve("The selected backup was successfully restored: All previous tutees were backed up and replaced.");
              }
            });
          });
        });
      /* if the backup is an array of tutors */
      } else if (reqBody.data[0].email) {
        backup.mongooseModel("./backups/replaced/tutors.txt", Tutor);
        Tutor.find({}, function(err, tutors) {
          tutors.forEach(function(tutor) {
            Member.findOneAndUpdate({id: tutor.id}, {$unset: {tutorID: ""}}).exec();
          });
          Tutor.deleteMany({}, function(err, deleteResult) {
            Tutor.create(reqBody.data, function(err, newTutors) {
              if (err) {
                console.error(err);
                resolve("An unexpected error occurred.");
              } else {
                newTutors.forEach(function(newTutor) {
                  Member.findOneAndUpdate({id: newTutor.id}, {tutorID: newTutor._id}).exec();
                });
                resolve("The selected backup was successfully restored: All previous tutors were backed up and replaced.");
              }
            });
          });
        });
      /* if the backup is an array of members */
      } else if (reqBody.data[0].id) {
        backup.mongooseModel("./backups/replaced/members.txt", Member);
        Member.deleteMany({}, function(err, deleteResult) {
          Member.create(reqBody.data, function(err, newMembers) {
            if (err) {
              console.error(err);
              resolve("An unexpected error occurred.");
            } else
              resolve("The selected backup was successfully restored: All previous members were backed up and replaced.");
          });
        });
      }
    } else
      resolve("You cannot restore from an empty backup.");
  });
}

module.exports = backup;
