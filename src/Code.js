// Copyright (c) 2020 Curvegrid Inc.

/* eslint-disable no-unused-vars */

function setDeploymentId() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    'Set Deployment ID',
    'Please enter the deployment host\n'
    + ` (i.e. "https://xxxxxxxxxxxxxxxxxxxxxxxxxx.${DEPLOYMENT_DOMAIN}/"):`,
    ui.ButtonSet.OK_CANCEL,
  );

  const button = result.getSelectedButton();
  const text = result.getResponseText();
  if (button === ui.Button.OK) {
    try {
      const deploymentId = getDeploymentId(text);
      validateDeploymentId(deploymentId);
      setProperty(PROP_MB_DEPLOYMENT_ID, deploymentId);
    } catch (e) {
      ui.alert(e.message);
    }
  }
}

function setApiKey() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    'Set API Key',
    'Please enter the API key:',
    ui.ButtonSet.OK_CANCEL,
  );

  const button = result.getSelectedButton();
  const text = result.getResponseText();
  if (button === ui.Button.OK) {
    try {
      validateApiKey(text);
      setProperty(PROP_MB_API_KEY, text);
    } catch (e) {
      ui.alert(e.message);
    }
  }
}

function resetCredentials() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    'Are you sure you want to reset the Deployment ID and API key?',
    ui.ButtonSet.YES_NO,
  );

  if (result === ui.Button.YES) {
    deleteAllProperties();
  }
}

function refreshCurrentCell() {
  const ui = SpreadsheetApp.getUi();

  if (!credentialsExist()) {
    ui.alert('Credentials are invalid. Please see https://www.curvegrid.com/docs/17-2-setup-add-on-api-key/ and https://www.curvegrid.com/docs/17-3-setup-add-on-deployment-id/');
    return;
  }

  const range = SpreadsheetApp.getActiveRange();
  const cell = range.getCell(1, 1);
  const value = cell.getValue();
  const formula = cell.getFormula();

  if (!value && !formula) {
    SpreadsheetApp.getUi()
      .alert('No data in the cell you selected. Please see https://www.curvegrid.com/docs/17-4-functions/');
    return;
  }

  cell.setValue('');
  SpreadsheetApp.flush();
  if (formula !== '') {
    cell.setFormula(formula);
  } else {
    cell.setValue(value);
  }
  SpreadsheetApp.flush();
}

function postToBlockchain() {
  const ui = SpreadsheetApp.getUi();

  if (!credentialsExist()) {
    ui.alert('Credentials are invalid. Please see https://www.curvegrid.com/docs/17-2-setup-add-on-api-key/ and https://www.curvegrid.com/docs/17-3-setup-add-on-deployment-id/');
    return;
  }

  const MIN_COLUMNS = 5;
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = SpreadsheetApp.getActiveRange();

  if (range.getNumColumns() < MIN_COLUMNS) {
    ui.alert(`${range.getNumColumns()} selected column(s) is fewer than the minimum of ${MIN_COLUMNS} columns.
      Please see https://www.curvegrid.com/docs/17-4-functions/`);
    return;
  }

  const values = range.getValues();
  // NOTE: see MBPOSTTEMPLATE(numArgs) to understand slicing
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const [address, contract, method, from, signer] = row.slice(0, 5);

    let args = [];
    if (row.length > MIN_COLUMNS) {
      args = row.slice(MIN_COLUMNS, row.length);
    }

    const queryPath = `chains/ethereum/addresses/${address}/contracts/${contract}/methods/${method}`;

    // build args
    const signAndSubmit = true;
    const payload = buildMethodArgs(args, from, signer, signAndSubmit);

    let results;
    try {
      results = query(
        HTTP_POST,
        getProperty(PROP_MB_DEPLOYMENT_ID),
        getProperty(PROP_MB_API_KEY),
        queryPath,
        payload,
      );
    } catch (e) {
      console.error(e);
      ui.alert(e.message);
      return;
    }

    const output = JSON.stringify(results.result.tx);
    console.log(`Results: ${output}`);

    // output tx hash
    sheet
      .getRange(range.getRow() + i, range.getColumn() + range.getNumColumns(), 1, 1)
      .setValue(results.result.tx.hash);
    SpreadsheetApp.flush();
  }
}

