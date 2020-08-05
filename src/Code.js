// Copyright (c) 2020 Curvegrid Inc.

/* eslint-disable no-unused-vars */

const VERSION = '1.0.0';

function setDeploymentId() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    'Set Deployment ID',
    'Please enter the deployment ID'
    + ' (i.e. for "https://xxxxxxxxxxxxxxxxxxxxxxxxxx.multibaas.com",'
    + ' just put "xxxxxxxxxxxxxxxxxxxxxxxxxx" only"):',
    ui.ButtonSet.OK_CANCEL,
  );

  const button = result.getSelectedButton();
  const text = result.getResponseText();
  if (button === ui.Button.OK) {
    try {
      validateDeploymentId(text);
      setProperty(PROP_MB_DEPLOYMENT_ID, text);
      ui.alert(`Deployment ID is ${text}`);
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
      setProperty(PROP_MB_API_KEY, text);
      ui.alert(`API key is ${text}`);
    } catch (e) {
      ui.alert(e.message);
    }
  }
}

function deleteAllSettings() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    'Are you sure to delete all settings?',
    ui.ButtonSet.YES_NO,
  );

  if (result === ui.Button.YES) {
    deleteAllProperties();
    ui.alert('Deployment ID and API key have been deleted');
  }
}

function refreshCurrentCell() {
  const ui = SpreadsheetApp.getUi();

  if (!credentialsExist()) {
    ui.alert('Credentials are invalid. Please see https://www.curvegrid.com/multibaas-for-google-sheets/credentials');
    return;
  }

  const range = SpreadsheetApp.getActiveRange();
  const cell = range.getCell(1, 1);
  const value = cell.getValue();
  const formula = cell.getFormula();

  if (!value && !formula) {
    SpreadsheetApp.getUi()
      .alert('No data in the cell you selected. Please see https://www.curvegrid.com/multibaas-for-google-sheets/refresh-current-cell');
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
    ui.alert('Credentials are invalid. Please see https://www.curvegrid.com/multibaas-for-google-sheets/credentials');
    return;
  }

  const MIN_COLUMNS = 5;
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = SpreadsheetApp.getActiveRange();

  if (range.getNumColumns() < MIN_COLUMNS) {
    ui.alert(`${range.getNumColumns()} selected column(s) is fewer than the minimum of ${MIN_COLUMNS} columns.
      Please see https://www.curvegrid.com/multibaas-for-google-sheets/post-to-the-blokchain`);
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

function showVersion() {
  SpreadsheetApp.getUi()
    .alert(`MultiBaas for Google Sheets Version ${VERSION}`);
}

/**
 * Add menu
 */
function onOpen() {
  SpreadsheetApp.getUi() // Or DocumentApp, SlidesApp, or FormApp.
    .createMenu('Custom Menu')
    .addItem('Set Deployment ID', 'setDeploymentId')
    .addItem('Set API Key', 'setApiKey')
    .addItem('Delete All Settings', 'deleteAllSettings')
    .addItem('Post to the blockchain', 'postToBlockchain')
    .addItem('Refresh current cell', 'refreshCurrentCell')
    .addItem('Version', 'showVersion')
    .addToUi();
}

/**
 * Create a template to be used with calling a smart contract method (function)
 * that will write to the blockchain.
 *
 * @param {numberOfArgs} numberOfArgs (Optional) Number of arguments (parameters)
 * to pass to the method (function). Default is 0.
 * @return A two dimensional array that can be used as the starting point for calling
 * a smart contract method.
 * @customfunction
 */
function MBPOSTTEMPLATE(numArgs) {
  let numberOfArgs = numArgs;

  // validate and normalize parameters
  if (!numberOfArgs) {
    numberOfArgs = 0;
  } else if (!isNaturalNumber(numberOfArgs)) {
    throw new Error('Number of arguments must be a valid positive integer');
  }

  const header = ['address', 'contract', 'method', 'from', 'signer'];
  for (let i = 0; i < numberOfArgs; i++) {
    header.push(`input${String(i)}`);
  }
  header.push('txHash (output)');

  return [header];
}

/**
 * Retrieve a detailed list of a smart contract's events.
 *
 * @param {contract} contract Smart contract label, must be associated with the address.
 * @param {filter} filter (Optional) Regular expression (regex) to filter function names on.
 * @return Array of smart contract functions and their inputs and outputs.
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
    console.error(e);
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
 * @param {contract} contract Smart contract label, must be associated with the address.
 * @param {filter} filter (Optional) Regular expression (regex) to filter function names on.
 * @return Array of smart contract functions and their inputs and outputs.
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
    console.error(e);
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
 * @param {hash} hash Transaction hash.
 * @param {headers} headers (Optional) Include column headers. TRUE/FALSE, defaults to TRUE.
 * @return Transaction details.
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
    console.error(e);
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
 * @param {numberOrHash} numberOrHash Block number or hash.
 * @param {headers} headers (Optional) Include column headers. TRUE/FALSE, defaults to TRUE.
 * @param {txHashes} txHashes (Optional) Include the transaction hashes. TRUE/FALSE,
 * defaults to TRUE.
 * @return Block details.
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
    console.error(e);
    throw new Error(e.message);
  }

  // turn the block structure into a flat array
  const output = blockToArray(results.result, isHeaders, isTxHashes);
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
 * @return Address details.
 * @customfunction
 */
function MBADDRESS(address, headers, code) {
  if (!address) {
    throw new Error('Must provide an address or address label');
  }

  const isHeaders = clampBool(headers, true);
  const isCode = clampBool(code, false);

  const queryPath = `chains/ethereum/addresses/${address}?include=balance`;
  let results;
  try {
    results = query(
      HTTP_GET,
      getProperty(PROP_MB_DEPLOYMENT_ID),
      getProperty(PROP_MB_API_KEY),
      queryPath,
    );
  } catch (e) {
    console.error(e);
    throw new Error(e.message);
  }

  // turn the address structure into a flat array
  const output = addressToArray(results.result, isHeaders, isCode);
  console.log(`Results: ${JSON.stringify(output)}`);

  return output;
}

/**
 * Retrieve the results of a MultiBaas Event Query.
 *
 * @param {query} query Event Query name to return results from.
 * @param {limit} limit (Optional) Number of results to return.
 * @param {offset} offset (Optional) Offset from the 0th result to return.
 * @return A two dimensional array with the results of the Event Query.
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
    console.error(e);
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
 * @param {events} events Two dimensional array of event names, selectors and filters.
 * @param {groupBy} groupBy (Optional) Field to group by.
 * @param {orderBy} orderBy (Optional) Field to order by.
 * @param {limit} limit (Optional) Number of results to return.
 * @param {offset} offset (Optional) Offset from the 0th result to return.
 * @return A two dimensional array with the results of the Event Query.
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
    console.error(e);
    throw new Error(e.message);
  }
  console.log(`Results: ${JSON.stringify(results)}`);

  // turn the array of objects into a flat array
  const objArr = results.result.rows;
  return objectArrayToArray(objArr);
}

/**
 * Create a template to be used with a custom MultiBaas Event Query.
 *
 * @param {numberOfSelects} numberOfSelects (Optional) Number of 'select' groups
 * to create. Default is 1.
 * @param {numberOfFilters} numberOfFilters (Optional) Number of 'filter' groups
 * to create. Default is 1.
 * @return A two dimensional array that can be used as the starting point for a custom Event Query.
 * @customfunction
 */
function MBCUSTOMQUERYTEMPLATE(numSelects, numFilters) {
  let numberOfSelects = numSelects;
  let numberOfFilters = numFilters;

  // validate and normalize parameters
  if (!numberOfSelects) {
    numberOfSelects = 1;
  } else if (!isNaturalNumber(numberOfSelects)) {
    throw new Error("Number of 'select' groups must be a valid positive integer");
  }
  if (!numberOfFilters) {
    numberOfFilters = 1;
  } else if (!isNaturalNumber(numberOfFilters)) {
    throw new Error("Number of 'filter' groups must be a valid positive integer");
  }

  let header = ['eventName'];
  for (let i = 0; i < numberOfSelects; i++) {
    header = header.concat(['alias', 'index', 'aggregator']);
  }
  for (let i = 0; i < numberOfFilters; i++) {
    header = header.concat(['rule', 'operator', 'value']);
  }

  return [header];
}

/**
 * Retrieve blockchain events. Address must be associated with one or more contracts in MultiBaas.
 *
 * @param {address} address Ethereum address or label.
 * @param {limit} limit (Optional) Number of results to return.
 * @param {offset} offset (Optional) Offset from the 0th result to return.
 * @return A two dimensional array of events.
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
    console.error(e);
    throw new Error(e.message);
  }
  console.log(`Results: ${JSON.stringify(results)}`);

  // turn the events structure into a flat array
  const events = results.result;
  return eventsToArray(events);
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
  const payload = buildMethodArgs(args);

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
    throw new Error(e.message);
  }
  const { output } = results.result;
  console.log(`Results: ${JSON.stringify(output)}`);

  return output;
}

/**
 * Compose an unsigned transaction to call a smart contract function.
 *
 * @param {address} address Ethereum address or label.
 * @param {contract} contract Smart contract label, must be associated with the address.
 * @param {method} method Smart contract function name.
 * @param {from} from From address.
 * @param {signer} signer (Optional) Signer address. Defaults to the 'from' address.
 * @param {value} value (Optional) Value for amount of ETH sent.
 * @param {args} args (Optional) Arguments to pass to the function.
 * @return An unsigned transaction, suitable for signing and submitting to the blockchain.
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
    console.error(e);
    throw new Error(e.message);
  }
  const output = JSON.stringify(results.result.tx);
  console.log(`Results: ${output}`);

  return output;
}
