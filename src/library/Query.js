// Copyright (c) 2020 Curvegrid Inc.

/* eslint-disable no-unused-vars */

function checkLimit(limit) {
  if (!limit) {
    return 0;
  }

  if (limit === 'all') {
    return Infinity;
  }

  return limit;
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
  if (limitChecked > separationLimit) {
    const results = {
      status: null,
      message: null,
      result: {
        rows: [],
      },
    };

    let offsetNext = offset;
    while (true) {
      // validate and normalize limit and offset
      const queryOptions = buildQueryOptions(separationLimit, offsetNext, address);

      // query
      const queryResult = query(httpMethod, deployment, apiKey, queryPath + queryOptions, payload);
      results.status = queryResult.status;
      results.message = queryResult.message;

      const currentLength = queryResult.result.rows.length;
      const preLength = results.result.rows.length + queryResult.result.rows.length;
      if (currentLength < 1) {
        break;
      } else if (preLength > limitChecked) {
        // Get rid of the overflowed if actual data is more than limitChecked(limit)
        const cutOff = currentLength - (preLength - limitChecked);
        results.result.rows.push(...queryResult.result.rows.slice(0, cutOff));
        break;
      } else {
        results.result.rows.push(...queryResult.result.rows);
      }

      offsetNext += separationLimit;
    }

    return results;
  }

  const queryOptions = buildQueryOptions(limit, offset, address);
  return query(httpMethod, deployment, apiKey, queryPath + queryOptions, payload);
}
