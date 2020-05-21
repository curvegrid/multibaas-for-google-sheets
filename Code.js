/**
 * @OnlyCurrentDoc
 */

// Copyright (c) 2020 Curvegrid Inc.

const URL_SCHEME = 'https://';
const URL_BASE = '.multibaas.com/api/v0/';
const HTTP_GET = 'GET';
const HTTP_POST = 'POST';

// TODO: comments

function onOpen() {
  var ui = SpreadsheetApp.getUi();

  ui.createMenu('MultiBaas')
      .addItem('Post to the blockchain', 'mbPost')
      .addItem('Refresh current cell', 'mbRefresh')
      .addToUi();
}

function mbRefresh() {
  let range = SpreadsheetApp.getActiveRange();
  let cell = range.getCell(1, 1);
  let value = cell.getValue();
  let formula = cell.getFormula();
  cell.setValue('');
  SpreadsheetApp.flush();
  if (formula != '') {
    cell.setFormula(formula);
  } else {
    cell.setValue(value);
  }
  SpreadsheetApp.flush();
}

function mbPost() {
  const MIN_COLUMNS = 7;

  let sheet = SpreadsheetApp.getActiveSheet();
  let range = SpreadsheetApp.getActiveRange();

  if (range.getNumColumns() < MIN_COLUMNS) {
    throw(range.getNumColumns() + " selected column(s) is fewer than the minimum of " + MIN_COLUMNS + " columns");
  }

  let values = range.getValues();

  for (let i = 0; i < values.length; i++) {
    let row = values[i];

    let [deployment, apiKey, address, contract, method, from, signer] = row.slice(0, 6);

    let args = [];
    if (row.length > MIN_COLUMNS) {
      args = row.slice(7);
    }

    let queryPath = 'chains/ethereum/addresses/' + address + '/contracts/' + contract + '/methods/' + method;

    // build args
    let signAndSubmit = true;
    let payload = buildMethodArgs(args, from, signer, signAndSubmit);

    let results = query(HTTP_POST, deployment, apiKey, queryPath, payload);
    let output = JSON.stringify(results.result.tx)
    console.log('Results: ' + output);

    // output tx hash
    sheet.getRange(range.getRow()+i, range.getColumn()+range.getNumColumns(), 1, 1).setValue(results.result.tx.hash);
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
  if (numberOfArgs == undefined || numberOfArgs == '') {
    numberOfArgs = 0;
  } else if (!isNaturalNumber(numberOfArgs)) {
    throw("number of arguments must be a valid positive integer");
  }

  let header = ['deployment', 'apiKey', 'address', 'contract', 'method', 'from', 'signer'];
  for (let i = 0; i < numberOfArgs; i++) {
    header.push('input' + String(i));
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
  if (contract == undefined || contract == "") {
    throw("must provide a smart contract label");
  }

  let queryPath = 'contracts/' + contract;

  let results = query(HTTP_GET, deployment, apiKey, queryPath);

  // turn the block structure into a flat array
  let includeOutputs = false;
  let output = functionsToArray(results.result.abi.events, 'event', filter, includeOutputs);
  console.log('Results: ' + JSON.stringify(output));

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
  if (contract == undefined || contract == "") {
    throw("must provide a smart contract label");
  }

  let queryPath = 'contracts/' + contract;

  let results = query(HTTP_GET, deployment, apiKey, queryPath);

  // turn the block structure into a flat array
  let includeOutputs = true;
  let output = functionsToArray(results.result.abi.methods, 'function', filter, includeOutputs);
  console.log('Results: ' + JSON.stringify(output));

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

  let queryPath = 'chains/ethereum/transactions/' + hash;

  let results = query(HTTP_GET, deployment, apiKey, queryPath);

  // turn the block structure into a flat array
  let output = txToArray(results.result, headers);
  console.log('Results: ' + JSON.stringify(output));

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

  let queryPath = 'chains/ethereum/blocks/' + numberOrHash;

  let results = query(HTTP_GET, deployment, apiKey, queryPath);

  // turn the block structure into a flat array
  let output = blockToArray(results.result, headers, txHashes);
  console.log('Results: ' + JSON.stringify(output));

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
  if (address == undefined || address == "") {
    throw("must provide an address or address label");
  }

  headers = clampBool(headers, true);
  code = clampBool(code, false);

  let queryPath = 'chains/ethereum/addresses/' + address;

  let results = query(HTTP_GET, deployment, apiKey, queryPath);

  // turn the address structure into a flat array
  let output = addressToArray(results.result, headers, code);
  console.log('Results: ' + JSON.stringify(output));

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
  if (query == undefined || query == "") {
    throw("must provide an Event Query name");
  }

  let queryPath = 'queries/' + query + '/results';

  let results = limitQuery(HTTP_GET, deployment, apiKey, queryPath, limit, offset);
  console.log('Results: ' + JSON.stringify(results));

  // turn the array of objects into a flat array
  let objArr = results.result.rows;
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
  if (events == undefined || events == "") {
    throw("must provide an events definition");
  }

  let queryPath = 'queries';

  let payload = buildCustomQuery(events, groupBy, orderBy, limit, offset);

  let results = limitQuery(HTTP_POST, deployment, apiKey, queryPath, limit, offset, payload);
  console.log('Results: ' + JSON.stringify(results));

  // turn the array of objects into a flat array
  let objArr = results.result.rows;
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
  if (numberOfSelects == undefined || numberOfSelects == '') {
    numberOfSelects = 1;
  } else if (!isNaturalNumber(numberOfSelects)) {
    throw("number of 'select' groups must be a valid positive integer");
  }
  if (numberOfFilters == undefined || numberOfFilters == '') {
    numberOfFilters = 1;
  } else if (!isNaturalNumber(numberOfFilters)) {
    throw("number of 'filter' groups must be a valid positive integer");
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
  if (address == undefined || address == "") {
    throw("must provide an address or address label");
  }

  let queryPath = 'chains/ethereum/addresses/' + address + '/events';

  let results = limitQuery(HTTP_GET, deployment, apiKey, queryPath, limit, offset);
  console.log('Results: ' + JSON.stringify(results));

  // turn the events structure into a flat array
  let events = results.result;
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
  if (address == undefined || address == "") {
    throw("must provide an address or address label");
  }
  if (contract == undefined || contract == "") {
    throw("must provide a smart contract label");
  }
  if (method == undefined || method == "") {
    throw("must provide a method (function) name");
  }

  let queryPath = 'chains/ethereum/addresses/' + address + '/contracts/' + contract + '/methods/' + method;

  // build args
  let payload = buildMethodArgs(args);

  let results = query(HTTP_POST, deployment, apiKey, queryPath, payload);
  let output = results.result.output;
  console.log('Results: ' + JSON.stringify(output));

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
  let queryPath = 'chains/ethereum/addresses/' + address + '/contracts/' + contract + '/methods/' + method;

  // build args
  let payload = buildMethodArgs(args, from, signer);

  let results = query(HTTP_POST, deployment, apiKey, queryPath, payload);
  let output = JSON.stringify(results.result.tx)
  console.log('Results: ' + output);

  return output
}

function extractSelectFilterCounts(header) {
  let numSelect = 0;
  let numFilter = 0;

  let selectHalf = true;
  for (let i = 1; i < header.length; i+=3) {
    let aliasRule = header[i].toLowerCase();
    let indexOperator = header[i+1].toLowerCase();
    let aggregatorValue = header[i+2].toLowerCase();

    if (selectHalf) {
      if (aliasRule == 'rule') {
        selectHalf = false;
      } else {
        if (aliasRule != 'alias') {
          throw("expecting 'alias' in position " + i + ", found '" + aliasRule + "'");
        }
        if (indexOperator != 'index') {
          throw("expecting 'index' in position " + (i+1) + ", found '" + indexOperator + "'");
        }
        if (aggregatorValue != 'aggregator') {
          throw("expecting 'aggregator' in position " + (i+2) + ", found '" + aggregatorValue + "'");
        }

        numSelect++;
      }
    }
    if (!selectHalf) {
      if (aliasRule != 'rule') {
        throw("expecting 'rule' in position " + i + ", found '" + aliasRule + "'");
      }
      if (indexOperator != 'operator') {
        throw("expecting 'operator' in position " + (i+1) + ", found '" + indexOperator + "'");
      }
      if (aggregatorValue != 'value') {
        throw("expecting 'value' in position " + (i+2) + ", found '" + aggregatorValue + "'");
      }

      numFilter++;
    }
  }

  return [numSelect, numFilter];
}

function buildCustomQuery(events, groupBy, orderBy, limit, offset) {
  let query = {
    events: []
  }

  if (groupBy != undefined && groupBy != '') {
    query.groupBy = groupBy;
  }
  if (orderBy != undefined && orderBy != '') {
    query.orderBy = orderBy;
  }

  // parse and validate header row
  if (events.length < 2) {
    throw("expecting a header row followed by one or more data rows, found " + events.length + " rows total");
  }
  let header = events[0];
  if (header.length < 4) {
    throw("expecting to have at least four columns, found " + header.length + " columns total");
  }
  if ((header.length - 1) % 3 != 0) {
    throw("expecting number of columns to be divisible by 3 plus 1, found " + header.length + " columns total");
  }
  if (header[0].toLowerCase() != "eventname") {
    throw("expecting first column in header row to be 'eventName', found '" + header[0] + "'");
  }

  // extract the number of select and filter triplets
  let [numSelect, numFilter] = extractSelectFilterCounts(header);

  // build the event query
  for (let i = 1; i < events.length; i++) {
    let event = events[i];

    // build selects and filters
    let selects = buildSelects(event, 1, numSelect);
    let filters = buildFilters(event, 1+numSelect*3, numFilter);

    query.events.push({
      eventName: event[0],
      select: selects,
      filter: filters
    });
  }

  return query;
}

const VALID_AGGREGATORS = ['subtract', 'add', 'first', 'last', 'max', 'min', ''];
const VALID_BOOLEANS = ['and', 'or'];
const VALID_OPERATORS = ['equal', 'notequal', 'lessthan', 'greaterthan'];
const VALID_OPERANDS = ['input', 'contracts.label', 'contracts.contract_name', 'addresses.address', 'addresses.label'];

function buildFilters(items, start, numItems) {
  let filter = {};
  for (var i = start; i < start + numItems*3; i+=3) {
    let rules = items[i];
    let operator = items[i+1];
    let value = items[i+2];

    // not all rows will have the same number of filters
    if (rules == '') {
      break;
    }

    if (value == '') {
      throw("value is empty for rule '" + rules + "'");
    }

    // split by colons
    let rulePath = rules.split(':');
    if (rulePath.length == 1) {
      // special case for a single rule
      rulePath.unshift('And');
    }

    // loop through 'and' and 'or', creating children if they don't exist
    let node = filter;
    for(var j in rulePath) {
      // parse out rule and optional numeric portions (e.g., input0)
      let ruleParts = RegExp('^([A-Za-z\.]+)([0-9]*)$').exec(rulePath[j]);
      if (ruleParts == null || ruleParts.length < 2) {
        throw("invalid rule '" + rulePath[j] + "' in '" + rules + "'");
      }
      let rule = ruleParts[1].toLowerCase();
      if (rule == '') {
        throw("sub-rule is empty in '" + rules + "'");
      }

      // if we're on a children array, search for a child matching this rule
      if (Array.isArray(node)) {
        // find the one that matches this rule
        let matchedChild = false;
        for (var k in node) {
          if (node[k].rule == rule) {
            // node 'array' becomes an 'object' again
            node = node[k];
            matchedChild = true;
            break;
          }
        }

        // no match for this rule so add a new child
        if (!matchedChild) {
          node.push({});
          // node 'array' becomes an 'object' again
          node = node[node.length - 1];
        } else {
          // otherwise, we matched, so next rule
          continue;
        }
      }

      // add a rule or descend to the next level down as appropriate
      if (VALID_BOOLEANS.includes(rule)) {
        if (Object.keys(node).length == 0) {
          // new child node
          node.rule = rule;
          node.children = [{}];
          node = node.children[0];
        } else {
          // existing child node

          // node 'object' becomes a 'array'
          node = node.children;
        }
      } else if (VALID_OPERANDS.includes(rule)) {
        // at the last level, add the rule

        // first, ensure we're actually at a leaf node
        // if not, add us to the children array
        if (Object.keys(node).length > 0) {
          node.children.push({});
          node = node.children[node.children.length - 1];
        }

        node.rule = rule;
        node.operator = validateOperator(operator);
        node.value = String(value);

        // special case for an input
        if (rule == 'input') {
          if (ruleParts.length != 3) {
            throw("no input index provided, just 'input'");
          }
          let inputIndex = ruleParts[2];
          if (!isNaturalNumber(inputIndex)) {
            throw("invalid input index '" + inputIndex + "', must be a positive number");
          }
          node.inputIndex = parseInt(inputIndex);
        }
      }
    }
  }

  return filter;
}

function buildSelects(items, start, numItems) {
  let triplets = [];
  for (var i = start; i < numItems*3; i+=3) {
    // not all rows will have the same number of triplets
    if (items[i] == '') {
      triplets.push(triplet);
      break;
    }
    let triplet = {
      alias: items[i],
      inputIndex: parseInt(items[i+1], 10),
    };
    let aggregator = validateAggregator(items[i+2]);
    if (aggregator != '') {
      triplet.aggregator = aggregator;
    }
    triplets.push(triplet);
  }

  return triplets;
}

function validateOperator(operator) {
  operator = String(operator).toLowerCase();
  if (!VALID_OPERATORS.includes(operator)) {
    throw("'" + operator + "' is not a valid operator, must be one of " + VALID_OPERATORS.join(','));
  }

  return operator;
}


function validateAggregator(aggregator) {
  aggregator = String(aggregator).toLowerCase();
  if (!VALID_AGGREGATORS.includes(aggregator)) {
    throw("'" + aggregator + "' is not a valid aggregator, must be one of " + VALID_AGGREGATORS.join(','));
  }

  return aggregator;
}

function validateBlockNumOrHash(numOrHash) {
  if (numOrHash == undefined || numOrHash == "") {
    throw("must provide a block number or hash");
  }

  // fast return if it's a valid positive integer
  if (isNaturalNumber(numOrHash)) {
    return;
  }

  validateBlockTxHash(numOrHash);
}

function validateBlockTxHash(hash) {
  hash = String(hash);

  if (hash == undefined || hash == "" || hash.length < 2) {
    throw("must provide a hash");
  }

  if (hash.substring(0, 2).toLowerCase() != '0x') {
    throw("hash must start with '0x'");
  }

  if (hash.length != 66) {
    throw("invalid hash length of " + hash.length + ", should be 64 hex characters long excluding the '0x' prefix");
  }

  if (!RegExp('^0[xX][A-Fa-f0-9]+$').test(hash)) {
    throw("hash contains non-hexidecimal digits (outside of 0-9 and a-f)");
  }
}

function clampBool(value, def) {
  // clamp value to a valid bool with a default
  if (value === undefined || value === '') {
    value = def;
  } else if (value == true) {
    value = true;
  } else if (value == false) {
    value = false;
  } else {
    value = def;
  }

  return value;
}

function buildMethodArgs(args, from, signer, signAndSubmit) {
  let payload = {
    args: args,
    contractOverride: true
  };

  // optional from and signer for "write" transactions
  if (from != undefined) {
    if (signer == undefined || signer == '') {
      signer = from;
    }
    payload.from = from;
    payload.signer = signer;

    // optional "sign and submit" for HSM addresses
    if (signAndSubmit != undefined) {
      payload.signAndSubmit = signAndSubmit;
    }
  }

  return payload;
}

function limitQuery(httpMethod, deployment, apiKey, queryPath, limit, offset, payload) {
  // validate and normalize limit and offset
  let limitOffset = buildLimitOffset(limit, offset);

  // query
  let results = query(httpMethod, deployment, apiKey, queryPath+limitOffset, payload);

  return results;
}

function normalizeCreds(deployment, apiKey) {
  // validate deployment ID
  if (!RegExp('^[a-z0-9]+$', 'i').test(deployment)) {
    throw('invalid deployment ID');
  }

  // validate API key
  // based on: https://www.regextester.com/105777
  if (!RegExp('^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+\/=]*$').test(apiKey)) {
    throw('invalid API key');
  }

  return deployment, apiKey;
}

function buildLimitOffset(limit, offset) {
  // validate limit
  if (limit != undefined && !isNaturalNumber(limit)) {
    throw('invalid limit, must be a positive integer');
  }

  // validate offset
  if (offset != undefined && !isNaturalNumber(offset)) {
    throw('invalid offset, must be a positive integer');
  }

  // generate a clean URL query param
  let limitOffset = '';
  if (limit != undefined) {
    limitOffset += '?limit='+limit;
  }
  if (offset != undefined) {
    if (limitOffset == '') {
      limitOffset += '?';
    } else {
      limitOffset += '&';
    }
    limitOffset += 'offset='+offset;
  }

  return limitOffset;
}

function query(httpMethod, deployment, apiKey, query, payload) {
  // validate and normalize deployment and API key
  deployment, apiKey = normalizeCreds(deployment, apiKey);

  // query options
  let options = {
    'method' : httpMethod,
    'contentType': 'application/json',
    'headers': {
      'Accept': 'application/json',
      'Authorization': 'Bearer '+apiKey,
    }
  };

  if (payload != undefined && payload != '{}') {
    options.payload = JSON.stringify(payload);
  }

  // call the MultiBaas API
  let url = URL_SCHEME+deployment+URL_BASE+query;
  console.log('URL: ' + url);
  console.log('Payload: ' + JSON.stringify(payload));
  let response = UrlFetchApp.fetch(url, options);


  // pre-process the results
  let results = JSON.parse(response.getContentText());

  return results
}

function txToArray(tx, headers) {
  let rows = [];

  let dataKeys = keysFromObj(tx.data, false);

  // optional header row
  if (headers) {
    rows.push(['isPending'].concat(dataKeys));
  }

  // special cases for nonce, gasPrice, gas, and value: convert from hex to base 10
  tx.data.nonce = parseHexToNum(tx.data.nonce);
  tx.data.gas = parseHexToNum(tx.data.gas);
  tx.data.gasPrice = parseHexToNum(tx.data.gasPrice);
  tx.data.value = parseHexToNum(tx.data.value);

  // tx body
  rows.push([tx.isPending].concat(valuesFromKeys(dataKeys, tx.data)));
  return rows;
}

function parseHexToNum(hex) {
  let big = BigInt(hex).toString();
  let int = parseInt(hex, 16);

  if (String(int) !== big) {
    return big;
  }

  return int;
}

function blockToArray(block, headers, txHashes) {
  let rows = [];

  // optional header row
  if (headers) {
    let header = [
      'blockchain',
      'hash',
      'difficulty',
      'gasLimit',
      'number',
      'timestamp',
      'receipt'
    ];
    if (txHashes) {
      header.push('txHashes');
    }
    rows.push(header);
  }

  // block body
  let timestamp = new Date(block.timestamp * 1000);
  let row = [block.blockchain, block.hash, block.difficulty, block.gasLimit, block.number, timestamp, block.receipt];

  if (txHashes) {
    row.push(buildTxHashes(block.transactions));
  }

  rows.push(row);

  return rows;
}

function buildTxHashes(txs) {
  let hashes = txs.map(tx => tx.hash);

  return hashes.join(',');
}


function addressToArray(address, headers, code) {
  let rows = [];

  // optional header row
  if (headers) {
    let header = [
      'label',
      'address',
      'balance',
      'chain',
      'isContract',
      'modules',
      'contracts'
    ];
    if (code) {
      header.push('codeAt');
    }
    rows.push(header);
  }

  // address body
  let modules = buildAssociations(address.modules);
  let contracts = buildAssociations(address.contracts);
  let row = [address.label, address.address, address.balance, address.chain, address.isContract, modules, contracts];

  if (code) {
    row.push(address.codeAt);
  }

  rows.push(row);

  return rows;
}

function buildAssociations(associations) {
  let summary = associations.map(association => {
    let text = association.label;
    if (association.name != undefined && association.name != '') {
      text += ' (' + association.version + ')';
    }
    if (association.version != undefined && association.version != '') {
      text += ' ' + association.version;
    }
    return text;
  });

  return summary.join(',');
}

function functionsToArray(entries, entryLabel, filter, includeOutputs) {
  let rows = [];

  // header row
  // entryLabel is 'function' or 'event'
  let header = [entryLabel, 'description'];
  if (includeOutputs) {
    header.push('read/write');
  }
  header.push('inputs');
  if (includeOutputs) {
    header = header.concat(['outputs']);
  }
  rows.push(header);

  filterRe = new RegExp(filter, 'i');

  // data rows
  for (var i in entries) {
    let entry = entries[i];

    if (filter != '' && filter != undefined && !filterRe.test(entry.name)) {
      continue;
    }

    // build description/notes (docs) for this function/event
    let description = '';
    if (entry.notes != undefined) {
      description += entry.notes;
    }
    if (entry.description != undefined && entry.description != '') {
      if (description != '') {
        description += ' / ';
      }
      description += entry.description;
    }

    let row = [entry.name, description];

    if (includeOutputs) {
      let rw = 'read';
      if (!entry.const) {
        rw = 'write';
      }
      row.push(rw);
    }

    let numInputs = buildNumInputsOrOutputs('input', entry.inputs.length);
    let inputs = buildFunctionInputsOrOutputs(entry.inputs);
    row.push(numInputs + inputs.join("\n"));

    if (includeOutputs) {
      // in this case we're dealing with a function, not an event, which only has inputs
      let numOutputs = buildNumInputsOrOutputs('output', entry.outputs.length);
      let outputs = buildFunctionInputsOrOutputs(entry.outputs);
      row.push(numOutputs + outputs.join("\n"));
    }

    rows.push(row);
  }

  return rows;
}

function buildNumInputsOrOutputs(label, length) {
  let inputsOutputs = '';
  if (length == 0) {
    return 'no ' + label + 's';
  } else if (length == 1) {
    return "1 " + label + ":\n";
  }
  return length + " " + label + "s:\n";
}

function buildFunctionInputsOrOutputs(entries) {
  let params = [];

  for (var i in entries) {
    let entry = entries[i];
    let param = entry.name;
    if (param != '') {
      param += ' ';
    }
    param += buildType(entry.type);
    if (entry.notes != undefined && entry.notes != '') {
      param += ' (' + entry.notes + ')';
    }
    params.push(param);
  }

  return params;
}

function buildType(paramType) {
  let builtType = paramType.type;
  if (paramType.type != "address" && paramType.type != "string" && paramType.size != undefined && paramType.size > 0) {
    builtType += paramType.size;
  }

  return builtType;
}

function eventsToArray(entries) {
  let rows = [];

  // header row: top-level triggeredAt, plus selected/calculated event and tx fields
  // divided by variable number of event and method inputs
  let header0 = [
    'triggeredAt',
    'eventName',
    'eventDef'
  ];
  let header1 = [
    'eventIndexInLog',
    'eventContractAddressLabel',
    'eventContractAddress',
    'eventContractName',
    'txFrom',
    'txData',
    'txHash',
    'txIndexInBlock',
    'txBlockHash',
    'txBlockNumber',
    'txContractAddressLabel',
    'txContractAddress',
    'txContractName',
    'fxnName',
    'fxnDef'
  ];

  // determine the maximum number of event and method inputs
  let maxEventInputs = 0;
  let maxMethodInputs = 0;
  for (var i in entries) {
    let entry = entries[i];

    maxEventInputs = Math.max(maxEventInputs, entry.event.inputs.length);
    if (entry.transaction.method.inputs != undefined) {
      maxMethodInputs = Math.max(maxMethodInputs, entry.transaction.method.inputs.length);
    }
  }
  let eventInputsHeader = buildSeqHeader('eventInput', maxEventInputs);
  let methodInputsHeader = buildSeqHeader('methodInput', maxMethodInputs);

  let header = header0.concat(eventInputsHeader).concat(header1).concat(methodInputsHeader);
  rows.push(header);

  // body rows
  for (var i in entries) {
    let entry = entries[i];
    let event = entry.event;
    let tx = entry.transaction;

    // triggeredAt
    let row = [new Date(entry.triggeredAt)];

    // event fields
    let eventDef = buildSigDef(event);
    let eventInputs = buildInputs(event.inputs, maxEventInputs);

    row = row.concat([event.name, eventDef]).concat(eventInputs).concat([event.indexInLog, event.contract.label, event.contract.address, event.contract.name]);

    // tx fields
    let fxnDef = '';
    let fxnInputs = [];
    if (tx.method != undefined) {
      fxnDef = buildSigDef(tx.method);
      fxnInputs = buildInputs(tx.method.inputs, maxMethodInputs);
    }

    row = row.concat([tx.from, tx.txData, tx.txHash, tx.txIndexInBlock, tx.blockHash, tx.blockNumber, tx.contract.label, tx.contract.address, tx.contract.name, tx.method.name, fxnDef]).concat(fxnInputs);

    rows.push(row);
  }

  return rows;
}

function buildInputs(inputs, maxInputs) {
  // can't use inputs.map() here because we want to pad the array with empty entries
  // up to maxInputs length
  let values = [];
  for (let i = 0; i < maxInputs; i++) {
    let input = undefined;
    if (inputs != undefined && i < inputs.length) {
      input = inputs[i].value;
    }
    values.push(input);
  }

  return values;
}

function buildSigDef(event) {
  // insert name (if any) after each type in the event signature
  let parts = String(event.signature).split(',');
  for (var i in event.inputs) {
    let input = event.inputs[i];
    if (input.name != '') {
      if (i == event.inputs.length - 1) {
        // special case for the last input
        parts[i] = parts[i].substring(0, parts[i].length-1) + ' ' + input.name + ')';
      } else {
        parts[i] += ' ' + input.name;
      }
    }
  }

  return parts.join(',');
}

function buildSeqHeader(prefix, numHeaders) {
  let headers = [];
  for (let i = 0; i < numHeaders; i++) {
    headers.push(prefix + String(i));
  }
  return headers;
}

function objectArrayToArray(objArr) {
  let rows = [];

  // header row: just take the keys from the first row
  let headers = keysFromObj(objArr[0], true);
  rows.push(headers);

  // body rows
  for (var i in objArr) {
    let obj = objArr[i];
    let row = valuesFromKeys(headers, obj);
    rows.push(row);
  }

  return rows;
}

function keysFromObj(obj, sort) {
  let keys = [];
  for (var key in obj) {
    keys.push(key);
  }
  if (sort) {
    keys.sort();
  }

  return keys;
}

function valuesFromKeys(keys, valueObj) {
  let values = [];
  for (var i in keys) {
    let key = keys[i];
    values.push(valueObj[key]);
  }

  return values;
}

function isNaturalNumber(number) {
  return RegExp('^[0-9]+$').test(number);
}

function test() {
  let deployment = 'cywnwu73p5fxjjou6saz7o7gsm';
  let apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODg0MjUyODQsInN1YiI6IjEifQ.cb2PJIWqMxDWgHClBRZJkgeaV8Xf13bJYx1TKE-0-Go';

  let mainnetDeployment = 'y4vwjhsibfflresppyzrckdmue';
  let mainnetAPIKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODg1MTQ2OTcsInN1YiI6IjEifQ.XvppCv5XoldbI-7xwQDvmmW7agcWmS1rIMKTNBjtVuc';

//  let output = MBQUERY(deployment, apiKey, "Queued Exits", 5);

//  let output = MBCOMPOSE(deployment, apiKey, "grid_token","mltitoken","mint", "0xBaC1Cd4051c378bF900087CCc445d7e7d02ad745", undefined, 123);

//  let output = MBEVENTS(deployment, apiKey, "grid_token", 50);

//  let output = MBADDRESS(deployment, apiKey, "grid_token", false);

//  let output = MBBLOCK(deployment, apiKey, "0x2ed5d0a8be85eb2cec8af41bb60ad6d492caedc1472db10a967f3c43b72c8c53");
//  output = MBBLOCK(deployment, apiKey, 7832128);

//  let output = MBTX(deployment, apiKey, "0x8554fef684b45ec405cc4cca47e72018db5745a9456f395c31efc67fdaf24cd9");

  let customQuery = [
    ["eventName", "alias", "index", "aggregator", "alias", "index", "aggregator", "rule", "operator", "value", "rule", "operator", "value"],
    ["Transfer", "account", "0", "", "balance", "2", "subtract", "And:And:addresses.label", "Equal", "grid_token", "And:And:addresses.label", "Equal", "grid_token"],
    ["Transfer", "account", "1", "", "balance", "2", "add", "addresses.label", "Equal", "grid_token", "", "", ""]
  ];

  let customQuery2 = [
    ["eventName", "alias", "index", "aggregator", "alias", "index", "aggregator", "alias", "index", "aggregator", "rule", "operator", "value", "rule", "operator", "value", "rule", "operator", "value"],
    ["ResponseReceived", "answer", "0", "", "round", "1", "", "sender", "2", "", "and:addresses.label", "Equal", "ethusd", "and:or:input1", "Equal", "844", "and:or:input1", "Equal", "845"]
  ];

//  let output = MBCUSTOMQUERY(deployment, apiKey, customQuery, "account");

//  let output = MBEVENTS(mainnetDeployment, mainnetAPIKey, "ethusd", 1, 0);

//  let output = MBCUSTOMQUERYTEMPLATE();

//  let output = MBCUSTOMQUERY(mainnetDeployment, mainnetAPIKey, customQuery2);

  let output = MBFUNCTIONLIST(mainnetDeployment, mainnetAPIKey, "lendingpoolcore","reserve");

  console.log('output: ' + output);
}
