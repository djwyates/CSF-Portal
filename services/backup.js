const archiver = require("archiver"),
      fs = require("fs"),
      attendance = require("./attendance"),
      pdf = require("./pdf"),
      utils = require("./utils"),
      xlsx = require("./xlsx"),
      Meeting = require("../models/meeting"),
      Member = require("../models/member"),
      Tutor = require("../models/tutor"),
      Tutee = require("../models/tutee"),
      AttendanceRecord = require("../models/attendance-record"),
      Backup = require("../models/backup");

var backup = {};

createBackup = function(name, type, category, data) {
  if (!data || data.length == 0) return;
  Backup.find({}, function(err, backups) {
    if (category == "deleted" && backups.find(b => b.name == name && b.category == category && b.type.substring(0, 5) == type.substring(0, 5))
    || category == "replaced" && backups.find(b => b.name == name && b.category == category) || category == "term-migration"
    && backups.find(b => b.name == name && b.category == category && b.createdOn.split(" ")[0] == utils.getCurrentDate("mm-dd-yyyy") + ",")) {
      var dupeCount = 1;
      while (backups.find(b => b.name == name + " (" + dupeCount + ")")) dupeCount++;
      name += " (" + dupeCount + ")";
    }
    Backup.create({name: name, type: type, category: category, createdOn: utils.getCurrentDate("mm-dd-yyyy, 00:00:00"), data: data});
  });
}

backup.create = createBackup;

backup.createZipOfDatabase = function(zipName, format, minMeetings) {
  return new Promise(function(resolve, reject) {
    format = format == "pdf" ? "pdf" : "xlsx";
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
        fs.unlink("attendance." + format, function(err){});
        resolve();
      });
      archive.pipe(output);
      archive.append(fs.createReadStream("meetings." + format), {name: "meetings." + format});
      archive.append(fs.createReadStream("members." + format), {name: "members." + format});
      if (minMeetings) archive.append(fs.createReadStream("membersQualifying." + format), {name: "membersQualifying." + format});
      if (minMeetings) archive.append(fs.createReadStream("membersNotQualifying." + format), {name: "membersNotQualifying." + format});
      archive.append(fs.createReadStream("tutors." + format), {name: "tutors." + format});
      archive.append(fs.createReadStream("tutees." + format), {name: "tutees." + format});
      archive.append(fs.createReadStream("attendance." + format), {name: "attendance." + format});
      archive.finalize();
    });
  });
}

