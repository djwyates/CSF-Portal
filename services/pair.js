const sns = require("./sns")
      utils = require("./utils"),
      keys = require("../config/keys"),
      Tutor = require("../models/tutor"),
      Tutee = require("../models/tutee");

module.exports = function(reqBody, tutee) {
  return new Promise(function(resolve, reject) {
    tutee.courses = tutee.courses.filter(c => tutee.tutorSessions.find(s => s.courses.includes(c)) ? false : true);
    if (tutee.courses.length == 0) {
      resolve({type: "error", msg: "The tutee is already paired in every course they requested."});
    } else if (reqBody.pairMethod == "forAllCourses") {
      /* automatic pairing for as many courses as possible */
      if (reqBody.pairType == "auto") {
        var matchingTutor = null, alreadyTutorsThisTutee = false, matchingTutorAlreadyTutorsThisTutee = false, pairMsg = [], pairedTutors = [];
        Tutor.find({courses: {$in: tutee.courses}, paymentForm: {$in: tutee.paymentForm == ["Both"] ? ["Cash", "Both"] : ["Both"]},
        verified: true, verifiedPhone: true, active: true}).lean().exec(function(err, tutors) {
          /* pairs the tutee with matching tutor(s), with priority given to:
             1) tutors who already tutor this tutee, 2) who share the most courses with this tutee, and 3) who are tutoring the least tutees */
          tutee.courses.forEach(function(course) {
            tutors.forEach(function(tutor) {
              alreadyTutorsThisTutee = tutor.tuteeSessions.find(s => s.tuteeID == tutee._id) || pairedTutors.find(t => t._id == tutor._id) ? true : false;
              if (matchingTutor)
                matchingTutorAlreadyTutorsThisTutee = matchingTutor.tuteeSessions.find(s => s.tuteeID == tutee._id)
                || pairedTutors.find(t => t._id == matchingTutor._id) ? true : false;
              if (tutor.courses.includes(course) && tutor.id != tutee.id && (tutor.tuteeSessions.length < tutor.maxTutees || alreadyTutorsThisTutee)
                  && (!matchingTutor || alreadyTutorsThisTutee || (!matchingTutorAlreadyTutorsThisTutee
                  && (tutor.mutualCourses.length > matchingTutor.mutualCourses.length || (tutor.mutualCourses.length == matchingTutor.mutualCourses.length
                  && tutor.tuteeSessions.length < matchingTutor.tuteeSessions.length)))))
                    matchingTutor = tutor;
            });
            if (matchingTutor) {
              if (!pairedTutors.find(t => t._id == matchingTutor._id)) {
                matchingTutor.pairedCourses = [course];
                pairedTutors.push(matchingTutor);
              } else
                pairedTutors.find(t => t._id == matchingTutor._id).pairedCourses.push(course);
              matchingTutor = null;
            }
          });
          /* updates the database & notifies the tutor(s) */
          if (pairedTutors.length > 0) {
            var pairedMsgs = [];
            pairedTutors.forEach(function(pairedTutor) {
              updateDatabase(pairedTutor, tutee, pairedTutor.pairedCourses);
              notifyTutor(pairedTutor, tutee, pairedTutor.pairedCourses);
              pairedMsgs.push("<a class='link--white' href='/tutors/" + pairedTutor._id + "?from=%2Ftutees%2F" + tutee._id +"'>tutor "
              + pairedTutor.name + "</a> for " + utils.arrayToSentence(pairedTutor.pairedCourses.map(c => utils.reformatCourse(c))));
            });
            resolve({type: "success", msg: "Successfully paired this tutee with " + utils.arrayToSentence(pairedMsgs) + "."});
          } else
            resolve({type: "info", msg: "No available tutors were found."});
        });
      /* manual pairing for as many courses as possible */
      } else if (reqBody.pairType == "manual") {
        if (!reqBody.pairID || !new RegExp(/^\d{9}$/).test(reqBody.pairID))
          resolve({type: "error", msg: "Please enter a valid 9-digit student ID."});
        Tutor.findOne({id: reqBody.pairID}, function(err, tutor) {
          if (!tutor)
            return resolve({type: "error", msg: "There are no tutors with that ID."});
          if (tutor.id == tutee.id)
            return resolve({type: "error", msg: "The tutor and tutee have the same ID."});
          /* ensures the specified tutor is compatible with the tutee */
          var incompatibleMsg = [];
          if (!tutor.verified || !tutor.verifiedPhone)
            incompatibleMsg.push(" is not verified");
          if (!tutor.active)
            incompatibleMsg.push(" is deactivated");
          if (tutor.tuteeSessions.filter(s => s.status != "Inactive").length >= tutor.maxTutees
          && !tutor.tuteeSessions.filter(s => s.status != "Inactive").find(s => s.tuteeID == tutee._id))
            incompatibleMsg.push(" has already surpassed their maximum tutee limit");
          if (tutor.paymentForm == "Cash" && tutee.paymentForm == "Service")
            incompatibleMsg.push(" has a conflicting payment form with the tutee");
          if (tutor.courses.filter(c => tutee.courses.includes(c)).length == 0)
            incompatibleMsg.push(" shares no courses with the tutee");
          if (incompatibleMsg.length > 0)
            return resolve({type: "error", msg: "The specified tutor" + utils.arrayToSentence(incompatibleMsg) + "."});
          /* pairs them in all mutual courses & notifies the tutor */
          var pairedCourses = tutor.courses.filter(c => tutee.courses.includes(c));
          updateDatabase(tutor, tutee, pairedCourses);
          notifyTutor(tutor, tutee, pairedCourses);
          return resolve({type: "success", msg: "Successfully paired this tutee with <a class='link--white' href='/tutors/" + tutor._id + "?from=%2Ftutees%2F"
          + tutee._id + "'>tutor " + tutor.name + "</a> for " + utils.arrayToSentence(pairedCourses.map(c => utils.reformatCourse(c))) + "."});
        });
      } else
        return resolve({type: "error", msg: "An unexpected error occurred."});
    /* pairing by course */
    } else if (reqBody.pairMethod == "byCourse") {
      if (!reqBody.courses)
        return resolve({type: "error", msg: "No courses were selected, so the tutee was not paired."});
      reqBody.courses = Array.isArray(reqBody.courses) ? reqBody.courses : [reqBody.courses];
      reqBody.courses = reqBody.courses.filter(c => tutee.courses.includes(c));
      if (reqBody.courses.length == 0 || !reqBody.courses.every(c => reqBody[c] ? true : false))
        return resolve({type: "error", msg: "An unexpected error occurred."});
      var matchingTutor = null, pairedTutors = [];
      Tutor.find({}, function(err, tutors) {
        reqBody.courses.forEach(function(course) {
          /* if pairing is manual for the course */
          if (reqBody[course].pairType == "manual" && reqBody[course].pairID) {
            matchingTutor = tutors.find(t => t.id == reqBody[course].pairID);
            if (matchingTutor && matchingTutor.active && matchingTutor.verified && matchingTutor.verifiedPhone && matchingTutor.courses.includes(course)
            && matchingTutor.id != tutee.id && (matchingTutor.paymentForm == "Both" || tutee.paymentForm == "Both")
            && (!matchingTutor.tuteeSessions.filter(s => s.status != "Inactive").length >= matchingTutor.maxTutees
            || matchingTutor.tuteeSessions.filter(s => s.status != "Inactive").find(s => s.tuteeID == tutee._id))) {
              if (!pairedTutors.find(t => t._id == matchingTutor._id)) {
                matchingTutor.pairedCourses = [course];
                pairedTutors.push(matchingTutor);
              } else
                pairedTutors.find(t => t._id == matchingTutor._id).pairedCourses.push(course);
            }
            matchingTutor = null;
          /* if pairing is auto for the course */
          } else if (reqBody[course].pairType == "auto") {
            tutors.forEach(function(tutor) {
              alreadyTutorsThisTutee = tutor.tuteeSessions.find(s => s.tuteeID == tutee._id) || pairedTutors.find(t => t._id == tutor._id) ? true : false;
              if (matchingTutor)
                matchingTutorAlreadyTutorsThisTutee = matchingTutor.tuteeSessions.find(s => s.tuteeID == tutee._id)
                || pairedTutors.find(t => t._id == matchingTutor._id) ? true : false;
              if (tutor.courses.includes(course) && tutor.id != tutee.id && (tutor.tuteeSessions.length < tutor.maxTutees || alreadyTutorsThisTutee)
              && (!matchingTutor || alreadyTutorsThisTutee || (!matchingTutorAlreadyTutorsThisTutee
              && (tutor.mutualCourses.length > matchingTutor.mutualCourses.length || (tutor.mutualCourses.length == matchingTutor.mutualCourses.length
              && tutor.tuteeSessions.length < matchingTutor.tuteeSessions.length)))))
                    matchingTutor = tutor;
            });
            if (matchingTutor) {
              if (!pairedTutors.find(t => t._id == matchingTutor._id)) {
                matchingTutor.pairedCourses = [course];
                pairedTutors.push(matchingTutor);
              } else
                pairedTutors.find(t => t._id == matchingTutor._id).pairedCourses.push(course);
              matchingTutor = null;
            }
          }
        });
        /* updates the database & notifies the tutor(s) */
        if (pairedTutors.length > 0) {
          var pairedMsgs = [];
          pairedTutors.forEach(function(pairedTutor) {
            updateDatabase(pairedTutor, tutee, pairedTutor.pairedCourses);
            notifyTutor(pairedTutor, tutee, pairedTutor.pairedCourses);
            pairedMsgs.push("<a class='link--white' href='/tutors/" + pairedTutor._id + "?from=%2Ftutees%2F" + tutee._id +"'>tutor "
            + pairedTutor.name + "</a> for " + utils.arrayToSentence(pairedTutor.pairedCourses.map(c => utils.reformatCourse(c))));
          });
          resolve({type: "success", msg: "Successfully paired this tutee with " + utils.arrayToSentence(pairedMsgs) + "."});
        } else
          resolve({type: "info", msg: "No available tutors were found. Make sure manual pairings were with available tutors."});
      });
    } else
      resolve({type: "error", msg: "An unexpected error occurred."});
  });
}