function showAbout() {
  const ui = SpreadsheetApp.getUi();
  const deploymentId = getProperty(PROP_MB_DEPLOYMENT_ID);
  const deploymentUrl = deploymentId ? `https://${deploymentId}.${DEPLOYMENT_DOMAIN}` : 'no value set';

  ui.alert(
    'MultiBaas for Google Sheets\n'
    + `Version ${VERSION}\n`
    + `Deployment URL: ${deploymentUrl}`,
  );
}

/**
 * Add menu
 */
function onOpen() {
  SpreadsheetApp.getUi() // Or DocumentApp, SlidesApp, or FormApp.
    .createMenu('Custom Menu')
    .addItem('Set Deployment ID', 'setDeploymentId')
    .addItem('Set API Key', 'setApiKey')
    .addItem('Reset Credentials', 'resetCredentials')
    .addItem('Post to the blockchain', 'postToBlockchain')
    .addItem('Refresh current cell', 'refreshCurrentCell')
    .addItem('About', 'showAbout')
    .addToUi();
}

/**
 * Create a template to be used with calling a smart contract method (function)
 * that will write to the blockchain.
 *
 * @param {number} numberOfArgs (Optional) Number of arguments (parameters)
 * to pass to the method (function). Default is 0.
 * @return {Array} A two dimensional array that can be used as the starting point for calling
 * a smart contract method.
 * @customfunction
 */
function MBPOSTTEMPLATE(numberOfArgs) {
  let numArgs = numberOfArgs;

  // validate and normalize parameters
  if (!numArgs) {
    numArgs = 0;
  } else if (!isNaturalNumber(numArgs)) {
    throw new Error('Number of arguments must be a valid positive integer');
  }

  const header = ['address', 'contract', 'method', 'from', 'signer'];
  for (let i = 0; i < numArgs; i++) {
    header.push(`input${String(i)}`);
  }
  header.push('txHash (output)');

  return [header];
}

/**
 * Retrieve a detailed list of a smart contract's events.
 *
 * @param {string} contract Smart contract label, must be associated with the address.
 * @param {string} filter (Optional) Regular expression (regex) to filter function names on.
 * @return {Array} Array of smart contract functions and their inputs and outputs.
 * @customfunction
 */
function MBEVENTLIST(contract, filter) {
  if (!contract) {
    throw new Error('Must provide a smart contract label');
  }

  const queryPath = `contracts/${contract}`;
  let results;
  try {
    results = query(
      HTTP_GET,
      getProperty(PROP_MB_DEPLOYMENT_ID),
      getProperty(PROP_MB_API_KEY),
      queryPath,
    );
  } catch (e) {
    throw new Error(e.message);
  }

  // turn the block structure into a flat array
  const includeOutputs = false;
  const output = functionsToArray(results.result.abi.events, 'event', filter, includeOutputs);
  console.log(`Results: ${JSON.stringify(output)}`);

  return output;
}

/**
 * Retrieve a detailed list of a smart contract's functions.
 *
 * @param {string} contract Smart contract label, must be associated with the address.
 * @param {string} filter (Optional) Regular expression (regex) to filter function names on.
 * @return {Array} Array of smart contract functions and their inputs and outputs.
 * @customfunction
 */
