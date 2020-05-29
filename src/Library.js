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
    sheet.getRange(range.getRow() + i, range.getColumn() + range.getNumColumns(), 1, 1).setValue(results.result.tx.hash);
    SpreadsheetApp.flush();
  }
}

function extractSelectFilterCounts(header) {
  let numSelect = 0;
  let numFilter = 0;

  let selectHalf = true;
  for (let i = 1; i < header.length; i += 3) {
    const aliasRule = header[i].toLowerCase();
    const indexOperator = header[i + 1].toLowerCase();
    const aggregatorValue = header[i + 2].toLowerCase();

    if (selectHalf) {
      if (aliasRule === 'rule') {
        selectHalf = false;
      } else {
        if (aliasRule !== 'alias') {
          throw new Error(`expecting 'alias' in position ${i}, found '${aliasRule}'`);
        }
        if (indexOperator !== 'index') {
          throw new Error(`expecting 'index' in position ${i + 1}, found '${indexOperator}'`);
        }
        if (aggregatorValue !== 'aggregator') {
          throw new Error(`expecting 'aggregator' in position ${i + 2}, found '${aggregatorValue}'`);
        }

        numSelect++;
      }
    }
    if (!selectHalf) {
      if (aliasRule !== 'rule') {
        throw new Error(`expecting 'rule' in position ${i}, found '${aliasRule}'`);
      }
      if (indexOperator !== 'operator') {
        throw new Error(`expecting 'operator' in position ${i + 1}, found '${indexOperator}'`);
      }
      if (aggregatorValue !== 'value') {
        throw new Error(`expecting 'value' in position ${i + 2}, found '${aggregatorValue}'`);
      }

      numFilter++;
    }
  }

  return [numSelect, numFilter];
}

function buildCustomQuery(events, groupBy, orderBy, limit, offset) {
  const query = {
    events: [],
  };

  if (groupBy !== undefined && groupBy !== '') {
    query.groupBy = groupBy;
  }
  if (orderBy !== undefined && orderBy !== '') {
    query.orderBy = orderBy;
  }

  // parse and validate header row
  if (events.length < 2) {
    throw new Error(`expecting a header row followed by one or more data rows, found ${events.length} rows total`);
  }
  const header = events[0];
  if (header.length < 4) {
    throw new Error(`expecting to have at least four columns, found ${header.length} columns total`);
  }
  if ((header.length - 1) % 3 !== 0) {
    throw new Error(`expecting number of columns to be divisible by 3 plus 1, found ${header.length} columns total`);
  }
  if (header[0].toLowerCase() !== 'eventname') {
    throw new Error(`expecting first column in header row to be 'eventName', found '${header[0]}'`);
  }

  // extract the number of select and filter triplets
  const [numSelect, numFilter] = extractSelectFilterCounts(header);

  // build the event query
  for (let i = 1; i < events.length; i++) {
    const event = events[i];

    // build selects and filters
    const selects = buildSelects(event, 1, numSelect);
    const filters = buildFilters(event, 1 + numSelect * 3, numFilter);

    query.events.push({
      eventName: event[0],
      select: selects,
      filter: filters,
    });
  }

  return query;
}

const VALID_AGGREGATORS = ['subtract', 'add', 'first', 'last', 'max', 'min', ''];
const VALID_BOOLEANS = ['and', 'or'];
const VALID_OPERATORS = ['equal', 'notequal', 'lessthan', 'greaterthan'];
const VALID_OPERANDS = ['input', 'contracts.label', 'contracts.contract_name', 'addresses.address', 'addresses.label'];

