const courses = require("../config/courses");

var utils = {};

utils.arrayToSentence = function(array) {
  return array.slice(0, -2).join(", ") + (array.slice(0, -2).length ? ", " : "") + array.slice(-2).join(" and ");
}

utils.findDuplicatesInArray = function(array) {
  var alreadySeen = [], duplicates = [];
  array.forEach(function(item) {
    if (alreadySeen[item] && !duplicates.includes(item))
      duplicates.push(item);
    else
      alreadySeen[item] = true;
  });
  return duplicates;
}

utils.reformatCourse = function(thisCourseID) {
  for (courseCategory in courses) {
    for (courseID in courses[courseCategory]) {
      if (courseID == thisCourseID)
        return courses[courseCategory][courseID];
    }
  }
  return thisCourseID;
}

utils.reformatDate = function(date) {
  if (date.length <= 10) date += ", 12:00:00 AM";
  var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], date = new Date(date);
  return(months[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear());
}

module.exports = utils;