function MBFUNCTIONLIST(contract, filter) {
  if (!contract) {
    throw new Error('Must provide a smart contract label');
  }

  const queryPath = `contracts/${contract}`;
  let results;
  try {
    results = query(
      HTTP_GET,
      getProperty(PROP_MB_DEPLOYMENT_ID),
      getProperty(PROP_MB_API_KEY),
      queryPath,
    );
  } catch (e) {
    throw new Error(e.message);
  }

  // turn the block structure into a flat array
  const includeOutputs = true;
  const output = functionsToArray(results.result.abi.methods, 'function', filter, includeOutputs);
  console.log(`Results: ${JSON.stringify(output)}`);

  return output;
}

/**
 * Retrieve the details of a blockchain transaction.
 *
 * @param {string} hash Transaction hash.
 * @param {boolean} headers (Optional) Include column headers. TRUE/FALSE, defaults to TRUE.
 * @return {Array} Transaction details.
 * @customfunction
 */
function MBTX(hash, headers) {
  try {
    validateBlockTxHash(hash);
  } catch (e) {
    throw new Error(e.message);
  }

  const isHeaders = clampBool(headers, true);

  const queryPath = `chains/ethereum/transactions/${hash}`;
  let results;
  try {
    results = query(
      HTTP_GET,
      getProperty(PROP_MB_DEPLOYMENT_ID),
      getProperty(PROP_MB_API_KEY),
      queryPath,
    );
  } catch (e) {
    throw new Error(e.message);
  }

  // turn the block structure into a flat array
  const output = txToArray(results.result, isHeaders);
  console.log(`Results: ${JSON.stringify(output)}`);

  return output;
}

/**
 * Retrieve the details of a block.
 *
 * @param {number} numberOrHash Block number or hash.
 * @param {string} headers (Optional) Include column headers. TRUE/FALSE, defaults to TRUE.
 * @param {string} txHashes (Optional) Include the transaction hashes. TRUE/FALSE,
 * defaults to TRUE.
 * @return {Array} Block details.
 * @customfunction
 */
function MBBLOCK(numberOrHash, headers, txHashes) {
  try {
    validateBlockNumOrHash(numberOrHash);
  } catch (e) {
    throw new Error(e.message);
  }

  const isHeaders = clampBool(headers, true);
  const isTxHashes = clampBool(txHashes, true);

  const queryPath = `chains/ethereum/blocks/${numberOrHash}`;
  let results;
  try {
    results = query(
      HTTP_GET,
      getProperty(PROP_MB_DEPLOYMENT_ID),
      getProperty(PROP_MB_API_KEY),
      queryPath,
    );
  } catch (e) {
    throw new Error(e.message);
  }

  // turn the block structure into a flat array
  const output = blockToArray(results.result, isHeaders, isTxHashes);
  console.log(`Results: ${JSON.stringify(output)}`);

  return output;
}

/**
 * A common function for MBADDRESS, MBADDRESSATBLOCK, MBADDRESSATTIME
 *
 * @param {number} block Ethereum block number.
 * @param {number} time Used to retrieve the details at time.
 * @param {string} address Ethereum address or label.
 * @param {boolean} headers (Optional) Include column headers. TRUE/FALSE, defaults to TRUE.
 * @param {boolean} code (Optional) Include the smart contract bytecode deployed at the address,
 * if any. TRUE/FALSE, defaults to FALSE.
 * @return {Array} Address details.
 */
function mbaddressCommon(block, time, address, headers, code) {
  if (!address) {
    throw new Error('Must provide an address or address label');
  }

  const isHeaders = clampBool(headers, true);
  const isCode = clampBool(code, false);
  const queryCode = isCode ? '&include=code' : '';
  const queryBlock = block !== null ? `&block_number=${block}` : '';
  const queryTime = time !== null ? `&timestamp=${convertDateTimeToUTC(time)}` : '';
  const queryPath = `chains/ethereum/addresses/${address}?include=balance${queryCode}${queryBlock}${queryTime}`;
  let results;
  try {
    results = query(
      HTTP_GET,
      getProperty(PROP_MB_DEPLOYMENT_ID),
      getProperty(PROP_MB_API_KEY),
      queryPath,
    );
  } catch (e) {
    throw new Error(e.message);
  }

  // turn the address structure into a flat array
  const output = addressToArray(results.result, isHeaders, isCode);
  console.log(`Results: ${JSON.stringify(output)}`);

  return output;
}