function buildFilters(items, start, numItems) {
  const filter = {};
  for (let i = start; i < start + numItems * 3; i += 3) {
    const rules = items[i];
    const operator = items[i + 1];
    const value = items[i + 2];

    // not all rows will have the same number of filters
    if (rules === '') {
      break;
    }

    if (value === '') {
      throw new Error(`value is empty for rule '${rules}'`);
    }

    // split by colons
    const rulePath = rules.split(':');
    if (rulePath.length === 1) {
      // special case for a single rule
      rulePath.unshift('And');
    }

    // loop through 'and' and 'or', creating children if they don't exist
    let node = filter;
    // eslint-disable-next-line no-restricted-syntax, guard-for-in
    for (const j in rulePath) {
      // parse out rule and optional numeric portions (e.g., input0)
      const ruleParts = RegExp('^([A-Za-z\.]+)([0-9]*)$').exec(rulePath[j]);
      if (ruleParts === null || ruleParts.length < 2) {
        throw new Error(`invalid rule '${rulePath[j]}' in '${rules}'`);
      }
      const rule = ruleParts[1].toLowerCase();
      if (rule === '') {
        throw new Error(`sub-rule is empty in '${rules}'`);
      }

      // if we're on a children array, search for a child matching this rule
      if (Array.isArray(node)) {
        // find the one that matches this rule
        let matchedChild = false;
        // eslint-disable-next-line no-restricted-syntax, guard-for-in
        for (const k in node) {
          if (node[k].rule === rule) {
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
          // eslint-disable-next-line no-continue
          continue;
        }
      }

      // add a rule or descend to the next level down as appropriate
      if (VALID_BOOLEANS.includes(rule)) {
        if (Object.keys(node).length === 0) {
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
        if (rule === 'input') {
          if (ruleParts.length !== 3) {
            throw new Error("no input index provided, just 'input'");
          }
          const inputIndex = ruleParts[2];
          if (!isNaturalNumber(inputIndex)) {
            throw new Error(`invalid input index '${inputIndex}', must be a positive number`);
          }
          node.inputIndex = parseInt(inputIndex);
        }
      }
    }
  }

  return filter;
}

function buildSelects(items, start, numItems) {
  const triplets = [];
  for (let i = start; i < numItems * 3; i += 3) {
    // not all rows will have the same number of triplets
    if (items[i] === '') {
      triplets.push(triplet);
      break;
    }
    let triplet = {
      alias: items[i],
      inputIndex: parseInt(items[i + 1], 10),
    };
    const aggregator = validateAggregator(items[i + 2]);
    if (aggregator !== '') {
      triplet.aggregator = aggregator;
    }
    triplets.push(triplet);
  }

  return triplets;
}

function validateOperator(operator) {
  operator = String(operator).toLowerCase();
  if (!VALID_OPERATORS.includes(operator)) {
    throw new Error(`'${operator}' is not a valid operator, must be one of ${VALID_OPERATORS.join(',')}`);
  }

  return operator;
}


function validateAggregator(aggregator) {
  aggregator = String(aggregator).toLowerCase();
  if (!VALID_AGGREGATORS.includes(aggregator)) {
    throw new Error(`'${aggregator}' is not a valid aggregator, must be one of ${VALID_AGGREGATORS.join(',')}`);
  }

  return aggregator;
}

function validateBlockNumOrHash(numOrHash) {
  if (numOrHash === undefined || numOrHash === '') {
    throw new Error('must provide a block number or hash');
  }

  // fast return if it's a valid positive integer
  if (isNaturalNumber(numOrHash)) {
    return;
  }

  validateBlockTxHash(numOrHash);
}

function validateBlockTxHash(hash) {
  hash = String(hash);

  if (hash === undefined || hash === '' || hash.length < 2) {
    throw new Error('must provide a hash');
  }

  if (hash.substring(0, 2).toLowerCase() !== '0x') {
    throw new Error("hash must start with '0x'");
  }

  if (hash.length !== 66) {
    throw new Error(`invalid hash length of ${hash.length}, should be 64 hex characters long excluding the '0x' prefix`);
  }

  if (!RegExp('^0[xX][A-Fa-f0-9]+$').test(hash)) {
    throw new Error('hash contains non-hexidecimal digits (outside of 0-9 and a-f)');
  }
}

function clampBool(value, def) {
  // clamp value to a valid bool with a default
  if (value === undefined || value === '') {
    value = def;
  } else if (value === true) {
    value = true;
  } else if (value === false) {
    value = false;
  } else {
    value = def;
  }

  return value;
}

function buildMethodArgs(args, from, signer, signAndSubmit) {
  const payload = {
    args,
    contractOverride: true,
  };

  // optional from and signer for "write" transactions
  if (from !== undefined) {
    if (signer === undefined || signer === '') {
      signer = from;
    }
    payload.from = from;
    payload.signer = signer;

    // optional "sign and submit" for HSM addresses
    if (signAndSubmit !== undefined) {
      payload.signAndSubmit = signAndSubmit;
    }
  }

  return payload;
}

function limitQuery(httpMethod, deployment, apiKey, queryPath, limit, offset, payload) {
  // validate and normalize limit and offset
  const limitOffset = buildLimitOffset(limit, offset);

  // query
  const results = query(httpMethod, deployment, apiKey, queryPath + limitOffset, payload);

  return results;
}

function normalizeCreds(deployment, apiKey) {
  // validate deployment ID
  if (!RegExp('^[a-z0-9]+$', 'i').test(deployment)) {
    throw new Error('invalid deployment ID');
  }

  // validate API key
  // based on: https://www.regextester.com/105777
  if (!RegExp('^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+\/=]*$').test(apiKey)) {
    throw new Error('invalid API key');
  }

  return deployment, apiKey;
}

function buildLimitOffset(limit, offset) {
  // validate limit
  if (limit !== undefined && !isNaturalNumber(limit)) {
    throw new Error('invalid limit, must be a positive integer');
  }

  // validate offset
  if (offset !== undefined && !isNaturalNumber(offset)) {
    throw new Error('invalid offset, must be a positive integer');
  }

  // generate a clean URL query param
  let limitOffset = '';
  if (limit !== undefined) {
    limitOffset += `?limit=${limit}`;
  }
  if (offset !== undefined) {
    if (limitOffset === '') {
      limitOffset += '?';
    } else {
      limitOffset += '&';
    }
    limitOffset += `offset=${offset}`;
  }

  return limitOffset;
}

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

function txToArray(tx, headers) {
  const rows = [];

  const dataKeys = keysFromObj(tx.data, false);

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
  const big = BigInt(hex).toString();
  const int = parseInt(hex, 16);

  if (String(int) !== big) {
    return big;
  }

  return int;
}

function blockToArray(block, headers, txHashes) {
  const rows = [];

  // optional header row
  if (headers) {
    const header = [
      'blockchain',
      'hash',
      'difficulty',
      'gasLimit',
      'number',
      'timestamp',
      'receipt',
    ];
    if (txHashes) {
      header.push('txHashes');
    }
    rows.push(header);
  }

  // block body
  const timestamp = new Date(block.timestamp * 1000);
  const row = [block.blockchain, block.hash, block.difficulty, block.gasLimit, block.number, timestamp, block.receipt];

  if (txHashes) {
    row.push(buildTxHashes(block.transactions));
  }

  rows.push(row);

  return rows;
}

function buildTxHashes(txs) {
  const hashes = txs.map((tx) => tx.hash);

  return hashes.join(',');
}


function addressToArray(address, headers, code) {
  const rows = [];

  // optional header row
  if (headers) {
    const header = [
      'label',
      'address',
      'balance',
      'chain',
      'isContract',
      'modules',
      'contracts',
    ];
    if (code) {
      header.push('codeAt');
    }
    rows.push(header);
  }

  // address body
  const modules = buildAssociations(address.modules);
  const contracts = buildAssociations(address.contracts);
  const row = [address.label, address.address, address.balance, address.chain, address.isContract, modules, contracts];

  if (code) {
    row.push(address.codeAt);
  }

  rows.push(row);

  return rows;
}

function buildAssociations(associations) {
  const summary = associations.map((association) => {
    let text = association.label;
    if (association.name !== undefined && association.name !== '') {
      text += ` (${association.version})`;
    }
    if (association.version !== undefined && association.version !== '') {
      text += ` ${association.version}`;
    }
    return text;
  });

  return summary.join(',');
}

function functionsToArray(entries, entryLabel, filter, includeOutputs) {
  const rows = [];

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
  // eslint-disable-next-line no-restricted-syntax, guard-for-in
  for (const i in entries) {
    const entry = entries[i];

    if (filter !== '' && filter !== undefined && !filterRe.test(entry.name)) {
      // eslint-disable-next-line no-continue
      continue;
    }

    // build description/notes (docs) for this function/event
    let description = '';
    if (entry.notes !== undefined) {
      description += entry.notes;
    }
    if (entry.description !== undefined && entry.description !== '') {
      if (description !== '') {
        description += ' / ';
      }
      description += entry.description;
    }

    const row = [entry.name, description];

    if (includeOutputs) {
      let rw = 'read';
      if (!entry.const) {
        rw = 'write';
      }
      row.push(rw);
    }

    const numInputs = buildNumInputsOrOutputs('input', entry.inputs.length);
    const inputs = buildFunctionInputsOrOutputs(entry.inputs);
    row.push(numInputs + inputs.join('\n'));

    if (includeOutputs) {
      // in this case we're dealing with a function, not an event, which only has inputs
      const numOutputs = buildNumInputsOrOutputs('output', entry.outputs.length);
      const outputs = buildFunctionInputsOrOutputs(entry.outputs);
      row.push(numOutputs + outputs.join('\n'));
    }

    rows.push(row);
  }

  return rows;
}

function buildNumInputsOrOutputs(label, length) {
  const inputsOutputs = '';
  if (length === 0) {
    return `no ${label}s`;
  } if (length === 1) {
    return `1 ${label}:\n`;
  }
  return `${length} ${label}s:\n`;
}

function buildFunctionInputsOrOutputs(entries) {
  const params = [];

  // eslint-disable-next-line no-restricted-syntax, guard-for-in
  for (const i in entries) {
    const entry = entries[i];
    let param = entry.name;
    if (param !== '') {
      param += ' ';
    }
    param += buildType(entry.type);
    if (entry.notes !== undefined && entry.notes !== '') {
      param += ` (${entry.notes})`;
    }
    params.push(param);
  }

  return params;
}

function buildType(paramType) {
  let builtType = paramType.type;
  if (paramType.type !== 'address' && paramType.type !== 'string' && paramType.size !== undefined && paramType.size > 0) {
    builtType += paramType.size;
  }

  return builtType;
}

function eventsToArray(entries) {
  const rows = [];

  // header row: top-level triggeredAt, plus selected/calculated event and tx fields
  // divided by variable number of event and method inputs
  const header0 = [
    'triggeredAt',
    'eventName',
    'eventDef',
  ];
  const header1 = [
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
    'fxnDef',
  ];

  // determine the maximum number of event and method inputs
  let maxEventInputs = 0;
  let maxMethodInputs = 0;
  // eslint-disable-next-line no-restricted-syntax, guard-for-in
  for (const i in entries) {
    const entry = entries[i];

    maxEventInputs = Math.max(maxEventInputs, entry.event.inputs.length);
    if (entry.transaction.method.inputs !== undefined) {
      maxMethodInputs = Math.max(maxMethodInputs, entry.transaction.method.inputs.length);
    }
  }
  const eventInputsHeader = buildSeqHeader('eventInput', maxEventInputs);
  const methodInputsHeader = buildSeqHeader('methodInput', maxMethodInputs);

  const header = header0.concat(eventInputsHeader).concat(header1).concat(methodInputsHeader);
  rows.push(header);

  // body rows
  // eslint-disable-next-line no-restricted-syntax, guard-for-in
  for (const i in entries) {
    const entry = entries[i];
    const { event } = entry;
    const tx = entry.transaction;

    // triggeredAt
    let row = [new Date(entry.triggeredAt)];

    // event fields
    const eventDef = buildSigDef(event);
    const eventInputs = buildInputs(event.inputs, maxEventInputs);

    row = row
      .concat([event.name, eventDef])
      .concat(eventInputs)
      .concat([
        event.indexInLog, event.contract.label, event.contract.address, event.contract.name
      ]);

    // tx fields
    let fxnDef = '';
    let fxnInputs = [];
    if (tx.method !== undefined) {
      fxnDef = buildSigDef(tx.method);
      fxnInputs = buildInputs(tx.method.inputs, maxMethodInputs);
    }

    row = row
      .concat([
        tx.from,
        tx.txData,
        tx.txHash,
        tx.txIndexInBlock,
        tx.blockHash,
        tx.blockNumber,
        tx.contract.label,
        tx.contract.address,
        tx.contract.name,
        tx.method.name,
        fxnDef,
      ])
      .concat(fxnInputs);

    rows.push(row);
  }

  return rows;
}

function buildInputs(inputs, maxInputs) {
  // can't use inputs.map() here because we want to pad the array with empty entries
  // up to maxInputs length
  const values = [];
  for (let i = 0; i < maxInputs; i++) {
    let input;
    if (inputs !== undefined && i < inputs.length) {
      input = inputs[i].value;
    }
    values.push(input);
  }

  return values;
}

function buildSigDef(event) {
  // insert name (if any) after each type in the event signature
  const parts = String(event.signature).split(',');
  // eslint-disable-next-line no-restricted-syntax, guard-for-in
  for (const i in event.inputs) {
    const input = event.inputs[i];
    if (input.name !== '') {
      if (i === event.inputs.length - 1) {
        // special case for the last input
        parts[i] = `${parts[i].substring(0, parts[i].length - 1)} ${input.name})`;
      } else {
        parts[i] += ` ${input.name}`;
      }
    }
  }

  return parts.join(',');
}

function buildSeqHeader(prefix, numHeaders) {
  const headers = [];
  for (let i = 0; i < numHeaders; i++) {
    headers.push(prefix + String(i));
  }
  return headers;
}

function objectArrayToArray(objArr) {
  const rows = [];

  // header row: just take the keys from the first row
  const headers = keysFromObj(objArr[0], true);
  rows.push(headers);

  // body rows
  // eslint-disable-next-line no-restricted-syntax, guard-for-in
  for (const i in objArr) {
    const obj = objArr[i];
    const row = valuesFromKeys(headers, obj);
    rows.push(row);
  }

  return rows;
}

function keysFromObj(obj, sort) {
  const keys = [];
  // eslint-disable-next-line no-restricted-syntax, guard-for-in
  for (const key in obj) {
    keys.push(key);
  }
  if (sort) {
    keys.sort();
  }

  return keys;
}

function valuesFromKeys(keys, valueObj) {
  const values = [];
  // eslint-disable-next-line no-restricted-syntax, guard-for-in
  for (const i in keys) {
    const key = keys[i];
    values.push(valueObj[key]);
  }

  return values;
}

function isNaturalNumber(number) {
  return RegExp('^[0-9]+$').test(number);
}
