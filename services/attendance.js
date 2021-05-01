const utils = require("./utils"),
      Meeting = require("../models/meeting"),
      Member = require("../models/member"),
      AttendanceRecord = require("../models/attendance-record");

var attendance = {};

attendance.add = function(meetingDate, memberID, recordedBy, timestamp) {
  timestamp = timestamp || utils.getCurrentDate("mm-dd-yyyy, 00:00:00");
  AttendanceRecord.exists({meetingDate: meetingDate, memberID: memberID}, function(err, recordExists) {
    if (!recordExists) {
      Member.exists({id: memberID}, function(err, memberExists) {
        Meeting.exists({date: meetingDate}, function(err, meetingExists) {
          if (memberExists && meetingExists) {
            AttendanceRecord.create({meetingDate: meetingDate, memberID: memberID, recordedBy: recordedBy, timestamp: timestamp},
              function(err, record) {
              Meeting.updateOne({date: meetingDate}, {$push: {attendance: record._id}}).exec();
              Member.updateOne({id: memberID}, {$push: {attendance: record._id}}).exec();
            });
          }
        });
      });
    }
  });
}

attendance.remove = function(meetingDate, memberID) {
  AttendanceRecord.findOneAndDelete({meetingDate: meetingDate, memberID: memberID}, function(err, record) {
    if (record) {
      Meeting.updateOne({date: meetingDate}, {$pull: {attendance: record._id}}).exec();
      Member.updateOne({id: memberID}, {$pull: {attendance: record._id}}).exec();
    }
  });
}

attendance.removeById = function(_id) {
  AttendanceRecord.findByIdAndDelete(_id, function(err, record) {
    if (record) {
      Meeting.updateOne({date: record.meetingDate}, {$pull: {attendance: record._id}}).exec();
      Member.updateOne({id: record.memberID}, {$pull: {attendance: record._id}}).exec();
    }
  });
}

attendance.removeAll = function() {
  AttendanceRecord.deleteMany({}).exec();
  Meeting.updateMany({}, {attendance: []}).exec();
  Member.updateMany({}, {attendance: []}).exec();
}

module.exports = attendance;