function updateDatabase(tutor, tutee, courses) {
  courses = Array.isArray(courses) ? courses : [courses];
  var pairedBefore = tutee.tutorSessions.find(tutorSession => tutorSession.tutorID == tutor._id) ? true : false;
  var currentDate = utils.getCurrentDate("mm-dd-yyyy, 00:00:00");
  if (pairedBefore) {
    Tutee.findByIdAndUpdate(tutee._id, {$push: {"tutorSessions.$[element].courses": {$each: courses}}}, {arrayFilters: [{"element.tutorID": tutor._id}]}).exec();
    Tutor.findByIdAndUpdate(tutor._id, {$push: {"tuteeSessions.$[element].courses": {$each: courses}},
    "tuteeSessions.$[element].lastNotified": currentDate}, {arrayFilters: [{"element.tuteeID": tutee._id}]}).exec();
  } else {
    Tutee.findByIdAndUpdate(tutee._id, {$push: {"tutorSessions": {tutorID: tutor._id, courses: courses, status: "Pending"}}}).exec();
    Tutor.findByIdAndUpdate(tutor._id, {$push: {"tuteeSessions": {tuteeID: tutee._id, courses: courses, status: "Pending",
    firstNotified: currentDate, lastNotified: currentDate}}}).exec();
  }
}