/**
 * Retrieve the details of a blockchain address.
 *
 * @param {address} address Ethereum address or label.
 * @param {headers} headers (Optional) Include column headers. TRUE/FALSE, defaults to TRUE.
 * @param {code} code (Optional) Include the smart contract bytecode deployed at the address,
 * if any. TRUE/FALSE, defaults to FALSE.
 * @return {Array} Address details.
 * @customfunction
 */
function MBADDRESS(address, headers, code) {
  return mbaddressCommon(null, null, address, headers, code);
}

/**
 * Retrieve the details of a blockchain address at a block number.
 *
 * @param {block} block Ethereum block number.
 * @param {address} address Ethereum address or label.
 * @param {headers} headers (Optional) Include column headers. TRUE/FALSE, defaults to TRUE.
 * @param {code} code (Optional) Include the smart contract bytecode deployed at the address,
 * if any. TRUE/FALSE, defaults to FALSE.
 * @return {Array} Address details.
 * @customfunction
 */
function MBADDRESSATBLOCK(block, address, headers, code) {
  if (!Number.isInteger(block)) {
    throw new Error('Must provide a block as integer');
  }

  return mbaddressCommon(block, null, address, headers, code);
}

/**
 * Retrieve the details of a blockchain address at time.
 *
 * @param {time} time Used to retrieve the details at time.
 * @param {address} address Ethereum address or label.
 * @param {headers} headers (Optional) Include column headers. TRUE/FALSE, defaults to TRUE.
 * @param {code} code (Optional) Include the smart contract bytecode deployed at the address,
 * if any. TRUE/FALSE, defaults to FALSE.
 * @return {Array} Address details.
 * @customfunction
 */
function MBADDRESSATTIME(time, address, headers, code) {
  if (!time) {
    throw new Error('Must provide time');
  }

  return mbaddressCommon(null, time, address, headers, code);
}

/**
 * Retrieve the results of a MultiBaas Event Query.
 *
 * @param {string} query Event Query name to return results from.
 * @param {number} limit (Optional) Number of results to return. -1 for all results.
 * @param {number} offset (Optional) Offset from the 0th result to return.
 * @return {Array} A two dimensional array with the results of the Event Query.
 * @customfunction
 */
function MBQUERY(query, limit, offset) {
  if (!query) {
    throw new Error('Must provide an Event Query name');
  }

  const queryPath = `queries/${query}/results`;
  let results;
  try {
    results = limitQuery(
      HTTP_GET,
      getProperty(PROP_MB_DEPLOYMENT_ID),
      getProperty(PROP_MB_API_KEY),
      queryPath,
      limit,
      offset,
    );
  } catch (e) {
    throw new Error(e.message);
  }
  console.log(`Results: ${JSON.stringify(results)}`);

  // turn the array of objects into a flat array
  const objArr = results.result.rows;
  return objectArrayToArray(objArr);
}

/**
 * Retrieve the results of a custom MultiBaas Event Query.
 *
 * @param {Array} events Two dimensional array of event names, selectors and filters.
 * @param {string} groupBy (Optional) Field to group by.
 * @param {string} orderBy (Optional) Field to order by.
 * @param {number} limit (Optional) Number of results to return. -1 for all results.
 * @param {number} offset (Optional) Offset from the 0th result to return.
 * @return {Array} A two dimensional array with the results of the Event Query.
 * @customfunction
 */
