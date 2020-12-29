const fs = require("fs"),
      pathJS = require("path"),
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
