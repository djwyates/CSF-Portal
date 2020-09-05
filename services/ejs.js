const courses = require("../config/courses");

var ejs = {};

ejs.reformatCourse = function(thisCourseID) {
  for (courseCategory in courses) {
    for (courseID in courses[courseCategory]) {
      if (courseID == thisCourseID)
        return courses[courseCategory][courseID];
    }
  }
  return thisCourseID;
}

ejs.reformatDate = function(date) {
  if (date.length <= 10) date += ", 12:00:00 AM";
  var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], date = new Date(date);
  return(months[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear());
}

ejs.reformatVar = function(variable) {
  var result = variable[0].toUpperCase();
  for (var i = 0; i < variable.length-1; i++) {
    if (i != 0)
      result += variable[i];
    if (variable[i+1] === variable[i+1].toUpperCase())
      result += " ";
  }
  result += variable[variable.length-1];
  return result;
}

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
