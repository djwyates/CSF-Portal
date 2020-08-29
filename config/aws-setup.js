const AWS = require("aws-sdk"),
      keys = require("./keys");

AWS.config.update({
    accessKeyId: keys.aws.accessKeyId,
    secretAccessKey: keys.aws.secretAccessKey,
    region: keys.aws.region
});