function MBCUSTOMQUERY(events, groupBy, orderBy, limit, offset) {
  if (!events) {
    throw new Error('Must provide an events definition');
  }

  const queryPath = 'queries';
  let payload;
  try {
    payload = buildCustomQuery(events, groupBy, orderBy, limit, offset);
  } catch (e) {
    throw new Error(e.message);
  }

  let results;
  try {
    results = limitQuery(
      HTTP_POST,
      getProperty(PROP_MB_DEPLOYMENT_ID),
      getProperty(PROP_MB_API_KEY),
      queryPath,
      limit,
      offset,
      payload,
    );
  } catch (e) {
    throw new Error(e.message);
  }
  console.log(`Results: ${JSON.stringify(results)}`);

  const headers = [];
  let numEmptyColumns;
  // eslint-disable-next-line no-restricted-syntax, guard-for-in
  for (let col = 0; numEmptyColumns < payload.events.length; col++) {
    numEmptyColumns = 0;
    // eslint-disable-next-line no-restricted-syntax
    for (const event of payload.events) {
      if (event.select[col]) {
        headers.push(event.select[col].alias);
      } else {
        numEmptyColumns++;
      }
    }
  }

  const objArr = results.result.rows;

  // turn the array of objects into a flat array
  return objectArrayToArray(objArr, headers);
}

/**
 * Create a template to be used with a custom MultiBaas Event Query.
 *
 * @param {number} numberOfSelects (Optional) Number of 'select' groups
 * to create. Default is 1.
 * @param {number} numberOfFilters (Optional) Number of 'filter' groups
 * to create. Default is 1.
 * @return {Array} A two dimensional array that can be used as the starting point
 * for a custom Event Query.
 * @customfunction
 */
function MBCUSTOMQUERYTEMPLATE(numberOfSelects, numberOfFilters) {
  let numSelects = numberOfSelects;
  let numFilters = numberOfFilters;

  // validate and normalize parameters
  if (!numSelects) {
    numSelects = 1;
  } else if (!isNaturalNumber(numSelects)) {
    throw new Error("Number of 'select' groups must be a valid positive integer");
  }
  if (!numFilters) {
    // Default is no filter
    numFilters = 0;
  } else if (!isNaturalNumber(numFilters)) {
    throw new Error("Number of 'filter' groups must be a valid positive integer or zero");
  }

  let header = ['eventName'];
  for (let i = 0; i < numSelects; i++) {
    header = header.concat(['alias', 'index', 'aggregator']);
  }
  for (let i = 0; i < numFilters; i++) {
    header = header.concat(['rule', 'operand', 'operator', 'value']);
  }

  return [header];
}

/**
 * Retrieve blockchain events. Address must be associated with one or more contracts in MultiBaas.
 *
 * @param {string} address Ethereum address or label.
 * @param {number} limit (Optional) Number of results to return. -1 for all results.
 * @param {number} offset (Optional) Offset from the 0th result to return.
 * @return {Array} A two dimensional array of events.
 * @customfunction
 */
function MBEVENTS(address, limit, offset) {
  if (!address) {
    throw new Error('Must provide an address or address label');
  }

  const queryPath = 'events';
  let results;
  try {
    results = limitQuery(
      HTTP_GET,
      getProperty(PROP_MB_DEPLOYMENT_ID),
      getProperty(PROP_MB_API_KEY),
      queryPath,
      limit,
      offset,
      undefined,
      address,
    );
  } catch (e) {
    throw new Error(e.message);
  }
  console.log(`Results: ${JSON.stringify(results)}`);

  // turn the events structure into a flat array
  const events = results.result;
  return eventsToArray(events);
}

/**
 * A common function for MBGET, MBGETATBLOCK, MBGETATTIME
 * @param {number} block Ethereum block number.
 * @param {number} time Used to retrieve the results at time.
 * @param {string} address Ethereum address or label.
 * @param {string} contract Smart contract label, must be associated with the address.
 * @param {string} method Smart contract function name.
 * @param {...any} args (Optional) Arguments to pass to the function.
 * @return One or more values returned from the function.
 */
