/* Write credentials files with ENV variables */
const fs = require('fs');
const path = require('path');

const DOT_CLASPRC_FILE = path.join(process.env.HOME, '.clasprc.json');
const DOT_CLASP_FILE = '.clasp.json';
const CLIENT_SECRET_FILE = '.client-secret.json';
const CREDENTIALS_FILE = '.credentials.json';

const dotClasprc = {
  token: {
    access_token: process.env.CLASPRC_ACCESS_TOKEN,
    scope: process.env.CLASPRC_SCOPE,
    token_type: 'Bearer',
    id_token: process.env.CLASPRC_ID_TOKEN,
    expiry_date: process.env.CLASPRC_EXPIRY_DATE,
    refresh_token: process.env.CLASPRC_REFRESH_TOKEN,
  },
  oauth2ClientSettings: {
    clientId: process.env.CLASPRC_CLIENT_ID,
    clientSecret: process.env.CLASPRC_CLIENT_SECRET,
    redirectUri: process.env.CLASPRC_REDIRECT_URI,
  },
  isLocalCreds: false,
};

const dotClasp = {
  scriptId: process.env.SCRIPT_ID,
};

const clientSecret = {
  installed: {
    client_id: process.env.CLIENT_ID,
    project_id: process.env.PROJECT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    clientSecret: process.env.CLIENT_SECRET,
    redirect_uris: ['urn:ietf:wg:oauth:2.0:oob', 'http://localhost'],
  },
};

const credentials = {
  access_token: process.env.CLIENT_ACCESS_TOKEN,
  token_type: 'Bearer',
  refresh_token: process.env.CLIENT_REFRESH_TOKEN,
  expiry_date: process.env.CLIENT_EXPIRY_DATE,
};

function writeJSONFile(filename, content) {
  fs.writeFileSync(filename, JSON.stringify(content, null, 2));
}

writeJSONFile(DOT_CLASPRC_FILE, dotClasprc);
writeJSONFile(DOT_CLASP_FILE, dotClasp);
writeJSONFile(CLIENT_SECRET_FILE, clientSecret);
writeJSONFile(CREDENTIALS_FILE, credentials);