function writeDatabaseFilesToZip(format, minMeetings) {
  return new Promise(function(resolve, reject) {
    var formatServices = format == "pdf" ? pdf : xlsx;
    var meetingsLimit = function(meetings) {
      return meetings.map(function(meeting) {
        if (format == "pdf") return Object.assign(meeting, {membersAttended: meeting.attendance.length});
        Object.assign(meeting, {numMembersAttended: meeting.attendance.length});
        return Object.assign(meeting, {membersAttended: meeting.attendance.length > 0 ? meeting.attendance.map(r => r = r.memberID).join(", ") : "none"});
      });
    };
    var membersLimit = function(members) {
      return members.map(function(member) {
        if (format == "pdf") return Object.assign(member, {meetingsAttended: member.attendance.length});
        Object.assign(member, {numMeetingsAttended: member.attendance.length});
        return Object.assign(member, {meetingsAttended: member.attendance.length > 0 ? member.attendance.map(r => r = r.meetingDate).join(", ") : "none"});
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
            if (fs.existsSync("attendance." + format)) fs.unlinkSync("tutees." + format);
            formatServices.writeMongooseModel(AttendanceRecord, "attendance." + format).then(function() {
              if (!minMeetings) return resolve();
              var membersQualifyingLimit = function(members) {
                return members.filter(member => member.attendance.length >= minMeetings).map(function(member) {
                  if (format == "pdf") return Object.assign(member, {meetingsAttended: member.attendance.length});
                  Object.assign(member, {numMeetingsAttended: member.attendance.length});
                  return Object.assign(member, {meetingsAttended: member.attendance.length > 0 ? member.attendance.map(r => r = r.meetingDate).join(", ") : "none"});
                });
              };
              var membersNotQualifyingLimit = function(members) {
                return members.filter(member => member.attendance.length < minMeetings).map(function(member) {
                  if (format == "pdf") return Object.assign(member, {meetingsAttended: member.attendance.length});
                  Object.assign(member, {numMeetingsAttended: member.attendance.length});
                  return Object.assign(member, {meetingsAttended: member.attendance.length > 0 ? member.attendance.map(r => r = r.meetingDate).join(", ") : "none"});
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
  });
}

backup.restore = function(backupID) {
  return new Promise(function(resolve, reject) {
    Backup.findById(backupID, function(err, backup) {
      if (!backup) return resolve("No backup was found with that ID.");
      else if (!backup.data || backup.data.length == 0) return resolve("There is nothing to restore from this backup.");
      if (backup.type == "Meeting") {
        var meetingAttendance = backup.data.attendance;
        delete backup.data.attendance;
        Meeting.create(backup.data, function(err, newMeeting) {
          if (newMeeting) {
            restoreAttendance(meetingAttendance).then(function(warningMsg) {
              resolve("The selected backup was successfully restored." + warningMsg);
            });
          } else resolve("The selected backup was not restored because it would overwrite current data. Check for a meeting that exists with the same date.");
        });
      } else if (backup.type == "Member") {
        var memberAttendance = backup.data.attendance;
        delete backup.data.attendance;
        Member.create(backup.data, function(err, newMember) {
          if (newMember) {
            restoreAttendance(memberAttendance).then(function(warningMsg) {
              resolve("The selected backup was successfully restored." + warningMsg);
            });
          } else resolve("The selected backup was not restored because it would overwrite current data. Check for a member that exists with the same ID.");
        });
      } else if (backup.type == "Tutee") {
        Tutee.create(backup.data, function(err, newTutee) {
          if (newTutee) {
            Member.findOneAndUpdate({id: newTutee.id}, {tuteeID: newTutee._id}).exec();
            resolve("The selected backup was successfully restored.");
          } else resolve("The selected backup was not restored because it would overwrite current data. Check for a tutee that exists with the same ID.");
        });
      } else if (backup.type == "Meetings") {
        Meeting.find({}).populate("attendance").lean().exec(function(err, meetings) {
          createBackup("meetings", "Meetings", "replaced", meetings);
          attendance.removeAll();
          var allAttendance = [];
          backup.data.forEach(function(meeting) {
            allAttendance = allAttendance.concat(meeting.attendance);
            delete meeting.attendance;
          });
          Meeting.deleteMany({}, function(err, deleteResult) {
            Meeting.create(backup.data, function(err, newMeetings) {
              if (err) {
                console.error(err);
                resolve("An unexpected error occurred.");
              } else if (newMeetings.length == 0) {
                resolve("All previous meetings were backed up and deleted, but an error occurred in creating new meetings from this backup.");
              } else {
                restoreAttendance(allAttendance).then(function(warningMsg) {
                  resolve("The selected backup was successfully restored: All previous meetings were backed up and replaced." + warningMsg);
                });
              }
            });
          });
        });
      } else if (backup.type == "Members") {
        Member.find({}).populate("attendance").lean().exec(function(err, members) {
          createBackup("members", "Members", "replaced", members);
          attendance.removeAll();
          var allAttendance = [];
          backup.data.forEach(function(member) {
            allAttendance = allAttendance.concat(member.attendance);
            delete member.attendance;
          });
          Member.deleteMany({}, function(err, deleteResult) {
            Member.create(backup.data, function(err, newMembers) {
              if (err) {
                console.error(err);
                resolve("An unexpected error occurred.");
              } else if (newMembers.length == 0) {
                resolve("All previous members were backed up and deleted, but an error occurred in creating new members from this backup.");
              } else {
                restoreAttendance(allAttendance).then(function(warningMsg) {
                  resolve("The selected backup was successfully restored: All previous members were backed up and replaced." + warningMsg);
                });
              }
            });
          });
        });
      } else if (backup.type == "Tutors") {
        Tutor.find({}, function(err, tutors) {
          createBackup("tutors", "Tutors", "replaced", tutors);
          tutors.forEach(function(tutor) {
            Member.findOneAndUpdate({id: tutor.id}, {$unset: {tutorID: ""}}).exec();
          });
          Tutor.deleteMany({}, function(err, deleteResult) {
            Tutor.create(backup.data, function(err, newTutors) {
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
      } else if (backup.type == "Tutees") {
        Tutee.find({}, function(err, tutees) {
          createBackup("tutees", "Tutees", "replaced", tutees);
          tutees.forEach(function(tutee) {
            Member.findOneAndUpdate({id: tutee.id}, {$unset: {tuteeID: ""}}).exec();
          });
          Tutee.deleteMany({}, function(err, deleteResult) {
            Tutee.create(backup.data, function(err, newTutees) {
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
      } else resolve("This backup type was not recognized.");
    });
  });
}

function restoreAttendance(records) {
  return new Promise(function(resolve, reject) {
    if (records.length == 0) return resolve("");
    var warningMsg = "", _warningMsg = "";
    records.forEach(function(record) {
      Meeting.exists({date: record.meetingDate}, function(err, meetingExists) {
        Member.exists({id: record.memberID}, function(err, memberExists) {
          if (!meetingExists) {
            _warningMsg = "[!] The attendance record of the member " + record.memberID + " contains a meeting with date "
            + utils.reformatDate(record.meetingDate) + " that does not exist.";
            warningMsg += "<br>" + _warningMsg;
            console.warn(_warningMsg);
          } else if (!memberExists) {
            _warningMsg = "[!] The attendance record of the meeting " + utils.reformatDate(record.meetingDate) + " contains a member with ID "
            + record.memberID + " that does not exist.";
            warningMsg += "<br>" + _warningMsg;
            console.warn(_warningMsg);
          } else attendance.add(record.meetingDate, record.memberID, record.timestamp);
          if (records.indexOf(record) == records.length-1) resolve(warningMsg);
        });
      });
    });
  });
}

module.exports = backup;
