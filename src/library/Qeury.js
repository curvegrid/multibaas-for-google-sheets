// Copyright (c) 2020 Curvegrid Inc.

function query(httpMethod, deployment, apiKey, query, payload) {
  // validate and normalize deployment and API key
  deployment, apiKey = normalizeCreds(deployment, apiKey);

  // query options
  const options = {
    method: httpMethod,
    contentType: 'application/json',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  };

  if (payload !== undefined && payload !== '{}') {
    options.payload = JSON.stringify(payload);
  }

  // call the MultiBaas API
  const url = URL_SCHEME + deployment + URL_BASE + query;
  console.log(`URL: ${url}`);
  console.log(`Payload: ${JSON.stringify(payload)}`);
  const response = UrlFetchApp.fetch(url, options);


  // pre-process the results
  const results = JSON.parse(response.getContentText());

  return results;
}

function limitQuery(httpMethod, deployment, apiKey, queryPath, limit, offset, payload) {
  // validate and normalize limit and offset
  const limitOffset = buildLimitOffset(limit, offset);

  // query
  const results = query(httpMethod, deployment, apiKey, queryPath + limitOffset, payload);

  return results;
}
