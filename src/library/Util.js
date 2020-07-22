// Copyright (c) 2020 Curvegrid Inc.

/* eslint-disable no-unused-vars, no-use-before-define */

function isNaturalNumber(number) {
  return RegExp('^[0-9]+$').test(number);
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

function clampBool(value, def) {
  // clamp value to a valid bool with a default
  let final;
  if (value === undefined || value === '') {
    final = def;
  } else if (value === true) {
    final = true;
  } else if (value === false) {
    final = false;
  } else {
    final = def;
  }

  return final;
}

function normalizeCreds(deployment, apiKey) {
  // validate deployment ID
  if (!RegExp('^[a-z0-9]+$', 'i').test(deployment)) {
    throw new Error('invalid deployment ID');
  }

  // validate API key
  // based on: https://www.regextester.com/105777
  // eslint-disable-next-line no-useless-escape
  if (!RegExp('^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+\/=]*$').test(apiKey)) {
    throw new Error('invalid API key');
  }

  return [deployment, apiKey];
}

function txToArray(tx, headers) {
  const rows = [];

  const dataKeys = keysFromObj(tx.data, false);

  // optional header row
  if (headers) {
    rows.push(['isPending'].concat(dataKeys));
  }

  // special cases for nonce, gasPrice, gas, and value: convert from hex to base 10
  const txDataFinal = tx.data;
  txDataFinal.nonce = parseHexToNum(tx.data.nonce);
  txDataFinal.gas = parseHexToNum(tx.data.gas);
  txDataFinal.gasPrice = parseHexToNum(tx.data.gasPrice);
  txDataFinal.value = parseHexToNum(tx.data.value);

  // tx body
  rows.push([tx.isPending].concat(valuesFromKeys(dataKeys, txDataFinal)));
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
  const row = [
    block.blockchain,
    block.hash,
    block.difficulty,
    block.gasLimit,
    block.number,
    timestamp,
    block.receipt];

  if (txHashes) {
    row.push(buildTxHashes(block.transactions));
  }

  rows.push(row);

  return rows;
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
  const row = [
    address.label,
    address.address,
    address.balance,
    address.chain,
    address.contracts.length > 0,
    modules,
    contracts,
  ];

  if (code) {
    row.push(address.codeAt);
  }

  rows.push(row);

  return rows;
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

  const filterRe = new RegExp(filter, 'i');

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
        event.indexInLog, event.contract.label, event.contract.address, event.contract.name,
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

// After blockToArray, date value in spreadsheet will be formatted
// as new Date('2015-07-30T15:26:28.000Z') from "2015-07-30T15:26:28.000Z"
function formatDateTime(dateTime) {
  return new Date(dateTime);
}
