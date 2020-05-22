const fs = require('fs');
const { google } = require('googleapis');
const { authenticate } = require('./auth');

const SCRIPT_ID = '../.clasp.json';

/**
 * Call the gastTestRunner test function on the deployed script.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @return [Number] Exit with the number of failed tests
 */
function callAppsScript(auth) {
  const script = google.script({ version: 'v1' });
  const { scriptId } = JSON.parse(fs.readFileSync(SCRIPT_ID));
  // const scriptId = 'MtDr1UdkQnLhMy25WAaFVSuct06epg9QC';

  // TODO: Do we need to wait for a while to update apps script api
  // because it fails (entity not found) after clasp push
  const request = {
    function: 'mbTestRunner',
    parameters: [],
    devMode: false,
  };

  script.scripts.run({ auth, scriptId, resource: request }, (err, resp) => {
    if (err) {
      // The API encountered a problem before the script started executing.
      console.error(`api returned an error: ${err}`);
      process.exit(1);
    }
    if (resp.error) {
      // The API executed, but the script returned an error.

      // Extract the first (and only) set of error details. The values of this
      // object are the script's 'errorMessage' and 'errorType', and an array
      // of stack trace elements.
      const [errorDetail] = resp.error.details;
      console.error(`script error message: ${errorDetail.errorMessage}`);
      console.error('script error stacktrace:');

      if (errorDetail.scriptStackTraceElements) {
        // There may not be a stacktrace if the script didn't start executing.
        for (let i = 0; i < errorDetail.scriptStackTraceElements.length; i += 1) {
          const trace = errorDetail.scriptStackTraceElements[i];
          console.error('\t%s: %s', trace.function, trace.lineNumber);
        }
      }
      process.exit(1);
    } else {
      console.log(resp.data);
      // const data = resp.data.response.result;
      // const { log } = data;
      // console.log(log);
      // const failureCount = data.failures;
      // process.exit(failureCount);
    }
  });
}

authenticate().then((auth) => callAppsScript(auth));