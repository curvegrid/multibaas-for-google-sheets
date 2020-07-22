// Copyright (c) 2020 Curvegrid Inc.

/* eslint-disable no-unused-vars */

function query(httpMethod, deployment, apiKey, qry, payload) {
  // validate and normalize deployment and API key
  const [deploymentNorm, apiKeyNorm] = normalizeCreds(deployment, apiKey);

  // query options
  const options = {
    method: httpMethod,
    contentType: 'application/json',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKeyNorm}`,
    },
  };

  if (payload !== undefined && payload !== '{}') {
    options.payload = JSON.stringify(payload);
  }

  // call the MultiBaas API
  const url = URL_SCHEME + deploymentNorm + URL_BASE + qry;
  console.log(`URL: ${url}`);
  console.log(`Payload: ${JSON.stringify(payload)}`);
  const response = UrlFetchApp.fetch(url, options);

  // pre-process the results
  const results = JSON.parse(response.getContentText());

  return results;
}

function limitQuery(httpMethod, deployment, apiKey, queryPath, limit, offset, payload, address) {
  // validate and normalize limit and offset
  const queryOptions = buildQueryOptions(limit, offset, address);

  // query
  const results = query(httpMethod, deployment, apiKey, queryPath + queryOptions, payload);

  return results;
}
