const utils = require("./utils"),
      courses = require("../config/courses");

var ejs = {};

ejs.arrayToSentence = utils.arrayToSentence;

ejs.reformatCourse = utils.reformatCourse;

ejs.reformatDate = utils.reformatDate;

ejs.reformatVar = utils.reformatVar;

ejs.getURLLocation = function(url, fromQuery, currentUser) {
  if (fromQuery && fromQuery.substring(0,9) == "/settings" || url.substring(0,9) == "/settings")
    return "Settings";
  else if (!fromQuery && url.substring(0,11) == "/tutors/new")
    return "Tutor Sign Up";
  else if (!fromQuery && currentUser && currentUser.tutorID && url.substring(0,8+currentUser.tutorID.length) == "/tutors/" + currentUser.tutorID)
    return "My Tutor Profile"
  else if (fromQuery && fromQuery.substring(0,7) == "/tutors" || url.substring(0,7) == "/tutors")
    return "Tutors";
  else if (!fromQuery && url.substring(0,11) == "/tutees/new")
    return "Request a Tutor";
  else if (!fromQuery && currentUser && currentUser.tuteeID && url.substring(0,8+currentUser.tuteeID.length) == "/tutees/" + currentUser.tuteeID)
    return "My Tutor Request";
  else if (fromQuery && fromQuery.substring(0,7) == "/tutees" || url.substring(0,7) == "/tutees")
    return "Tutees";
  else if (url.substring(0,9) == "/meetings")
    return "Meetings";
  else if (url.substring(0,19) == "/members/attendance")
    return "Attendance";
  else if (url.substring(0,8) == "/members")
    return "Members";
  return null;
}

module.exports = ejs;
