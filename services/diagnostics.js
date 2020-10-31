const utils = require("./utils"),
      Meeting = require("../models/meeting"),
      Member = require("../models/member"),
      Tutor = require("../models/tutor"),
      Tutee = require("../models/tutee");

module.exports = new Promise(function(resolve, reject) {
  Meeting.find({}, function(err, meetings) {
    Member.find({}, function(err, members) {
      Tutor.find({}, function(err, tutors) {
        Tutee.find({}, function(err, tutees) {
          result = testMeetings(meetings, members);
          result += testMembers(meetings, members, tutors, tutees);
          result += testTutors(members, tutors, tutees);
          result += testTutees(members, tutors, tutees);
          resolve(result);
        });
      });
    });
  });
});

function testMeetings(meetings, members) {
  var result = "", dupeRecords = null;
  /* checks for duplicate dates */
  var dupeDates = utils.findDuplicatesInArray(meetings.map(meeting => meeting.date));
  if (dupeDates.length > 0) {
    result += "Multiple meetings have the same dates of " + utils.arrayToSentence(dupeDates.map(date => utils.reformatDate(date))) + ".<br>";
  }
  meetings.forEach(function(meeting) {
    /* checks for duplicate attendance records */
    dupeRecords = utils.findDuplicatesInArray(meeting.membersAttended);
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
  return result;
}

function testMembers(meetings, members, tutors, tutees) {
  var result = "", linkedTutor = null, linkedTutee = null;
  /* checks for duplicate IDs */
  var dupeIDs = utils.findDuplicatesInArray(members.map(member => member.id));
  if (dupeIDs.length > 0) {
    result += "Multiple members have the same IDs of " + utils.arrayToSentence(dupeIDs) + ".<br>";
  }
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
    /* checks if members are linked with an existing and accurate tutor/tutee */
    if (member.tutorID) {
      linkedTutor = tutors.find(tutor => tutor._id == member.tutorID);
      if (!linkedTutor) {
        result += "The <a class='link--white' href='/members/" + member._id + "?from=%2Fsettings%2Fdiagnostics'>Member " + member.id + "</a> is linked to a tutor that does not exist.";
      } else if (linkedTutor.id != member.id) {
        result += "The <a class='link--white' href='/members/" + member._id + "?from=%2Fsettings%2Fdiagnostics'>Member " + member.id
        + "</a> is linked to a <a class='link--white' href='/tutors/'" + linkedTutor._id + ">tutor with a different ID of " + linkedTutor.id + "</a>";
      }
    } if (member.tuteeID) {
      linkedTutee = tutees.find(tutee => tutee._id == member.tuteeID);
      if (!linkedTutee) {
        result += "The <a class='link--white' href='/members/" + member._id + "?from=%2Fsettings%2Fdiagnostics'>Member " + member.id + "</a> is linked to a tutee that does not exist.";
      } else if (linkedTutee.id != member.id) {
        result += "The <a class='link--white' href='/members/" + member._id + "?from=%2Fsettings%2Fdiagnostics'>Member " + member.id
        + "</a> is linked to a <a class='link--white' href='/tutors/'" + linkedTutee._id + ">tutee with a different ID of " + linkedTutee.id + "</a>";
      }
    }
  });
  return result;
}

function testTutors(members, tutors, tutees) {
  var result = "", matchingTutee = null, matchingTutorSession = null, matchingMember = null;
  /* checks for duplicate IDs */
  var dupeIDs = utils.findDuplicatesInArray(tutors.map(tutor => tutor.id));
  if (dupeIDs.length > 0) {
    result += "Multiple tutors have the same IDs of " + utils.arrayToSentence(dupeIDs) + ".<br>";
  }
  tutors.forEach(function(tutor) {
    /* checks if tutors and their tutees are in pairs */
    tutor.tuteeSessions.forEach(function(tuteeSession) {
      matchingTutee = tutees.find(tutee => tutee._id == tuteeSession.tuteeID);
      if (!matchingTutee) {
        result += "Records of <a class='link--white' href='/tutors/" + tutor._id + "?from=%2Fsettings%2Fdiagnostics'>Tutor " + tutor.id + "</a> indicate them tutoring Tutee "
        + tuteeSession.tuteeID + " while that tutee does not exist.<br>";
      } else {
        matchingTutorSession = matchingTutee.tutorSessions.find(tutorSession => tutorSession.tutorID == tutor._id);
        if (!matchingTutorSession) {
          result += "Records of <a class='link--white' href='/tutors/" + tutor._id + "?from=%2Fsettings%2Fdiagnostics'>Tutor " + tutor.id + "</a> indicate them tutoring "
          + "<a class='link--white' href='/tutees/" + matchingTutee._id + "?from=%2Fsettings%2Fdiagnostics'>Tutee " + matchingTutee.id + "</a>  while the tutee\'s records do not.<br>"
        } else {
          if (tuteeSession.status != matchingTutorSession.status) {
            result += "The statuses of <a class='link--white' href='/tutors/" + tutor._id + "?from=%2Fsettings%2Fdiagnostics'>Tutor " + tutor.id + "\'s</a> and "
            + "<a class='link--white' href='/tutees/" + matchingTutee._id + "?from=%2Fsettings%2Fdiagnostics'>Tutee " + matchingTutee.id + "\'s</a> tutoring sessions do not match.";
          } if (tuteeSession.courses.sort().join(",") != matchingTutorSession.courses.sort().join(",")) {
            result += "The courses of <a class='link--white' href='/tutors/" + tutor._id + "?from=%2Fsettings%2Fdiagnostics'>Tutor " + tutor.id + "\'s</a> and "
            + "<a class='link--white' href='/tutees/" + matchingTutee._id + "?from=%2Fsettings%2Fdiagnostics'>Tutee " + matchingTutee.id + "\'s</a> tutoring sessions do not match.";
          }
        }
      }
    });
    /* checks if tutors are linked with an existing and accurate member */
    matchingMember = members.find(member => member.id == tutor.id);
    if (!matchingMember) {
      result += "No members have the ID of <a class='link--white' href='/tutors/" + tutor._id + "?from=%2Fsettings%2Fdiagnostics'>Tutor " + tutor._id + "</a>";
    } else if (!matchingMember.tutorID || matchingMember.tutorID != tutor._id) {
      result += "The <a class='link--white' href='/members/" + matchingMember._id + "?from=%2Fsettings%2Fdiagnostics'>Member " + matchingMember.id
      + "</a> is not linked with the correct <a class='link--white' href='/tutors/" + tutor._id + "?from=%2Fsettings%2Fdiagnostics'>Tutor " + tutor.id + "</a>";
    }
  });
  return result;
}

