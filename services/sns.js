const AWS = require("aws-sdk"),
      snsJS = new AWS.SNS();

var sns = {};

sns.sendSMS = function(message, phoneNum, subject) {
  var params = {
    Message: message,
    PhoneNumber: phoneNum,
    MessageAttributes: {
      "AWS.SNS.SMS.SenderID": {
        DataType: "String",
        StringValue: subject
      },
    }
  };
  snsJS.publish(params, function(err, data) {
      if (err) console.error(err);
      else console.info("Successfully sent text message to " + phoneNum + ": " + message);
  });
}

module.exports = sns;
