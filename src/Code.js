// Copyright (c) 2020 Curvegrid Inc.

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
    throw new Error(`${range.getNumColumns()} selected column(s) is fewer than the minimum of ${MIN_COLUMNS} columns`);
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

    const results = query(HTTP_POST, deployment, apiKey, queryPath, payload);
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
 * Create a template to be used with calling a smart contract method (function) that will write to the blockchain.
 *
 * @param {numberOfArgs} numberOfArgs (Optional) Number of arguments (parameters) to pass to the method (function). Default is 0.
 * @return A two dimensional array that can be used as the starting point for calling a smart contract method.
 * @customfunction
 */
function MBPOSTTEMPLATE(numberOfArgs) {
  // validate and normalize parameters
  if (numberOfArgs === undefined || numberOfArgs === '') {
    numberOfArgs = 0;
  } else if (!isNaturalNumber(numberOfArgs)) {
    throw new Error('number of arguments must be a valid positive integer');
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
    throw new Error('must provide a smart contract label');
  }

  const queryPath = `contracts/${contract}`;

  const results = query(HTTP_GET, deployment, apiKey, queryPath);

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
    throw new Error('must provide a smart contract label');
  }

  const queryPath = `contracts/${contract}`;

  const results = query(HTTP_GET, deployment, apiKey, queryPath);

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
  validateBlockTxHash(hash);

  headers = clampBool(headers, true);

  const queryPath = `chains/ethereum/transactions/${hash}`;

  const results = query(HTTP_GET, deployment, apiKey, queryPath);

  // turn the block structure into a flat array
  const output = txToArray(results.result, headers);
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
 * @param {txHashes} txHashes (Optional) Include the transaction hashes. TRUE/FALSE, defaults to TRUE.
 * @return Block details.
 * @customfunction
 */
function MBBLOCK(deployment, apiKey, numberOrHash, headers, txHashes) {
  validateBlockNumOrHash(numberOrHash);

  headers = clampBool(headers, true);
  txHashes = clampBool(txHashes, true);

  const queryPath = `chains/ethereum/blocks/${numberOrHash}`;

  const results = query(HTTP_GET, deployment, apiKey, queryPath);

  // turn the block structure into a flat array
  const output = blockToArray(results.result, headers, txHashes);
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
 * @param {code} code (Optional) Include the smart contract bytecode deployed at the address, if any. TRUE/FALSE, defaults to FALSE.
 * @return Address details.
 * @customfunction
 */
function MBADDRESS(deployment, apiKey, address, headers, code) {
  if (address === undefined || address === '') {
    throw new Error('must provide an address or address label');
  }

  headers = clampBool(headers, true);
  code = clampBool(code, false);

  const queryPath = `chains/ethereum/addresses/${address}`;

  const results = query(HTTP_GET, deployment, apiKey, queryPath);

  // turn the address structure into a flat array
  const output = addressToArray(results.result, headers, code);
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
    throw new Error('must provide an Event Query name');
  }

  const queryPath = `queries/${query}/results`;

  const results = limitQuery(HTTP_GET, deployment, apiKey, queryPath, limit, offset);
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
    throw new Error('must provide an events definition');
  }

  const queryPath = 'queries';

  const payload = buildCustomQuery(events, groupBy, orderBy, limit, offset);

  const results = limitQuery(HTTP_POST, deployment, apiKey, queryPath, limit, offset, payload);
  console.log(`Results: ${JSON.stringify(results)}`);

  // turn the array of objects into a flat array
  const objArr = results.result.rows;
  return objectArrayToArray(objArr);
}

/**
 * Create a template to be used with a custom MultiBaas Event Query.
 *
 * @param {numberOfSelects} numberOfSelects (Optional) Number of 'select' groups to create. Default is 1.
 * @param {numberOfFilters} numberOfFilters (Optional) Number of 'filter' groups to create. Default is 1.
 * @return A two dimensional array that can be used as the starting point for a custom Event Query.
 * @customfunction
 */
function MBCUSTOMQUERYTEMPLATE(numberOfSelects, numberOfFilters) {
  // validate and normalize parameters
  if (numberOfSelects === undefined || numberOfSelects === '') {
    numberOfSelects = 1;
  } else if (!isNaturalNumber(numberOfSelects)) {
    throw new Error("number of 'select' groups must be a valid positive integer");
  }
  if (numberOfFilters === undefined || numberOfFilters === '') {
    numberOfFilters = 1;
  } else if (!isNaturalNumber(numberOfFilters)) {
    throw new Error("number of 'filter' groups must be a valid positive integer");
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
    throw new Error('must provide an address or address label');
  }

  const queryPath = `chains/ethereum/addresses/${address}/events`;

  const results = limitQuery(HTTP_GET, deployment, apiKey, queryPath, limit, offset);
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
    throw new Error('must provide an address or address label');
  }
  if (contract === undefined || contract === '') {
    throw new Error('must provide a smart contract label');
  }
  if (method === undefined || method === '') {
    throw new Error('must provide a method (function) name');
  }

  const queryPath = `chains/ethereum/addresses/${address}/contracts/${contract}/methods/${method}`;

  // build args
  const payload = buildMethodArgs(args);

  const results = query(HTTP_POST, deployment, apiKey, queryPath, payload);
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
 * @param {args} args (Optional) Arguments to pass to the function.
 * @return An unsigned transaction, suitable for signing and submitting to the blockchain.
 * @customfunction
 */
function MBCOMPOSE(deployment, apiKey, address, contract, method, from, signer, ...args) {
  const queryPath = `chains/ethereum/addresses/${address}/contracts/${contract}/methods/${method}`;

  // build args
  const payload = buildMethodArgs(args, from, signer);

  const results = query(HTTP_POST, deployment, apiKey, queryPath, payload);
  const output = JSON.stringify(results.result.tx);
  console.log(`Results: ${output}`);

  return output;
}