function mbgetCommon(block, time, address, contract, method, ...args) {
  if (!address) {
    throw new Error('Must provide an address or address label');
  }
  if (!contract) {
    throw new Error('Must provide a smart contract label');
  }
  if (!method) {
    throw new Error('Must provide a method (function) name');
  }

  const queryPath = `chains/ethereum/addresses/${address}/contracts/${contract}/methods/${method}`;

  // build args
  const timestamp = time !== null ? convertDateTimeToUTC(time) : null;
  const payload = buildMethodArgs(args, null, null, null, null, block, timestamp);

  let results;
  try {
    results = query(
      HTTP_POST,
      getProperty(PROP_MB_DEPLOYMENT_ID),
      getProperty(PROP_MB_API_KEY),
      queryPath,
      payload,
    );
  } catch (e) {
    throw new Error(e.message);
  }
  const { output } = results.result;
  console.log(`Results: ${JSON.stringify(output)}`);

  return output;
}

/**
 * Retrieve the results of a smart contract function call.
 *
 * @param {address} address Ethereum address or label.
 * @param {contract} contract Smart contract label, must be associated with the address.
 * @param {method} method Smart contract function name.
 * @param {args} args (Optional) Arguments to pass to the function.
 * @return One or more values returned from the function.
 * @customfunction
 */
function MBGET(address, contract, method, ...args) {
  return mbgetCommon(null, null, address, contract, method, ...args);
}

/**
 * Retrieve the results of a smart contract function call at a block number.
 *
 * @param {block} block Ethereum block number.
 * @param {address} address Ethereum address or label.
 * @param {contract} contract Smart contract label, must be associated with the address.
 * @param {method} method Smart contract function name.
 * @param {args} args (Optional) Arguments to pass to the function.
 * @return One or more values returned from the function.
 * @customfunction
 */
function MBGETATBLOCK(block, address, contract, method, ...args) {
  if (!Number.isInteger(block)) {
    throw new Error('Must provide a block as integer');
  }

  return mbgetCommon(block, null, address, contract, method, ...args);
}

/**
 * Retrieve the results of a smart contract function call at time.
 *
 * @param {time} time Used to retrieve the results at time.
 * @param {address} address Ethereum address or label.
 * @param {contract} contract Smart contract label, must be associated with the address.
 * @param {method} method Smart contract function name.
 * @param {args} args (Optional) Arguments to pass to the function.
 * @return One or more values returned from the function.
 * @customfunction
 */
function MBGETATTIME(time, address, contract, method, ...args) {
  if (!time) {
    throw new Error('Must provide time');
  }

  return mbgetCommon(null, time, address, contract, method, ...args);
}

/**
 * Compose an unsigned transaction to call a smart contract function.
 *
 * @param {string} address Ethereum address or label.
 * @param {string} contract Smart contract label, must be associated with the address.
 * @param {string} method Smart contract function name.
 * @param {string} from From address.
 * @param {string} signer (Optional) Signer address. Defaults to the 'from' address.
 * @param {number} value (Optional) Value for amount of ETH sent.
 * @param {...any} args (Optional) Arguments to pass to the function.
 * @return {Object} An unsigned transaction, suitable for signing and submitting to the blockchain.
 * @customfunction
 */
function MBCOMPOSE(address, contract, method, from, signer, value, ...args) {
  const queryPath = `chains/ethereum/addresses/${address}/contracts/${contract}/methods/${method}`;

  // build args
  const payload = buildMethodArgs(args, from, signer, undefined, value);

  let results;
  try {
    results = query(
      HTTP_POST,
      getProperty(PROP_MB_DEPLOYMENT_ID),
      getProperty(PROP_MB_API_KEY),
      queryPath,
      payload,
    );
  } catch (e) {
    throw new Error(e.message);
  }
  const output = JSON.stringify(results.result.tx);
  console.log(`Results: ${output}`);

  return output;
}
