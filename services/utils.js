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

utils.reformatDate = function(date) {
  var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], date = new Date(date);
  return(months[date.getMonth()] + " " + (date.getDate()+1) + ", " + date.getFullYear());
}

module.exports = utils;
