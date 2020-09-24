const AWS = require("aws-sdk");
require("../config/aws-setup");
const snsJS = new AWS.SNS();

var sns = {};

sns.sendSMS = function(message, phoneNum) {
  phoneNum = phoneNum.replace(/-/g, "");
  var params = {
    Message: message,
    MessageStructure: "string",
    PhoneNumber: "+1" + phoneNum
  };
  snsJS.publish(params, function(err, data) {
      if (err) console.error(err);
      else console.info("Successfully sent text message to " + phoneNum);
  });
}

module.exports = sns;