function notifyTutor(tutor, tutee, courses) {
  courses = Array.isArray(courses) ? courses : [courses];
  var pairedBefore = tutee.tutorSessions.find(s => s.tutorID == tutor._id) ? true : false;
  if (pairedBefore) {
    var message = "Tutee " + tutee.name + ", who you were already paired with, has requested help in additional courses you cover: "
    + utils.arrayToSentence(courses.map(c => utils.reformatCourse(c)));
  } else {
    var message = "CSF has successfully paired you with a tutee! Their information is below.\n\nTutee Information:\nName - " + tutee.name
    + "\nPhone - " + tutee.phoneNum + "\nNeeds help with " + utils.arrayToSentence(courses.map(c => utils.reformatCourse(c)))
    + "\n\nParent Information:\nName - " + tutee.parentName + "\nPhone - " + tutee.parentPhoneNum + "\nForm of Payment - " + tutee.paymentForm
    + "\n\nTo accept this pairing, go to " + keys.siteData.url + "/tutors/" + tutor._id + "/accept-pairing/" + tutee._id
    + "\n*If this match does not work out, please contact us so you can be assigned to someone else!\n\nRemember to:\n1. Call the parent first, ASAP!"
    + "\n2. Tell them what form of payment you are asking for and make sure it matches what they have requested.\n3. Set up meeting times."
    + "\n4. Log your meetings.\n5. Contact us when the student no longer needs your services!";
  }
  sns.sendSMS(message, tutor.phoneNum);
}