function testTutees(members, tutors, tutees) {
  var result = "", matchingTutor = null, matchingTuteeSession = null, matchingMember = null;
  /* checks for duplicate IDs */
  var dupeIDs = utils.findDuplicatesInArray(tutees.map(tutee => tutee.id));
  if (dupeIDs.length > 0) {
    result += "Multiple tutees have the same IDs of " + utils.arrayToSentence(dupeIDs) + ".<br>";
  }
  tutees.forEach(function(tutee) {
    /* checks if tutees and their tutors are in pairs */
    tutee.tutorSessions.forEach(function(tutorSession) {
      matchingTutor = tutors.find(tutor => tutor._id == tutorSession.tutorID);
      if (!matchingTutor) {
        result += "Records of <a class='link--white' href='/tutees/" + tutee._id + "?from=%2Fsettings%2Fdiagnostics'>Tutee " + tutee.id + "</a> indicate them being tutored by Tutor "
        + tutorSession.tutorID + " while that tutor does not exist.<br>";
      } else {
        matchingTuteeSession = matchingTutor.tuteeSessions.find(tuteeSession => tuteeSession.tuteeID == tutee._id);
        if (!matchingTuteeSession) {
          result += "Records of <a class='link--white' href='/tutees/" + tutee._id + "?from=%2Fsettings%2Fdiagnostics'>Tutee " + tutee.id + "</a> indicate them being tutored by "
          + "<a class='link--white' href='/tutors/" + matchingTutor._id + "?from=%2Fsettings%2Fdiagnostics'>Tutor " + matchingTutor.id + "</a>  while the tutor\'s records do not.<br>"
        } else {
          if (tutorSession.status != matchingTuteeSession.status) {
            result += "The statuses of <a class='link--white' href='/tutees/" + tutor._id + "?from=%2Fsettings%2Fdiagnostics'>Tutee " + tutee.id + "\'s</a> and "
            + "<a class='link--white' href='/tutors/" + matchingTutor._id + "?from=%2Fsettings%2Fdiagnostics'>Tutor " + matchingTutor.id + "\'s</a> tutoring sessions do not match.";
          } if (tutorSession.courses.sort().join(",") != matchingTuteeSession.courses.sort().join(",")) {
            result += "The courses of <a class='link--white' href='/tutees/" + tutee._id + "?from=%2Fsettings%2Fdiagnostics'>Tutee " + tutee.id + "\'s</a> and "
            + "<a class='link--white' href='/tutors/" + matchingTutor._id + "?from=%2Fsettings%2Fdiagnostics'>Tutor " + matchingTutor.id + "\'s</a> tutoring sessions do not match.";
          }
        }
      }
    });
    /* checks if tutees are linked with an existing and accurate member */
    matchingMember = members.find(member => member.id == tutee.id);
    if (matchingMember && (!matchingMember.tuteeID || matchingMember.tuteeID != tutee._id)) {
      result += "The <a class='link--white' href='/members/" + matchingMember._id + "?from=%2Fsettings%2Fdiagnostics'>Member " + matchingMember.id
      + "</a> is not linked with the correct <a class='link--white' href='/tutors/" + tutee._id + "?from=%2Fsettings%2Fdiagnostics'>Tutee " + tutee.id + "</a>";
    }
  });
  return result;
}
