// Copyright (c) 2020 Curvegrid Inc.

/* eslint-disable no-unused-vars */

const URL_SCHEME = 'https://';
const URL_BASE = '.multibaas.com/api/v0/';
const HTTP_GET = 'GET';
const HTTP_POST = 'POST';

/**
 * Add menu
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('MultiBaas')
    .addItem('Post to the blockchain', 'mbPost')
    .addItem('Refresh current cell', 'mbRefresh')
    .addToUi();
}

/**
 * Menu 1
 */
function mbRefresh() {
  const range = SpreadsheetApp.getActiveRange();
  const cell = range.getCell(1, 1);
  const value = cell.getValue();
  const formula = cell.getFormula();
  cell.setValue('');
  SpreadsheetApp.flush();
  if (formula !== '') {
    cell.setFormula(formula);
  } else {
    cell.setValue(value);
  }
  SpreadsheetApp.flush();
}

/**
 * Menu 2
 */
function mbPost() {
  const MIN_COLUMNS = 7;

  const sheet = SpreadsheetApp.getActiveSheet();
  const range = SpreadsheetApp.getActiveRange();

  if (range.getNumColumns() < MIN_COLUMNS) {
    showAlert(`${range.getNumColumns()} selected column(s) is fewer than the minimum of ${MIN_COLUMNS} columns`);
    return;
  }

  const values = range.getValues();

  for (let i = 0; i < values.length; i++) {
    const row = values[i];

    const [deployment, apiKey, address, contract, method, from, signer] = row.slice(0, 6);

    let args = [];
    if (row.length > MIN_COLUMNS) {
      args = row.slice(7);
    }

    const queryPath = `chains/ethereum/addresses/${address}/contracts/${contract}/methods/${method}`;

    // build args
    const signAndSubmit = true;
    const payload = buildMethodArgs(args, from, signer, signAndSubmit);

    let results;
    try {
      results = query(HTTP_POST, deployment, apiKey, queryPath, payload);
    } catch (e) {
      showAlert(e.message);
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
  if (numberOfArgs === undefined || numberOfArgs === '') {
    numberOfArgs = 0;
  } else if (!isNaturalNumber(numberOfArgs)) {
    showAlert('number of arguments must be a valid positive integer');
    return undefined;
  }

  const header = ['deployment', 'apiKey', 'address', 'contract', 'method', 'from', 'signer'];
  for (let i = 0; i < numberOfArgs; i++) {
    header.push(`input${String(i)}`);
  }
  header.push('txHash (output)');

  return [header];
}

/**
 * Retrieve a detailed list of a smart contract's events.
 *
 * @param {deployment} deployment MultiBaas deployment ID.
 * @param {apiKey} apiKey MultiBaas API Key.
 * @param {contract} contract Smart contract label, must be associated with the address.
 * @param {filter} filter (Optional) Regular expression (regex) to filter function names on.
 * @return Array of smart contract functions and their inputs and outputs.
 * @customfunction
 */
function MBEVENTLIST(deployment, apiKey, contract, filter) {
  if (contract === undefined || contract === '') {
    showAlert('must provide a smart contract label');
    return undefined;
  }

  const queryPath = `contracts/${contract}`;
  let results;
  try {
    results = query(HTTP_GET, deployment, apiKey, queryPath);
  } catch (e) {
    showAlert(e.message);
    return undefined;
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
 * @param {deployment} deployment MultiBaas deployment ID.
 * @param {apiKey} apiKey MultiBaas API Key.
 * @param {contract} contract Smart contract label, must be associated with the address.
 * @param {filter} filter (Optional) Regular expression (regex) to filter function names on.
 * @return Array of smart contract functions and their inputs and outputs.
 * @customfunction
 */
function MBFUNCTIONLIST(deployment, apiKey, contract, filter) {
  if (contract === undefined || contract === '') {
    showAlert('must provide a smart contract label');
    return undefined;
  }

  const queryPath = `contracts/${contract}`;
  let results;
  try {
    results = query(HTTP_GET, deployment, apiKey, queryPath);
  } catch (e) {
    showAlert(e.message);
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
 * @param {deployment} deployment MultiBaas deployment ID.
 * @param {apiKey} apiKey MultiBaas API Key.
 * @param {hash} hash Transaction hash.
 * @param {headers} headers (Optional) Include column headers. TRUE/FALSE, defaults to TRUE.
 * @return Transaction details.
 * @customfunction
 */
function MBTX(deployment, apiKey, hash, headers) {
  try {
    validateBlockTxHash(hash);
  } catch (e) {
    showAlert(e.message);
    return undefined;
  }

  const isHeaders = clampBool(headers, true);

  const queryPath = `chains/ethereum/transactions/${hash}`;
  let results;
  try {
    results = query(HTTP_GET, deployment, apiKey, queryPath);
  } catch (e) {
    showAlert(e.message);
    return undefined;
  }

  // turn the block structure into a flat array
  const output = txToArray(results.result, isHeaders);
  console.log(`Results: ${JSON.stringify(output)}`);

  return output;
}

/**
 * Retrieve the details of a block.
 *
 * @param {deployment} deployment MultiBaas deployment ID.
 * @param {apiKey} apiKey MultiBaas API Key.
 * @param {numberOrHash} numberOrHash Block number or hash.
 * @param {headers} headers (Optional) Include column headers. TRUE/FALSE, defaults to TRUE.
 * @param {txHashes} txHashes (Optional) Include the transaction hashes. TRUE/FALSE,
 * defaults to TRUE.
 * @return Block details.
 * @customfunction
 */
function MBBLOCK(deployment, apiKey, numberOrHash, headers, txHashes) {
  try {
    validateBlockNumOrHash(numberOrHash);
  } catch (e) {
    showAlert(e.message);
    return undefined;
  }

  const isHeaders = clampBool(headers, true);
  const isTxHashes = clampBool(txHashes, true);

  const queryPath = `chains/ethereum/blocks/${numberOrHash}`;
  let results;
  try {
    results = query(HTTP_GET, deployment, apiKey, queryPath);
  } catch (e) {
    showAlert(e.message);
    return undefined;
  }

  // turn the block structure into a flat array
  const output = blockToArray(results.result, isHeaders, isTxHashes);
  console.log(`Results: ${JSON.stringify(output)}`);

  return output;
}

/**
 * Retrieve the details of a blockchain address.
 *
 * @param {deployment} deployment MultiBaas deployment ID.
 * @param {apiKey} apiKey MultiBaas API Key.
 * @param {address} address Ethereum address or label.
 * @param {headers} headers (Optional) Include column headers. TRUE/FALSE, defaults to TRUE.
 * @param {code} code (Optional) Include the smart contract bytecode deployed at the address,
 * if any. TRUE/FALSE, defaults to FALSE.
 * @return Address details.
 * @customfunction
 */
function MBADDRESS(deployment, apiKey, address, headers, code) {
  if (address === undefined || address === '') {
    showAlert('must provide an address or address label');
    return undefined;
  }

  const isHeaders = clampBool(headers, true);
  const isCode = clampBool(code, false);

  const queryPath = `chains/ethereum/addresses/${address}`;
  let results;
  try {
    results = query(HTTP_GET, deployment, apiKey, queryPath);
  } catch (e) {
    showAlert(e.message);
    return undefined;
  }

  // turn the address structure into a flat array
  const output = addressToArray(results.result, isHeaders, isCode);
  console.log(`Results: ${JSON.stringify(output)}`);

  return output;
}

/**
 * Retrieve the results of a MultiBaas Event Query.
 *
 * @param {deployment} deployment MultiBaas deployment ID.
 * @param {apiKey} apiKey MultiBaas API Key.
 * @param {query} query Event Query name to return results from.
 * @param {limit} limit (Optional) Number of results to return.
 * @param {offset} offset (Optional) Offset from the 0th result to return.
 * @return A two dimensional array with the results of the Event Query.
 * @customfunction
 */
function MBQUERY(deployment, apiKey, query, limit, offset) {
  if (query === undefined || query === '') {
    showAlert('must provide an Event Query name');
    return undefined;
  }

  const queryPath = `queries/${query}/results`;
  let results;
  try {
    results = limitQuery(HTTP_GET, deployment, apiKey, queryPath, limit, offset);
  } catch (e) {
    showAlert(e.message);
    return undefined;
  }
  console.log(`Results: ${JSON.stringify(results)}`);

  // turn the array of objects into a flat array
  const objArr = results.result.rows;
  return objectArrayToArray(objArr);
}

/**
 * Retrieve the results of a custom MultiBaas Event Query.
 *
 * @param {deployment} deployment MultiBaas deployment ID.
 * @param {apiKey} apiKey MultiBaas API Key.
 * @param {events} events Two dimensional array of event names, selectors and filters.
 * @param {groupBy} groupBy (Optional) Field to group by.
 * @param {orderBy} orderBy (Optional) Field to order by.
 * @param {limit} limit (Optional) Number of results to return.
 * @param {offset} offset (Optional) Offset from the 0th result to return.
 * @return A two dimensional array with the results of the Event Query.
 * @customfunction
 */
function MBCUSTOMQUERY(deployment, apiKey, events, groupBy, orderBy, limit, offset) {
  if (events === undefined || events === '') {
    showAlert('must provide an events definition');
    return undefined;
  }

  const queryPath = 'queries';
  let payload;
  try {
    payload = buildCustomQuery(events, groupBy, orderBy, limit, offset);
  } catch (e) {
    showAlert(e.message);
    return undefined;
  }

  let results;
  try {
    results = limitQuery(HTTP_POST, deployment, apiKey, queryPath, limit, offset, payload);
  } catch (e) {
    showAlert(e.message);
    return undefined;
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
  if (numberOfSelects === undefined || numberOfSelects === '') {
    numberOfSelects = 1;
  } else if (!isNaturalNumber(numberOfSelects)) {
    showAlert("number of 'select' groups must be a valid positive integer");
    return undefined;
  }
  if (numberOfFilters === undefined || numberOfFilters === '') {
    numberOfFilters = 1;
  } else if (!isNaturalNumber(numberOfFilters)) {
    showAlert("number of 'filter' groups must be a valid positive integer");
    return undefined;
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
 * @param {deployment} deployment MultiBaas deployment ID.
 * @param {apiKey} apiKey MultiBaas API Key.
 * @param {address} address Ethereum address or label.
 * @param {limit} limit (Optional) Number of results to return.
 * @param {offset} offset (Optional) Offset from the 0th result to return.
 * @return A two dimensional array of events.
 * @customfunction
 */
function MBEVENTS(deployment, apiKey, address, limit, offset) {
  if (address === undefined || address === '') {
    showAlert('must provide an address or address label');
    return undefined;
  }

  const queryPath = `chains/ethereum/addresses/${address}/events`;
  let results;
  try {
    results = limitQuery(HTTP_GET, deployment, apiKey, queryPath, limit, offset);
  } catch (e) {
    showAlert(e.message);
    return undefined;
  }
  console.log(`Results: ${JSON.stringify(results)}`);

  // turn the events structure into a flat array
  const events = results.result;
  return eventsToArray(events);
}

/**
 * Retrieve the results of a smart contract function call.
 *
 * @param {deployment} deployment MultiBaas deployment ID.
 * @param {apiKey} apiKey MultiBaas API Key.
 * @param {address} address Ethereum address or label.
 * @param {contract} contract Smart contract label, must be associated with the address.
 * @param {method} method Smart contract function name.
 * @param {args} args (Optional) Arguments to pass to the function.
 * @return One or more values returned from the function.
 * @customfunction
 */
function MBGET(deployment, apiKey, address, contract, method, ...args) {
  if (address === undefined || address === '') {
    showAlert('must provide an address or address label');
    return undefined;
  }
  if (contract === undefined || contract === '') {
    showAlert('must provide a smart contract label');
    return undefined;
  }
  if (method === undefined || method === '') {
    showAlert('must provide a method (function) name');
    return undefined;
  }

  const queryPath = `chains/ethereum/addresses/${address}/contracts/${contract}/methods/${method}`;

  // build args
  const payload = buildMethodArgs(args);

  let results;
  try {
    results = query(HTTP_POST, deployment, apiKey, queryPath, payload);
  } catch (e) {
    showAlert(e.message);
    return undefined;
  }
  const { output } = results.result;
  console.log(`Results: ${JSON.stringify(output)}`);

  return output;
}

/**
 * Compose an unsigned transaction to call a smart contract function.
 *
 * @param {deployment} deployment MultiBaas deployment ID.
 * @param {apiKey} apiKey MultiBaas API Key.
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
function MBCOMPOSE(deployment, apiKey, address, contract, method, from, signer, value, ...args) {
  console.log(deployment, apiKey, address, contract, method, from, signer, args);
  const queryPath = `chains/ethereum/addresses/${address}/contracts/${contract}/methods/${method}`;

  // build args
  const payload = buildMethodArgs(args, from, signer, undefined, value);

  let results;
  try {
    results = query(HTTP_POST, deployment, apiKey, queryPath, payload);
  } catch (e) {
    showAlert(e.message);
    return undefined;
  }
  const output = JSON.stringify(results.result.tx);
  console.log(`Results: ${output}`);

  return output;
}
