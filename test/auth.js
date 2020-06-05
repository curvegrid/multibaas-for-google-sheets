const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');

// If modifying these scopes, delete credentials.json.
const SCOPES = [
  'https://www.googleapis.com/auth/script.external_request',
  'https://www.googleapis.com/auth/spreadsheets',
];
const CREDENTIALS_PATH = '../.credentials.json';
const CLIENT_SECRET_PATH = '../.client-secret.json';

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(scopes, oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });
  console.log(`authorize this app by visiting this url: ${authUrl}`);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (tokenError, token) => {
      if (tokenError) {
        return callback(tokenError);
      }

      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(CREDENTIALS_PATH, JSON.stringify(token), (fileError) => {
        if (fileError) {
          console.error(fileError);
        }
        console.log(`token stored to ${CREDENTIALS_PATH}`);
      });
      callback(oAuth2Client);
      return undefined;
    });
  });
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(scopes, credentials, callback) {
  // eslint-disable-next-line camelcase
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(CREDENTIALS_PATH, (err, token) => {
    if (err) {
      return getAccessToken(scopes, oAuth2Client, callback);
    }

    console.log('!!!!!!!!!!!!!!!!!!!!');
    const test = JSON.parse(token);
    console.log(test);
    // oAuth2Client.setCredentials(JSON.parse(token));
    oAuth2Client.setCredentials({ refresh_token: test.refresh_token });
    callback(oAuth2Client);
    return undefined;
  });
}

// Load and return client secrets from a local file
// @param scopes [Array] A list of auth scopes (optional)
// @return {google.auth.OAuth2} An authorized OAuth2 client
module.exports.authenticate = (scopes = SCOPES) => new Promise((resolve, reject) => {
  // Load client secrets from a local file.
  fs.readFile(CLIENT_SECRET_PATH, (err, credentials) => {
    if (err) {
      reject(err);
    }

    // Authorize a client with credentials, then call the Google Drive API.
    authorize(scopes, JSON.parse(credentials), resolve);
  });
});
