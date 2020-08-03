/* eslint-disable no-unused-vars */

const URL_SCHEME = 'https://';
const URL_BASE = '.multibaas.com/api/v0/';
const HTTP_GET = 'GET';
const HTTP_POST = 'POST';

// Property keys for deployment ID and API key.
const PROP_MB_DEPLOYMENT_ID = 'mbDeploymentId';
const PROP_MB_API_KEY = 'mbApiKey';

// NOTE: On test "PropertiesService.getDocumentProperties()" cannot be used
// and on running as Add-On after installed "fallbackProperties" cannot be written(read only).
let fallbackProperties = {};

function setProperty(key, value) {
  const properties = PropertiesService.getDocumentProperties();
  if (properties) {
    properties.setProperty(key, value);
  } else {
    fallbackProperties[key] = value;
  }
}

function getProperty(key) {
  const properties = PropertiesService.getDocumentProperties();
  return properties ? properties.getProperty(key) : fallbackProperties[key];
}

function deleteAllProperties() {
  const properties = PropertiesService.getDocumentProperties();
  if (properties) {
    properties.deleteAllProperties();
  } else {
    fallbackProperties = {};
  }
}
