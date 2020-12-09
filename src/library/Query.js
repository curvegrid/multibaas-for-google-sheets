// Copyright (c) 2020 Curvegrid Inc.

/* eslint-disable no-unused-vars */

function checkLimit(limit) {
  if (!limit) {
    return 10;
  }

  if (limit < 0) {
    return Infinity;
  }

  return limit;
}

function checkOffset(offset) {
  if (!offset || offset < 0) {
    return 0;
  }

  return offset;
}

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

  if (payload && payload !== '{}') {
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
  const separationLimit = 30;
  const limitChecked = checkLimit(limit);
  const offsetChecked = checkOffset(offset);
  const results = {
    status: null,
    message: null,
  };
  // MBQUERY, MBCUSTOMQUERY has rows in result but MBEVENTS has not
  const hasRows = !/^events$/.test(queryPath);
  const rows = [];

  let offsetNext = offsetChecked;
  while (true) {
    // validate and normalize limit and offset
    const queryOptions = buildQueryOptions(separationLimit, offsetNext, address);

    // query
    const queryResult = query(httpMethod, deployment, apiKey, queryPath + queryOptions, payload);
    results.status = queryResult.status;
    results.message = queryResult.message;

    const queryRows = hasRows ? queryResult.result.rows : queryResult.result;
    const queryRowsLength = queryRows.length;
    const overflowedLength = (rows.length + queryRowsLength) - limitChecked;
    if (queryRowsLength < 1) {
      break;
    } else if (overflowedLength > 0) {
      // Get rid of the overflowed if actual data is more than limitChecked(limit)
      const cutOff = queryRowsLength - overflowedLength;
      rows.push(...queryRows.slice(0, cutOff));
      break;
    } else {
      rows.push(...queryRows);
    }

    offsetNext += separationLimit;
  }

  results.result = hasRows ? { rows } : rows;

  return results;
}
