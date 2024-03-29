const courses = require("../config/courses");

var utils = {};

utils.arrayToSentence = function(array) {
  if (!Array.isArray(array)) return array;
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

utils.getCurrentDate = function(format) {
  format = format || "mm-dd-yyyy, 00:00:00";
  if (format == "mm-dd-yyyy") {
    var currentDate = new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"}).replace(/\//g, "-").split(" ")[0];
    return currentDate.substring(0, currentDate.length-1);
  } else {
    return new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"}).replace(/\//g, "-");
  }
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
  if (!date) return null;
  if (date.length <= 10) date += ", 12:00:00 AM";
  var date = new Date(date);
  var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return(months[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear());
}

utils.reformatVar = function(variable) {
  var result = variable[0].toUpperCase();
  for (var i = 0; i < variable.length-1; i++) {
    if (i != 0)
      result += variable[i];
    if (variable[i+1] === variable[i+1].toUpperCase() && variable[i] + variable[i+1] !== "ID")
      result += " ";
  }
  result += variable[variable.length-1];
  return result;
}

module.exports = utils;
